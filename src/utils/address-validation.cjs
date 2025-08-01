/**
 * Ethereum address validation utilities
 * 
 * This file provides utilities for validating Ethereum addresses safely.
 * Using .js extension to avoid ESM import issues.
 */
const ethers = require('ethers');

/**
 * Safely validates an Ethereum address without throwing exceptions
 * @param {string} address - Address to validate
 * @returns {boolean} - True if address is valid
 */
function isValidEthereumAddress(address) {
  try {
    if (!address) return false;
    if (typeof address !== 'string') return false;
    if (!address.startsWith('0x')) return false;
    if (address.length !== 42) return false;  // Ethereum addresses are 42 chars (0x + 40 hex chars)
    
    // Final validation using ethers utils
    const checksumAddress = ethers.utils.getAddress(address);
    return true;
  } catch (error) {
    console.warn(`⚠️ Invalid Ethereum address detected: ${address}`);
    console.warn(`⚠️ Error: ${error.message}`);
    return false;
  }
}

/**
 * Validates an Ethereum address and returns a formatted version or null
 * @param {string} address - Address to validate and format
 * @returns {string|null} - Formatted address or null if invalid
 */
function validateAndFormatAddress(address) {
  try {
    if (!isValidEthereumAddress(address)) return null;
    return ethers.utils.getAddress(address); // Return checksum address
  } catch (error) {
    return null;
  }
}

/**
 * Creates a wrapped Ethereum provider that validates addresses
 * @param {string} providerUrl - RPC provider URL
 * @returns {Object} - Wrapped provider with safe methods
 */
function createSafeProvider(providerUrl) {
  const provider = new ethers.providers.JsonRpcProvider(providerUrl);
  
  return {
    // Original provider (use with caution)
    raw: provider,
    
    // Safe getTransaction that validates addresses
    getTransaction: async function(txHash) {
      try {
        const tx = await provider.getTransaction(txHash);
        if (!tx) return null;
        
        // Validate addresses before returning
        if (tx.from && !isValidEthereumAddress(tx.from)) {
          console.warn(`⚠️ Transaction ${txHash} has invalid 'from' address: ${tx.from}`);
          return null;
        }
        
        if (tx.to && !isValidEthereumAddress(tx.to)) {
          console.warn(`⚠️ Transaction ${txHash} has invalid 'to' address: ${tx.to}`);
          return null;
        }
        
        return tx;
      } catch (error) {
        console.error(`❌ Error getting transaction ${txHash}:`, error);
        return null;
      }
    },
    
    // More safe methods can be added here...
  };
}

module.exports = {
  isValidEthereumAddress,
  validateAndFormatAddress,
  createSafeProvider
};