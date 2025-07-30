// Base Chain Telegram Bot - Enhanced with all features
require('dotenv').config();
const { ethers } = require('ethers');
const crypto = require('crypto');
const { Wallet, Contract, constants } = require('ethers');
const { formatEther, parseEther, formatUnits } = require('ethers/lib/utils');

// Import configuration
const { CONFIG, ABIS } = require('../config');

// Environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const MASTER_KEY = process.env.MASTER_KEY;

// Provider setup
const provider = new ethers.providers.JsonRpcProvider(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);

// In-memory user storage (use a database in production)
const users = new Map();
const conversationStates = new Map(); // For onboarding wizard

/**
 * Encrypt sensitive data using the master key
 * @param {string} data - Data to encrypt
 * @returns {string} - Encrypted data
 */
function encryptData(data) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(MASTER_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data using the master key
 * @param {string} encryptedData - Data to decrypt
 * @returns {string} - Decrypted data
 */
function decryptData(encryptedData) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(MASTER_KEY, 'hex');
  
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Create a new wallet
 * @returns {Object} - Wallet object with address and privateKey
 */
function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey
  };
}

/**
 * Import a wallet from private key
 * @param {string} privateKey - Private key to import
 * @returns {Object} - Wallet object with address and privateKey
 */
function importWallet(privateKey) {
  try {
    const wallet = new ethers.Wallet(privateKey);
    return {
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  } catch (error) {
    throw new Error('Invalid private key');
  }
}

/**
 * Get ETH balance for a wallet
 * @param {string} address - Wallet address
 * @returns {Promise<string>} - ETH balance formatted as string
 */
async function getEthBalance(address) {
  try {
    const balance = await provider.getBalance(address);
    return formatEther(balance);
  } catch (error) {
    throw new Error(`Error getting balance: ${error.message}`);
  }
}

/**
 * Get token balance for a wallet
 * @param {string} tokenAddress - Token contract address
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<string>} - Token balance formatted as string
 */
async function getTokenBalance(tokenAddress, walletAddress) {
  try {
    const tokenContract = new Contract(tokenAddress, ABIS.ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const decimals = await tokenContract.decimals();
    return formatUnits(balance, decimals);
  } catch (error) {
    throw new Error(`Error getting token balance: ${error.message}`);
  }
}

/**
 * Get token info (name, symbol, decimals)
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} - Token info object
 */
async function getTokenInfo(tokenAddress) {
  try {
    const tokenContract = new Contract(tokenAddress, ABIS.ERC20_ABI, provider);
    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals()
    ]);
    
    return { name, symbol, decimals };
  } catch (error) {
    throw new Error(`Error getting token info: ${error.message}`);
  }
}

// Export for external use
module.exports = {
  users,
  provider,
  token,
  MASTER_KEY,
  encryptData,
  decryptData,
  createWallet,
  importWallet,
  getEthBalance,
  getTokenBalance,
  getTokenInfo
}; 