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
let failoverAttempts = 0;

// Alternative RPC URLs for failover
const FALLBACK_PROVIDERS = [
  'https://mainnet.base.org',
  'https://base.llamarpc.com', 
  'https://base.rpc.blxrbdn.com',
  'https://1rpc.io/base' // Additional fallback
];

// Rate limiting for Ankr API
const API_CALLS = {
  count: 0,
  lastReset: Date.now(),
  window: 60000, // 1 minute window
  limit: 250 // Ankr free tier typically allows ~250-300 requests per minute
};

// Initialize provider with rate limiting and fallback options
function initProvider(): any {
  try {
    // Check if we need to reset our rate limit counter
    const now = Date.now();
    if (now - API_CALLS.lastReset > API_CALLS.window) {
      API_CALLS.count = 0;
      API_CALLS.lastReset = now;
    }

    // If we've had multiple failures, try a failover provider
    let providerUrl = CONFIG.PROVIDER_URL;
    let isAnkrProvider = true;
    
    if (failoverAttempts > 0 && failoverAttempts <= FALLBACK_PROVIDERS.length) {
      const fallbackIndex = (failoverAttempts - 1) % FALLBACK_PROVIDERS.length;
      providerUrl = FALLBACK_PROVIDERS[fallbackIndex];
      console.log(`🔄 Using failover provider (${failoverAttempts}): ${providerUrl}`);
      isAnkrProvider = false; // Mark as non-Ankr provider
    }
    
    // Create provider without custom options (ethers v5 doesn't support options as 3rd param)
    provider = new ethers.providers.JsonRpcProvider(providerUrl);
    
    // Set up rate limiting logic for Ankr
    if (isAnkrProvider) {
      console.log('⚙️ Setting up rate limiting for Ankr provider');
      
      // Create a wrapper for the send method to implement rate limiting
      const originalSend = provider.send.bind(provider);
      provider.send = async function(method, params) {
        // Check if we're near the rate limit
        if (API_CALLS.count >= API_CALLS.limit) {
          const waitTime = API_CALLS.window - (Date.now() - API_CALLS.lastReset) + 100;
          if (waitTime > 0) {
            console.log(`⚠️ Rate limit reached, waiting ${waitTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            // Reset counter after waiting
            API_CALLS.count = 0;
            API_CALLS.lastReset = Date.now();
          }
        }
        
        // Increment the counter for each API call
        API_CALLS.count++;
        
        // Call the original send method
        return originalSend(method, params);
      };
    }
    
    // Add global error handler for provider
    provider.on('error', (error) => {
      console.error('❌ Mempool monitor provider error:', error);
      
      // Check for rate limiting errors specifically
      if (error.message && (
        error.message.includes('429') || 
        error.message.includes('too many requests') || 
        error.message.includes('rate limit')
      )) {
        console.log('⚠️ Rate limit detected, waiting before retry');
        setTimeout(() => {
          console.log('🔄 Retrying after rate limit cooldown');
          initProvider();
        }, 60000); // Wait a full minute
        return;
      }
      
      // For other errors, increment failover attempts
      failoverAttempts++;
      
      // Attempt to recover by reinitializing the provider after a delay
      setTimeout(() => {
        console.log('🔄 Attempting to reinitialize mempool monitor provider...');
        initProvider();
      }, 5000);
    });
    
    // Test the provider with a basic call
    provider.getBlockNumber().then(() => {
      console.log('✅ Mempool monitor provider initialized and verified');
      // Reset failover attempts on success
      failoverAttempts = 0;
      
      // Log provider info
      console.log(`📊 Using ${isAnkrProvider ? 'Ankr' : 'alternative'} RPC provider: ${
        providerUrl.substring(0, providerUrl.indexOf('/base') + 5)}...`);
    }).catch(error => {
      console.error('❌ Provider verification failed:', error.message);
      failoverAttempts++;
      
      // Try next provider
      setTimeout(() => {
        console.log('🔄 Provider verification failed. Trying next provider...');
        initProvider();
      }, 2000);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize mempool monitor provider:', error);
    
    // Increment failover attempts
    failoverAttempts++;
    
    if (failoverAttempts <= FALLBACK_PROVIDERS.length) {
      // Try next provider after a short delay
      setTimeout(() => {
        console.log('🔄 Trying next provider...');
        initProvider();
      }, 2000);
    }
    
    return false;
  }
}

/**
 * Optimized for Ankr: Pending tx hashes to be processed in batch
 */
let pendingTxQueue = [];
let processingPending = false;
let lastProcessedBlock = 0;

/**
 * Start monitoring the mempool for transactions
 * Optimized for Ankr's free tier with batching
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

  console.log('🔍 Starting mempool monitoring with Ankr optimization...');
  
  // Start with polling instead of event subscription
  // This is more reliable with Ankr's free tier
  console.log('⚙️ Configuring block polling for Ankr compatibility');
  
  // Poll for new blocks instead of using events
  // This is more efficient for Ankr's free tier
  blockPollIntervalId = setInterval(async () => {
    try {
      const blockNumber = await provider.getBlockNumber();
      if (blockNumber > lastProcessedBlock) {
        console.log(`📦 New block detected: ${blockNumber}`);
        lastProcessedBlock = blockNumber;
        processNewBlock(blockNumber);
      }
    } catch (error) {
      console.warn('⚠️ Block polling error:', error.message);
    }
  }, 10000); // Poll every 10 seconds
  
  // Use a limited pending transaction monitoring approach
  // We'll only get a sample of pending transactions to stay within rate limits
  let pendingMonitorActive = true;
  
  // Setup pending transaction monitoring with sampling
  const pendingTxMonitor = async () => {
    if (!pendingMonitorActive) return;
    
    try {
      // Ask for pending transactions from mempool
      // Note: This is not supported by all RPC providers including Ankr free tier
      // So we're using a fallback approach that doesn't depend on pending tx events
      const pendingTxs = await provider.send('eth_pendingTransactions', []);
      
      // Take a small sample to avoid rate limiting
      if (Array.isArray(pendingTxs) && pendingTxs.length > 0) {
        // Process up to 5 transactions per poll to stay within limits
        const sampleSize = Math.min(5, pendingTxs.length);
        for (let i = 0; i < sampleSize; i++) {
          const txIndex = Math.floor(Math.random() * pendingTxs.length);
          if (pendingTxs[txIndex] && pendingTxs[txIndex].hash) {
            processPendingTransaction(pendingTxs[txIndex].hash);
          }
        }
      }
    } catch (error) {
      // Most free RPCs don't support eth_pendingTransactions so this is expected to fail
      // console.warn('Pending tx monitoring not supported by this provider:', error.message);
      
      // Switch to a block-only strategy after a few failed attempts
      pendingMonitorActive = false;
    }
    
    // Continue monitoring if active
    if (pendingMonitorActive) {
      setTimeout(pendingTxMonitor, 15000); // Poll every 15 seconds
    } else {
      console.log('ℹ️ Switched to block-only monitoring (pending tx monitoring not supported)');
    }
  };
  
  // Start pending transaction monitoring
  pendingTxMonitor();

  isMonitoring = true;
  return true;
}

// Store intervals for cleanup
let blockPollIntervalId = null;

/**
 * Stop monitoring the mempool
 */
function stopMonitoring(): any {
  if (!isMonitoring) {
    console.log('⚠️ Mempool monitoring not active');
    return false;
  }

  console.log('🛑 Stopping mempool monitoring...');
  
  // Clear polling intervals
  if (blockPollIntervalId) {
    clearInterval(blockPollIntervalId);
    blockPollIntervalId = null;
  }
  
  // Clear any pending operations
  pendingTxQueue = [];
  processingPending = false;
  
  // For safety, also remove any event listeners
  if (provider) {
    provider.removeAllListeners();
  }
  
  isMonitoring = false;
  console.log('✅ Mempool monitoring stopped');
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
    // Get transaction details with retry mechanism
    let tx;
    try {
      tx = await retryWithBackoff(async () => {
        const result = await provider.getTransaction(txHash);
        if (!result) throw new Error(`Transaction ${txHash} not found`);
        return result;
      }, 2, 500); // Fewer retries and shorter delay for pending tx
    } catch (providerError) {
      // This specifically handles provider errors like invalid address format
      console.warn(`⚠️ Provider error for transaction ${txHash} after retries:`, providerError.message);
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
/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise<any>} - Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000): Promise<any> {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

async function processNewBlock(blockNumber): Promise<any> {
  try {
    // Get block details with retry mechanism
    let block;
    try {
      block = await retryWithBackoff(async () => {
        const result = await provider.getBlock(blockNumber, true);
        if (!result) throw new Error(`Block ${blockNumber} not found`);
        return result;
      });
    } catch (providerError) {
      console.warn(`⚠️ Provider error for block ${blockNumber} after retries:`, providerError.message);
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
function isDEXInteraction(tx): any {
  if (!tx || !tx.to || !isValidEthereumAddress(tx.to)) return false;
  
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
  if (!tx || !tx.to || !isValidEthereumAddress(tx.to)) return false;
  
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

/**
 * Safely validates an Ethereum address without throwing exceptions
 * @param {string} address - Address to validate
 * @returns {boolean} - True if address is valid
 */
function isValidEthereumAddress(address): boolean {
  try {
    if (!address) return false;
    if (typeof address !== 'string') return false;
    if (!address.startsWith('0x')) return false;
    if (address.length !== 42) return false;  // Ethereum addresses are 42 chars (0x + 40 hex chars)
    
    // Final validation using ethers utils
    const checksumAddress = ethers.utils.getAddress(address);
    return true;
  } catch (error) {
    // If ethers.utils.getAddress throws, the address is invalid
    return false;
  }
}

export { 
  startMonitoring,
  stopMonitoring,
  isActive,
  mempoolEvents
}; 