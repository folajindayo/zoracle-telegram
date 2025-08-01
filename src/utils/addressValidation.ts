/**
 * Ethereum address validation utilities
 */
import { ethers } from 'ethers';

/**
 * Safely validates an Ethereum address without throwing exceptions
 * @param {string} address - Address to validate
 * @returns {boolean} - True if address is valid
 */
export function isValidEthereumAddress(address: string): boolean {
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
export function validateAndFormatAddress(address: string): string | null {
  try {
    if (!isValidEthereumAddress(address)) return null;
    return ethers.utils.getAddress(address); // Return checksum address
  } catch (error) {
    return null;
  }
}