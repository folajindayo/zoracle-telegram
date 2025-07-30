/**
 * Common utility functions
 */
import * as crypto from 'crypto';
import { CONFIG  } from '../config';

/**
 * Shortens an Ethereum address for display
 * @param {string} address - Ethereum address
 * @returns {string} Shortened address
 */
function shortenAddress(address): any {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Encrypts data using AES-256-CBC
 * @param {string} data - Data to encrypt
 * @param {string} key - Encryption key (defaults to MASTER_KEY)
 * @returns {string} Encrypted data
 */
function encryptData(data, key = process.env.MASTER_KEY): any {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts data using AES-256-CBC
 * @param {string} encryptedData - Data to decrypt
 * @param {string} key - Decryption key (defaults to MASTER_KEY)
 * @returns {string} Decrypted data
 */
function decryptData(encryptedData, key = process.env.MASTER_KEY): any {
  const textParts = encryptedData.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * Formats a number with commas as thousands separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num): any {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats an amount of ETH with specified precision
 * @param {string|number} amount - Amount in ETH
 * @param {number} precision - Decimal precision
 * @returns {string} Formatted ETH amount
 */
function formatEth(amount, precision = 4): any {
  const num = parseFloat(amount);
  return num.toFixed(precision);
}

/**
 * Generates a random delay within a range
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {number} Random delay in milliseconds
 */
function randomDelay(min = 500, max = 3000): any {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Sleep function for async/await
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after ms milliseconds
 */
function sleep(ms): any {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { 
  shortenAddress,
  encryptData,
  decryptData,
  formatNumber,
  formatEth,
  randomDelay,
  sleep
 }; 