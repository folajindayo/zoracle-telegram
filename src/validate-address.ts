/**
 * Ethereum address validation test script
 */
import { ethers } from 'ethers';

/**
 * Safely validates an Ethereum address without throwing exceptions
 * @param {string} address - Address to validate
 * @returns {boolean} - True if address is valid
 */
function isValidEthereumAddress(address: string): boolean {
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

// Test addresses - the one from the error and a valid one
const addresses = [
  '0xdef0123456789abcdef0123456789abcdef0123', // Invalid address from error
  '0x27cEe32550DcC30De5a23551bAF7de2f3b0b98A0'  // Valid address from config
];

// Validate addresses
console.log('🔍 Testing address validation:');
for (const address of addresses) {
  console.log(`\nAddress: ${address}`);
  
  console.log('Using our custom validator:');
  const isValid = isValidEthereumAddress(address);
  console.log(`✓ Is valid: ${isValid}`);
  
  console.log('Using direct ethers.js validation:');
  try {
    const checksumAddress = ethers.utils.getAddress(address);
    console.log(`✓ Valid (checksum: ${checksumAddress})`);
  } catch (error) {
    console.log(`✗ Invalid: ${error.message}`);
  }
}

console.log('\n✅ Address validation test complete.');