/**
 * Wrapper for the MempoolMonitor service
 * This adds additional error handling and address validation to the original mempoolMonitor service
 * Can be imported from both CommonJS and ESM modules
 */

// Define validation function that doesn't rely on external dependencies
function isValidEthereumAddress(address) {
  try {
    if (!address) return false;
    if (typeof address !== 'string') return false;
    if (!address.startsWith('0x')) return false;
    if (address.length !== 42) return false;  // Ethereum addresses are 42 chars (0x + 40 hex chars)
    
    // Use regex to check if it's a valid hex string after 0x
    const hexRegex = /^0x[0-9a-fA-F]{40}$/;
    if (!hexRegex.test(address)) return false;
    
    // Further validation would happen in ethers.utils.getAddress
    return true;
  } catch (error) {
    console.warn(`⚠️ Invalid Ethereum address detected: ${address}`);
    return false;
  }
}

// Try to import the original mempool monitor
let originalMonitor;
try {
  // Use CommonJS require
  originalMonitor = require('./mempoolMonitor');
} catch (err) {
  console.warn('Could not require mempoolMonitor.js:', err.message);
  // Try our fixed CommonJS version
  try {
    originalMonitor = require('./mempoolMonitor.cjs');
  } catch (err2) {
    console.error('Failed to load any version of mempoolMonitor:', err2.message);
  }
}

// Safely wrapped methods
const safeMonitor = {
  startMonitoring: async function() {
    try {
      console.log('🔒 Starting safe mempool monitoring...');
      if (originalMonitor && typeof originalMonitor.startMonitoring === 'function') {
        return await originalMonitor.startMonitoring();
      }
      console.error('❌ Original mempool monitor not available');
      return false;
    } catch (error) {
      console.error('❌ Error in startMonitoring:', error);
      return false;
    }
  },
  
  stopMonitoring: function() {
    try {
      console.log('🛑 Safely stopping mempool monitoring...');
      if (originalMonitor && typeof originalMonitor.stopMonitoring === 'function') {
        return originalMonitor.stopMonitoring();
      }
      return false;
    } catch (error) {
      console.error('❌ Error in stopMonitoring:', error);
      return false;
    }
  },
  
  isActive: function() {
    try {
      if (originalMonitor && typeof originalMonitor.isActive === 'function') {
        return originalMonitor.isActive();
      }
      return false;
    } catch (error) {
      console.error('❌ Error in isActive:', error);
      return false;
    }
  },
  
  // Add the validation function directly
  isValidEthereumAddress,
  
  // Events passthrough
  get mempoolEvents() {
    if (originalMonitor) {
      return originalMonitor.mempoolEvents;
    }
    // Return empty emitter if original not available
    return { on: () => {}, emit: () => {}, once: () => {} };
  }
};

// Export in CommonJS style
module.exports = safeMonitor;