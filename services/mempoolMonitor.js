/**
 * Enhanced Mempool Monitor Service for Zoracle Telegram Bot
 * 
 * Monitors the Base blockchain mempool for new transactions related to
 * Zora content tokens and DEX interactions.
 */
const { ethers } = require('ethers');
const { CONFIG, ABIS } = require('../config');
const { CopyTradeOps, TokenOps } = require('../database/operations');

// Provider setup
let provider;
try {
  provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);
} catch (error) {
  console.error('❌ Failed to connect to provider:', error.message);
  process.exit(1);
}

// Track if monitoring is active
let isMonitoring = false;

// Store for processed transactions to avoid duplicates
const processedTxs = new Set();

// Listeners for new transactions
const listeners = new Map();

// Interface for decoding transaction data
const aerodromeRouterInterface = new ethers.utils.Interface(ABIS.AERODROME_ROUTER_ABI);
const erc20Interface = new ethers.utils.Interface(ABIS.ERC20_ABI);
const zoraFactoryInterface = new ethers.utils.Interface(ABIS.ZORA_FACTORY_ABI);
const zora1155Interface = new ethers.utils.Interface(ABIS.ZORA_1155_ABI);

/**
 * Start monitoring the mempool
 * @returns {boolean} - True if started successfully
 */
function startMonitoring() {
  if (isMonitoring) {
    console.log('🔍 Mempool monitoring already active');
    return true;
  }
  
  try {
    console.log('🔍 Starting mempool monitoring...');
    
    // Listen for pending transactions
    provider.on('pending', (txHash) => {
      // Skip if already processed
      if (processedTxs.has(txHash)) return;
      
      // Get transaction details
      provider.getTransaction(txHash).then((tx) => {
        if (!tx) return;
        
        // Process transaction
        processTransaction(tx);
        
        // Mark as processed
        processedTxs.add(txHash);
        
        // Clean up processed txs set (limit to 1000 entries)
        if (processedTxs.size > 1000) {
          const iterator = processedTxs.values();
          processedTxs.delete(iterator.next().value);
        }
      }).catch((error) => {
        console.error(`Error processing transaction ${txHash}:`, error);
      });
    });
    
    // Listen for new blocks to check for confirmed transactions
    provider.on('block', (blockNumber) => {
      provider.getBlockWithTransactions(blockNumber).then((block) => {
        if (!block || !block.transactions) return;
        
        // Process each transaction in the block
        for (const tx of block.transactions) {
          // Skip if already processed
          if (processedTxs.has(tx.hash)) continue;
          
          // Process confirmed transaction
          processConfirmedTransaction(tx);
          
          // Mark as processed
          processedTxs.add(tx.hash);
        }
      }).catch((error) => {
        console.error(`Error processing block ${blockNumber}:`, error);
      });
    });
    
    isMonitoring = true;
    console.log('✅ Mempool monitoring started successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to start mempool monitoring:', error.message);
    return false;
  }
}

/**
 * Stop monitoring the mempool
 * @returns {boolean} - True if stopped successfully
 */
function stopMonitoring() {
  if (!isMonitoring) {
    console.log('🔍 Mempool monitoring already inactive');
    return true;
  }
  
  try {
    console.log('🔍 Stopping mempool monitoring...');
    
    // Remove all listeners
    provider.removeAllListeners('pending');
    provider.removeAllListeners('block');
    
    isMonitoring = false;
    console.log('✅ Mempool monitoring stopped successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to stop mempool monitoring:', error.message);
    return false;
  }
}

/**
 * Process a transaction
 * @param {Object} tx - Transaction object
 */
function processTransaction(tx) {
  // Skip transactions with no data (simple ETH transfers)
  if (!tx.data || tx.data === '0x') {
    // Still check for ETH transfers to monitored wallets
    checkForEthTransfers(tx);
    return;
  }
  
  try {
    // Check if transaction is interacting with DEX routers
    const isDexInteraction = Object.values(CONFIG.DEX_ROUTERS).some(
      router => tx.to && tx.to.toLowerCase() === router.toLowerCase()
    );
    
    if (isDexInteraction) {
      // Process DEX interaction
      processDexTransaction(tx);
    }
    
    // Check if transaction is interacting with Zora contracts
    const isZoraInteraction = Object.values(CONFIG.ZORA_CONTRACTS).some(
      contract => tx.to && tx.to.toLowerCase() === contract.toLowerCase()
    );
    
    if (isZoraInteraction) {
      // Process Zora interaction
      processZoraTransaction(tx);
    }
    
    // Check for ERC20 token transfers
    if (!isDexInteraction && !isZoraInteraction) {
      processErc20Transaction(tx);
    }
    
    // Notify listeners
    for (const listener of listeners.values()) {
      if (listener.filter(tx)) {
        listener.callback(tx);
      }
    }
  } catch (error) {
    console.error(`Error processing transaction ${tx.hash}:`, error);
  }
}

/**
 * Process a confirmed transaction
 * @param {Object} tx - Transaction object
 */
function processConfirmedTransaction(tx) {
  // Process the same way as pending transactions
  processTransaction(tx);
  
  // Additional processing for confirmed transactions
  try {
    // Check for copy trade targets
    checkCopyTradeTargets(tx);
  } catch (error) {
    console.error(`Error processing confirmed transaction ${tx.hash}:`, error);
  }
}

/**
 * Check for ETH transfers to monitored wallets
 * @param {Object} tx - Transaction object
 */
function checkForEthTransfers(tx) {
  // Skip if no value
  if (!tx.value || tx.value.isZero()) return;
  
  // Notify listeners interested in ETH transfers
  for (const listener of listeners.values()) {
    if (listener.type === 'eth_transfer' && listener.filter(tx)) {
      listener.callback(tx);
    }
  }
}

/**
 * Process a DEX transaction
 * @param {Object} tx - Transaction object
 */
function processDexTransaction(tx) {
  try {
    // Decode transaction data
    let decodedData;
    try {
      decodedData = aerodromeRouterInterface.parseTransaction({ data: tx.data, value: tx.value });
    } catch (error) {
      // Not a recognized function call
      return;
    }
    
    // Extract function name and arguments
    const { name: functionName, args } = decodedData;
    
    // Process based on function name
    if (functionName === 'swapExactETHForTokens') {
      // ETH to Token swap
      const amountOutMin = args.amountOutMin;
      const route = args.route;
      const to = args.to;
      const deadline = args.deadline;
      const value = tx.value;
      
      console.log(`🔄 ETH to Token swap detected: ${tx.hash}`);
      console.log(`   From: ${tx.from}`);
      console.log(`   To: ${to}`);
      console.log(`   Value: ${ethers.utils.formatEther(value)} ETH`);
      console.log(`   Output Token: ${route[0].output}`);
      
      // Notify listeners for this specific token
      notifyTokenListeners(route[0].output, tx, 'buy');
      
    } else if (functionName === 'swapExactTokensForETH') {
      // Token to ETH swap
      const amountIn = args.amountIn;
      const amountOutMin = args.amountOutMin;
      const route = args.route;
      const to = args.to;
      const deadline = args.deadline;
      
      console.log(`🔄 Token to ETH swap detected: ${tx.hash}`);
      console.log(`   From: ${tx.from}`);
      console.log(`   To: ${to}`);
      console.log(`   Input Token: ${route[0].input}`);
      console.log(`   Amount In: ${amountIn.toString()}`);
      
      // Notify listeners for this specific token
      notifyTokenListeners(route[0].input, tx, 'sell');
      
    } else if (functionName === 'swapExactTokensForTokens') {
      // Token to Token swap
      const amountIn = args.amountIn;
      const amountOutMin = args.amountOutMin;
      const route = args.route;
      const to = args.to;
      const deadline = args.deadline;
      
      console.log(`🔄 Token to Token swap detected: ${tx.hash}`);
      console.log(`   From: ${tx.from}`);
      console.log(`   To: ${to}`);
      console.log(`   Input Token: ${route[0].input}`);
      console.log(`   Output Token: ${route[route.length - 1].output}`);
      
      // Notify listeners for both tokens
      notifyTokenListeners(route[0].input, tx, 'sell');
      notifyTokenListeners(route[route.length - 1].output, tx, 'buy');
    }
  } catch (error) {
    console.error(`Error processing DEX transaction ${tx.hash}:`, error);
  }
}

/**
 * Process a Zora transaction
 * @param {Object} tx - Transaction object
 */
function processZoraTransaction(tx) {
  try {
    // Check if transaction is to Zora Factory
    if (tx.to && tx.to.toLowerCase() === CONFIG.ZORA_CONTRACTS.FACTORY.toLowerCase()) {
      processZoraFactoryTransaction(tx);
    }
    
    // Check for Zora token transfers (ERC-1155)
    processZoraTokenTransaction(tx);
  } catch (error) {
    console.error(`Error processing Zora transaction ${tx.hash}:`, error);
  }
}

/**
 * Process a Zora Factory transaction
 * @param {Object} tx - Transaction object
 */
function processZoraFactoryTransaction(tx) {
  try {
    // Decode transaction data
    let decodedData;
    try {
      decodedData = zoraFactoryInterface.parseTransaction({ data: tx.data });
    } catch (error) {
      // Not a recognized function call
      return;
    }
    
    // Extract function name and arguments
    const { name: functionName, args } = decodedData;
    
    console.log(`🎨 Zora Factory transaction detected: ${tx.hash}`);
    console.log(`   Function: ${functionName}`);
    console.log(`   From: ${tx.from}`);
    
    // Notify listeners
    for (const listener of listeners.values()) {
      if (listener.type === 'zora_factory' && listener.filter(tx)) {
        listener.callback(tx, { functionName, args });
      }
    }
  } catch (error) {
    console.error(`Error processing Zora Factory transaction ${tx.hash}:`, error);
  }
}

/**
 * Process a Zora Token transaction (ERC-1155)
 * @param {Object} tx - Transaction object
 */
function processZoraTokenTransaction(tx) {
  // This would require checking for ERC-1155 transfer events in transaction receipts
  // For pending transactions, we can't access events yet
  
  // For now, we'll just log the transaction
  console.log(`🎨 Potential Zora token transaction detected: ${tx.hash}`);
}

/**
 * Process an ERC20 transaction
 * @param {Object} tx - Transaction object
 */
function processErc20Transaction(tx) {
  try {
    // Try to decode as ERC20 transaction
    let decodedData;
    try {
      decodedData = erc20Interface.parseTransaction({ data: tx.data });
    } catch (error) {
      // Not a recognized ERC20 function call
      return;
    }
    
    // Extract function name and arguments
    const { name: functionName, args } = decodedData;
    
    // Process based on function name
    if (functionName === 'transfer') {
      const to = args.to;
      const amount = args.amount;
      
      console.log(`💸 ERC20 transfer detected: ${tx.hash}`);
      console.log(`   Token: ${tx.to}`);
      console.log(`   From: ${tx.from}`);
      console.log(`   To: ${to}`);
      console.log(`   Amount: ${amount.toString()}`);
      
      // Notify token listeners
      notifyTokenListeners(tx.to, tx, 'transfer');
      
    } else if (functionName === 'approve') {
      const spender = args.spender;
      const amount = args.amount;
      
      console.log(`✅ ERC20 approval detected: ${tx.hash}`);
      console.log(`   Token: ${tx.to}`);
      console.log(`   Owner: ${tx.from}`);
      console.log(`   Spender: ${spender}`);
      console.log(`   Amount: ${amount.toString()}`);
    }
  } catch (error) {
    console.error(`Error processing ERC20 transaction ${tx.hash}:`, error);
  }
}

/**
 * Notify listeners for a specific token
 * @param {string} tokenAddress - Token address
 * @param {Object} tx - Transaction object
 * @param {string} action - Action type ('buy', 'sell', 'transfer')
 */
function notifyTokenListeners(tokenAddress, tx, action) {
  for (const listener of listeners.values()) {
    if (listener.type === 'token' && 
        listener.tokenAddress && 
        listener.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) {
      listener.callback(tx, { tokenAddress, action });
    }
  }
}

/**
 * Check for copy trade targets
 * @param {Object} tx - Transaction object
 */
async function checkCopyTradeTargets(tx) {
  try {
    // Get active copy trades for this wallet
    const activeCopyTrades = await CopyTradeOps.getActiveTargetCopyTrades(tx.from.toLowerCase());
    
    if (activeCopyTrades.length > 0) {
      console.log(`👥 Transaction from copy trade target detected: ${tx.hash}`);
      console.log(`   Target wallet: ${tx.from}`);
      console.log(`   Number of followers: ${activeCopyTrades.length}`);
      
      // Notify copy trade listeners
      for (const listener of listeners.values()) {
        if (listener.type === 'copy_trade') {
          listener.callback(tx, { targetWallet: tx.from, copyTrades: activeCopyTrades });
        }
      }
    }
  } catch (error) {
    console.error(`Error checking copy trade targets for ${tx.hash}:`, error);
  }
}

/**
 * Add a transaction listener
 * @param {string} id - Unique identifier for the listener
 * @param {string} type - Listener type ('token', 'eth_transfer', 'zora_factory', 'copy_trade')
 * @param {Function} filter - Function to filter transactions
 * @param {Function} callback - Callback function to execute when a transaction matches the filter
 * @param {Object} options - Additional options (e.g., tokenAddress)
 * @returns {boolean} - True if added successfully
 */
function addListener(id, type, filter, callback, options = {}) {
  if (!id || !type || !filter || !callback) {
    console.error('❌ Invalid listener parameters');
    return false;
  }
  
  listeners.set(id, { type, filter, callback, ...options });
  return true;
}

/**
 * Remove a transaction listener
 * @param {string} id - Unique identifier for the listener
 * @returns {boolean} - True if removed successfully
 */
function removeListener(id) {
  if (!id) {
    console.error('❌ Invalid listener ID');
    return false;
  }
  
  return listeners.delete(id);
}

/**
 * Check if monitoring is active
 * @returns {boolean} - True if monitoring is active
 */
function isActive() {
  return isMonitoring;
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  addListener,
  removeListener,
  isActive
}; 