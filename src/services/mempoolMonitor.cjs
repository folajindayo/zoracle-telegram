/**
 * Mempool Monitoring Service (CommonJS version)
 * This version includes robust address validation to prevent crashes
 */
const ethers = require('ethers');
const { isValidEthereumAddress } = require('../utils/address-validation.cjs');
const EventEmitter = require('events');

// Create an event emitter for mempool events
const mempoolEvents = new EventEmitter();

// Provider setup
let provider;
let isMonitoring = false;

// Initialize provider
function initProvider() {
  try {
    // Get the provider URL from environment or use a default
    const providerUrl = process.env.PROVIDER_URL || 
      `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
    
    provider = new ethers.providers.JsonRpcProvider(providerUrl);
    
    // Add global error handler for provider
    provider.on('error', (error) => {
      console.error('❌ Mempool monitor provider error:', error);
      // Attempt to recover by reinitializing the provider after a delay
      setTimeout(() => {
        console.log('🔄 Attempting to reinitialize mempool monitor provider...');
        initProvider();
      }, 5000);
    });
    
    console.log('✅ Mempool monitor provider initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize mempool monitor provider:', error);
    return false;
  }
}

/**
 * Start monitoring the mempool for transactions
 */
function startMonitoring() {
  if (isMonitoring) {
    console.log('⚠️ Mempool monitoring already active');
    return false;
  }

  if (!initProvider()) {
    console.error('❌ Cannot start mempool monitoring without provider');
    return false;
  }

  console.log('🔍 Starting mempool monitoring...');
  
  // Listen for pending transactions
  provider.on('pending', (txHash) => {
    processPendingTransaction(txHash);
  });

  // Listen for new blocks
  provider.on('block', (blockNumber) => {
    processNewBlock(blockNumber);
  });

  isMonitoring = true;
  return true;
}

/**
 * Stop monitoring the mempool
 */
function stopMonitoring() {
  if (!isMonitoring) {
    console.log('⚠️ Mempool monitoring not active');
    return false;
  }

  console.log('🛑 Stopping mempool monitoring...');
  
  // Remove all listeners
  provider.removeAllListeners('pending');
  provider.removeAllListeners('block');
  
  isMonitoring = false;
  return true;
}

/**
 * Process a pending transaction
 * @param {string} txHash - Transaction hash
 */
async function processPendingTransaction(txHash) {
  try {
    // Get transaction details - wrapped in its own try-catch to handle provider errors
    let tx;
    try {
      tx = await provider.getTransaction(txHash);
      if (!tx) return;
    } catch (providerError) {
      // This specifically handles provider errors like invalid address format
      console.warn(`⚠️ Provider error for transaction ${txHash}:`, providerError.message);
      return;
    }

    // Validate the transaction addresses before proceeding
    if (tx.from && !isValidEthereumAddress(tx.from)) {
      console.warn(`⚠️ Invalid 'from' address in transaction ${txHash}: ${tx.from}`);
      return;
    }

    if (tx.to && !isValidEthereumAddress(tx.to)) {
      console.warn(`⚠️ Invalid 'to' address in transaction ${txHash}: ${tx.to}`);
      return;
    }

    // Process DEX interactions
    if (isDEXInteraction(tx)) {
      processDEXTransaction(tx);
    }

    // Process ERC20 interactions
    if (isERC20Interaction(tx)) {
      processERC20Transaction(tx);
    }

    // Process Zora interactions
    if (isZoraInteraction(tx)) {
      processZoraTransaction(tx);
    }

    // Emit event for the transaction
    mempoolEvents.emit('transaction', {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasPrice: tx.gasPrice.toString(),
      data: tx.data
    });
  } catch (error) {
    console.error(`❌ Error processing transaction ${txHash}:`, error);
  }
}

/**
 * Process a new block
 * @param {number} blockNumber - Block number
 */
async function processNewBlock(blockNumber) {
  try {
    // Get block details - wrapped in its own try-catch to handle provider errors
    let block;
    try {
      block = await provider.getBlock(blockNumber, true);
      if (!block) return;
    } catch (providerError) {
      console.warn(`⚠️ Provider error for block ${blockNumber}:`, providerError.message);
      return;
    }

    // Process transactions in the block
    for (const tx of block.transactions) {
      // Make sure tx and its properties exist before using them
      if (!tx) continue;
      
      // Validate the transaction addresses before proceeding
      if (tx.from && !isValidEthereumAddress(tx.from)) {
        console.warn(`⚠️ Invalid 'from' address in block ${blockNumber}, tx ${tx.hash}: ${tx.from}`);
        continue;
      }

      if (tx.to && !isValidEthereumAddress(tx.to)) {
        console.warn(`⚠️ Invalid 'to' address in block ${blockNumber}, tx ${tx.hash}: ${tx.to}`);
        continue;
      }
      
      try {
        // Process confirmed transactions here
        mempoolEvents.emit('confirmed', {
          hash: tx.hash || '',
          from: tx.from || '',
          to: tx.to || '',
          value: tx.value ? tx.value.toString() : '0',
          blockNumber: block.number,
          timestamp: block.timestamp
        });
      } catch (txError) {
        console.warn(`⚠️ Error emitting confirmed transaction in block ${blockNumber}, tx ${tx.hash}:`, txError.message);
      }
    }
  } catch (error) {
    console.error(`❌ Error processing block ${blockNumber}:`, error);
  }
}

/**
 * Check if a transaction is interacting with a DEX
 * @param {Object} tx - Transaction object
 * @returns {boolean} - True if interacting with a DEX
 */
function isDEXInteraction(tx) {
  if (!tx || !tx.to || !isValidEthereumAddress(tx.to)) return false;
  
  // Simplified DEX router check - in a real app, these would be loaded from CONFIG
  const dexRouters = [
    '0x41C8cf74c27554A8972d3BDE969Cbd0B11D0Ef23', // Aerodrome Router
    '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86', // BaseSwap Router
    '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86', // PancakeSwap Router
  ].map(addr => addr.toLowerCase());
  
  return dexRouters.includes(tx.to.toLowerCase());
}

/**
 * Process a DEX transaction
 * @param {Object} tx - Transaction object
 */
function processDEXTransaction(tx) {
  try {
    console.log(`Processing DEX transaction: ${tx.hash}`);
    // In a real implementation, this would decode transaction data
    // and process specific DEX interactions
  } catch (error) {
    console.error(`❌ Error processing DEX transaction ${tx.hash}:`, error);
  }
}

/**
 * Check if a transaction is interacting with an ERC20 token
 * @param {Object} tx - Transaction object
 * @returns {boolean} - True if interacting with an ERC20 token
 */
function isERC20Interaction(tx) {
  if (!tx || !tx.data || tx.data === '0x') return false;
  
  // Check for common ERC20 function signatures
  const transferSig = '0xa9059cbb'; // transfer(address,uint256)
  const approveSig = '0x095ea7b3'; // approve(address,uint256)
  const transferFromSig = '0x23b872dd'; // transferFrom(address,address,uint256)
  
  const funcSig = tx.data.substring(0, 10);
  return [transferSig, approveSig, transferFromSig].includes(funcSig);
}

/**
 * Process an ERC20 transaction
 * @param {Object} tx - Transaction object
 */
function processERC20Transaction(tx) {
  try {
    console.log(`Processing ERC20 transaction: ${tx.hash}`);
    // In a real implementation, this would decode transaction data
    // and process specific ERC20 token interactions
  } catch (error) {
    console.error(`❌ Error processing ERC20 transaction ${tx.hash}:`, error);
  }
}

/**
 * Check if a transaction is interacting with Zora contracts
 * @param {Object} tx - Transaction object
 * @returns {boolean} - True if interacting with Zora
 */
function isZoraInteraction(tx) {
  if (!tx || !tx.to || !isValidEthereumAddress(tx.to)) return false;
  
  // Simplified Zora contract check - in a real app, these would be loaded from CONFIG
  const zoraContracts = [
    '0x777777C338d93e2C7adf08D102d45CA7CC4Ed021', // Factory
    '0x7777777F279eba3d3Cf220dC9B65lDB275d3F0D9', // Rewards
    '0x7777777900D7af739d4531f14CD228C50D83C655', // Drops
  ].map(addr => addr.toLowerCase());
  
  return zoraContracts.includes(tx.to.toLowerCase());
}

/**
 * Process a Zora transaction
 * @param {Object} tx - Transaction object
 */
function processZoraTransaction(tx) {
  try {
    console.log(`Processing Zora transaction: ${tx.hash}`);
    // In a real implementation, this would process Zora-specific interactions
  } catch (error) {
    console.error(`❌ Error processing Zora transaction ${tx.hash}:`, error);
  }
}

/**
 * Check if monitoring is active
 */
function isActive() {
  return isMonitoring;
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  isActive,
  mempoolEvents
};