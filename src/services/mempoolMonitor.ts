// Mempool Monitoring Service
import { ethers  } from 'ethers';
import axios from 'axios';
import { CONFIG, ABIS  } from '../config';
import { CopyTradeOps, TokenOps  } from '../database/operations';
import { EventEmitter  } from 'events';

// Create an event emitter for mempool events
const mempoolEvents = new EventEmitter();

// Provider setup
let provider;
let isMonitoring = false;

// Initialize provider
function initProvider(): any {
  try {
    provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);
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
function startMonitoring(): any {
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
function stopMonitoring(): any {
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
 * Check if monitoring is active
 */
function isActive(): any {
  return isMonitoring;
}

/**
 * Process a pending transaction
 * @param {string} txHash - Transaction hash
 */
async function processPendingTransaction(txHash): Promise<any> {
  try {
    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    if (!tx) return;

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
async function processNewBlock(blockNumber): Promise<any> {
  try {
    // Get block details
    const block = await provider.getBlock(blockNumber, true);
    if (!block) return;

    // Process transactions in the block
    for (const tx of block.transactions) {
      // Make sure tx and its properties exist before using them
      if (!tx) continue;
      
      // Process confirmed transactions here
      mempoolEvents.emit('confirmed', {
        hash: tx.hash || '',
        from: tx.from || '',
        to: tx.to || '',
        value: tx.value ? tx.value.toString() : '0',
        blockNumber: block.number,
        timestamp: block.timestamp
      });
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
function isDEXInteraction(tx): any {
  if (!tx || !tx.to) return false;
  
  // Check if transaction is to a known DEX router
  const dexRouters = Object.values(CONFIG.DEX_ROUTERS).map(addr => (addr as string).toLowerCase());
  return dexRouters.includes(tx.to.toLowerCase());
}

/**
 * Process a DEX transaction
 * @param {Object} tx - Transaction object
 */
function processDEXTransaction(tx): any {
  try {
    // Decode the transaction data
    const iface = new ethers.utils.Interface(ABIS.AERODROME_ROUTER_ABI);
    const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
    
    if (!decoded) return;
    
    // Extract transaction details
    const { name, args } = decoded;
    
    // Emit event for DEX transaction
    mempoolEvents.emit('dex_transaction', {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      method: name,
      args: args.map(arg => arg.toString())
    });

    // Notify about large swaps
    if (name.includes('swap') && tx.value.gt(ethers.utils.parseEther('1'))) {
      // This would notify users about large swaps
      notifyLargeSwap(tx, name, args);
    }
  } catch (error) {
    // Not a DEX transaction or error decoding
    // console.error(`Error processing DEX transaction ${tx.hash}:`, error);
  }
}

/**
 * Check if a transaction is interacting with an ERC20 token
 * @param {Object} tx - Transaction object
 * @returns {boolean} - True if interacting with an ERC20 token
 */
function isERC20Interaction(tx): any {
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
function processERC20Transaction(tx): any {
  try {
    // Decode the transaction data
    const iface = new ethers.utils.Interface(ABIS.ERC20_ABI);
    const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });
    
    if (!decoded) return;
    
    // Extract transaction details
    const { name, args } = decoded;
    
    // Emit event for ERC20 transaction
    mempoolEvents.emit('erc20_transaction', {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      tokenContract: tx.to,
      method: name,
      args: args.map(arg => arg.toString())
    });

    // Handle token approvals (potential security risk)
    if (name === 'approve' && args[1].gt(ethers.utils.parseEther('1000'))) {
      notifyLargeApproval(tx, args);
    }
  } catch (error) {
    // Not an ERC20 transaction or error decoding
    // console.error(`Error processing ERC20 transaction ${tx.hash}:`, error);
  }
}

/**
 * Check if a transaction is interacting with Zora contracts
 * @param {Object} tx - Transaction object
 * @returns {boolean} - True if interacting with Zora
 */
function isZoraInteraction(tx): any {
  if (!tx || !tx.to) return false;
  
  // Check if transaction is to a known Zora contract
  const zoraContracts = Object.values(CONFIG.ZORA_CONTRACTS).map(addr => (addr as string).toLowerCase());
  return zoraContracts.includes(tx.to.toLowerCase());
}

/**
 * Process a Zora transaction
 * @param {Object} tx - Transaction object
 */
function processZoraTransaction(tx): any {
  try {
    // Emit event for Zora transaction
    mempoolEvents.emit('zora_transaction', {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString()
    });

    // Notify about new content creation
    notifyNewContent(tx);
  } catch (error) {
    console.error(`❌ Error processing Zora transaction ${tx.hash}:`, error);
  }
}

/**
 * Notify about large swap transactions
 * @param {Object} tx - Transaction object
 * @param {string} method - Method name
 * @param {Array} args - Method arguments
 */
function notifyLargeSwap(tx, method, args): any {
  // In a real implementation, this would notify users about large swaps
  // For now, just emit an event
  mempoolEvents.emit('large_swap', {
    hash: tx.hash,
    from: tx.from,
    value: tx.value.toString(),
    method
  });
}

/**
 * Notify about large token approvals
 * @param {Object} tx - Transaction object
 * @param {Array} args - Method arguments
 */
function notifyLargeApproval(tx, args): any {
  // In a real implementation, this would notify users about large approvals
  // For now, just emit an event
  mempoolEvents.emit('large_approval', {
    hash: tx.hash,
    from: tx.from,
    to: tx.to,
    spender: args[0],
    amount: args[1].toString()
  });
}

/**
 * Notify about new content creation
 * @param {Object} tx - Transaction object
 */
function notifyNewContent(tx): any {
  // In a real implementation, this would notify users about new content
  // For now, just emit an event
  mempoolEvents.emit('new_content', {
    hash: tx.hash,
    from: tx.from,
    to: tx.to
  });
}

/**
 * Fetch data from Zora API
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} - API response
 */
async function fetchZoraAPIData(endpoint, params = {}): Promise<any> {
  try {
    const url = `${CONFIG.ZORA_API_BASE}${endpoint}`;
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching Zora API data:', error);
    return null;
  }
}

// For development only - update package.json
function updatePackageJSON(): any {
  // This is just a placeholder for development
}

export { 
  startMonitoring,
  stopMonitoring,
  isActive,
  mempoolEvents
 }; 