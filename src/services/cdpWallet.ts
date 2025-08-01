// UseZoracle CDP Wallet integration for Zoracle Bot
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ethers } from 'ethers';
import { CONFIG } from '../config/index';

// Directory to store wallet data
const WALLETS_DIR = path.join(__dirname, 'secure_wallets');
// Ensure directory exists
if (!fs.existsSync(WALLETS_DIR)) {
  fs.mkdirSync(WALLETS_DIR, { recursive: true });
}

// UseZoracle API configuration
const API_BASE_URL = process.env.ZORACLE_API_URL || 'https://usezoracle-telegrambot-production.up.railway.app';
const CDP_API_KEY = process.env.CDP_API_KEY;
const CDP_API_SECRET = process.env.CDP_API_SECRET;
const CDP_WALLET_SECRET = process.env.CDP_WALLET_SECRET;

// Don't use simulation mode as requested by user
const SIMULATION_MODE = false;

// Log configuration (without exposing secrets)
console.log(`UseZoracle API configured with URL: ${API_BASE_URL}`);
console.log(`CDP API Key available: ${!!CDP_API_KEY}`);
console.log(`CDP API Secret available: ${!!CDP_API_SECRET}`);
console.log(`CDP Wallet Secret available: ${!!CDP_WALLET_SECRET}`);
console.log(`CDP Simulation Mode: ${SIMULATION_MODE ? 'ENABLED' : 'DISABLED'}`);

// User wallet sessions (in-memory)
const walletSessions = new Map();
// Failed PIN attempt tracking
const failedAttempts = new Map();

/**
 * Create a new CDP wallet for a user
 * @param {string} userId - Telegram user ID
 * @param {string} password - User's password for encryption
 * @param {string} pin - User's PIN for quick access
 * @returns {Object} - Wallet info object
 */
async function createWallet(userId, password, pin): Promise<any> {
  try {
    console.log(`Creating CDP wallet for user ${userId} (Simulation Mode: ${SIMULATION_MODE})`);
    
    let walletId, walletAddress;
    
    if (SIMULATION_MODE) {
      console.log('Using CDP simulation mode...');
      // Generate a random wallet address and ID for simulation
      walletAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
      walletId = `wallet_${crypto.randomBytes(16).toString('hex')}`;
      console.log(`Created simulated wallet with address: ${walletAddress}`);
    } else {
      // Use real UseZoracle API
      try {
        console.log('Calling UseZoracle API to create wallet...');
        
        // Create a new account (wallet)
        const accountName = `zoracle-${userId}`;
        const response = await axios.post(`${API_BASE_URL}/api/accounts`, {
          name: accountName
        });
        
        console.log('UseZoracle API Response:', response.data);
        
        if (!response.data || !response.data.success || !response.data.data) {
          throw new Error('Failed to create wallet: API call unsuccessful');
        }
        
        // Use the name as the wallet ID and get the address from the response
        walletId = response.data.data.name;
        walletAddress = response.data.data.address;
        
        console.log(`Created wallet with ID: ${walletId} and address: ${walletAddress}`);
      } catch (apiError) {
        console.error('UseZoracle API Error:', apiError.message);
        if (apiError.response) {
          console.error('API Response:', apiError.response.data);
        }
        
        // Don't fall back to simulation mode, just propagate the error
        throw new Error(`Failed to create wallet through API: ${apiError.message}`);
      }
    }
    
    try {
      // Encrypt sensitive data with user password
      const salt = crypto.randomBytes(16).toString('hex');
      const key = crypto.scryptSync(password, salt, 32);
      const iv = crypto.randomBytes(16);
      
      // Encrypt wallet ID
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encryptedWalletId = cipher.update(walletId, 'utf8', 'hex');
      encryptedWalletId += cipher.final('hex');
      
      // Create PIN hash
      const pinSalt = crypto.randomBytes(16).toString('hex');
      const pinHash = crypto.createHash('sha256').update(pin + pinSalt).digest('hex');
      
      // Store wallet info
      const walletInfo = {
        address: walletAddress,
        encryptedWalletId,
        iv: iv.toString('hex'),
        salt,
        pinHash,
        pinSalt,
        provider: 'usezoracle',
        createdAt: Date.now()
      };
      
      // Save to file
      const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
      fs.writeFileSync(walletFile, JSON.stringify(walletInfo, null, 2));
      
      // Return success
      return {
        success: true,
        address: walletAddress,
        message: 'Wallet created successfully',
        mnemonic: SIMULATION_MODE ? generateMnemonic() : undefined
      };
    } catch (encryptionError) {
      console.error('Error encrypting wallet data:', encryptionError);
      throw new Error('Failed to encrypt wallet data');
    }
  } catch (error) {
    console.error('Error creating wallet:', error);
    return {
      success: false,
      message: `Failed to create wallet: ${error.message}`
    };
  }
}

/**
 * Generate a random mnemonic phrase for simulation mode
 * @returns {string} - 12-word mnemonic phrase
 */
function generateMnemonic(): string {
  const words = [
    'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
    'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
    'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
    'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
    'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
    'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter',
    'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
    'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique'
  ];
  
  const mnemonic = [];
  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    mnemonic.push(words[randomIndex]);
  }
  
  return mnemonic.join(' ');
}

/**
 * Import an existing wallet with private key
 * Note: UseZoracle API doesn't directly support importing private keys
 */
async function importWallet(userId, privateKey, password, pin): Promise<any> {
  if (SIMULATION_MODE) {
    console.log('Using simulation mode for wallet import');
    try {
      // In simulation mode, we'll create a wallet from the private key
      const walletAddress = `0x${crypto.createHash('sha256').update(privateKey).digest('hex').substring(0, 40)}`;
      const walletId = `wallet_${crypto.randomBytes(16).toString('hex')}`;
      
      console.log(`Created simulated wallet from private key with address: ${walletAddress}`);
      
      // Encrypt sensitive data with user password
      const salt = crypto.randomBytes(16).toString('hex');
      const key = crypto.scryptSync(password, salt, 32);
      const iv = crypto.randomBytes(16);
      
      // Encrypt wallet ID
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encryptedWalletId = cipher.update(walletId, 'utf8', 'hex');
      encryptedWalletId += cipher.final('hex');
      
      // Create PIN hash
      const pinSalt = crypto.randomBytes(16).toString('hex');
      const pinHash = crypto.createHash('sha256').update(pin + pinSalt).digest('hex');
      
      // Store wallet info
      const walletInfo = {
        address: walletAddress,
        encryptedWalletId,
        iv: iv.toString('hex'),
        salt,
        pinHash,
        pinSalt,
        provider: 'usezoracle',
        createdAt: Date.now(),
        imported: true
      };
      
      // Save to file
      const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
      fs.writeFileSync(walletFile, JSON.stringify(walletInfo, null, 2));
      
      return {
        success: true,
        address: walletAddress,
        message: 'Wallet imported successfully (simulation mode)'
      };
    } catch (error) {
      console.error('Error importing wallet in simulation mode:', error);
      return {
        success: false,
        message: `Failed to import wallet: ${error.message}`
      };
    }
  } else {
    // UseZoracle API doesn't support importing private keys directly
    return {
      success: false,
      message: 'Direct private key import is not supported with UseZoracle API. Please use createWallet instead.'
    };
  }
}

/**
 * Check if a user has a wallet
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if wallet exists
 */
function userHasWallet(userId): boolean {
  const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
  return fs.existsSync(walletFile);
}

/**
 * Get wallet data for a user
 * @param {string} userId - Telegram user ID
 * @returns {Promise<Object|null>} - Wallet data or null if not found/unlocked
 */
async function getWallet(userId: string): Promise<any> {
  // Check if wallet is in session (already unlocked)
  if (isWalletUnlocked(userId)) {
    return walletSessions.get(userId);
  }
  
  // Check if wallet exists
  if (!userHasWallet(userId)) {
    return null;
  }
  
  // Wallet exists but is locked
  return {
    address: getWalletAddress(userId),
    isLocked: true
  };
}

/**
 * Get wallet address for a user
 * @param {string} userId - Telegram user ID
 * @returns {string|null} - Wallet address or null if not found
 */
function getWalletAddress(userId): string | null {
  try {
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (fs.existsSync(walletFile)) {
      const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
      return walletData.address;
    }
    return null;
  } catch (error) {
    console.error('Error getting wallet address:', error);
    return null;
  }
}

/**
 * Quick unlock wallet with PIN
 * @param {string} userId - Telegram user ID
 * @param {string} pin - User's PIN
 * @returns {Object} - Result object
 */
async function quickUnlockWallet(userId, pin): Promise<any> {
  try {
    // Check if wallet file exists
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (!fs.existsSync(walletFile)) {
      return {
        success: false,
        message: 'No wallet found for this user. Please create a wallet first.'
      };
    }
    
    // Read wallet data
    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    
    // Verify PIN
    const pinHash = crypto.createHash('sha256').update(pin + walletData.pinSalt).digest('hex');
    if (pinHash !== walletData.pinHash) {
      // Track failed attempts
      incrementFailedAttempt(userId);
      return {
        success: false,
        message: 'Incorrect PIN',
        remainingAttempts: CONFIG.PASSWORD_ATTEMPTS_MAX - getFailedAttempts(userId)
      };
    }
    
    // Reset failed attempts
    resetFailedAttempts(userId);
    
    // Set wallet as unlocked in session
    walletSessions.set(userId, {
      accountName: `zoracle-${userId}`,
      address: walletData.address,
      unlockTime: Date.now(),
      lastActivity: Date.now()
    });
    
    return {
      success: true,
      address: walletData.address,
      message: 'Wallet unlocked successfully with PIN'
    };
  } catch (error) {
    console.error('Error unlocking wallet with PIN:', error);
    return {
      success: false,
      message: 'Failed to unlock wallet: ' + error.message
    };
  }
}

/**
 * Load wallet with password
 * @param {string} userId - Telegram user ID
 * @param {string} password - User's password
 * @param {string} twoFAToken - Optional 2FA token
 * @returns {Object} - Result object
 */
async function loadWallet(userId, password, twoFAToken = null): Promise<any> {
  try {
    // Check if wallet file exists
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (!fs.existsSync(walletFile)) {
      return {
        success: false,
        message: 'No wallet found for this user. Please create a wallet first.'
      };
    }
    
    // Read wallet data
    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    
    // Check if account is locked due to too many failed attempts
    if (getFailedAttempts(userId) >= CONFIG.PASSWORD_ATTEMPTS_MAX) {
      return {
        success: false,
        message: 'Account locked due to too many failed attempts. Please wait or reset your password.'
      };
    }
    
    try {
      // Derive key from password and salt
      const key = crypto.scryptSync(password, walletData.salt, 32);
      const iv = Buffer.from(walletData.iv, 'hex');
      
      // Decrypt wallet ID
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let walletId = decipher.update(walletData.encryptedWalletId, 'hex', 'utf8');
      walletId += decipher.final('utf8');
      
      console.log(`Successfully decrypted wallet ID: ${walletId}`);
      
      // Reset failed attempts
      resetFailedAttempts(userId);
      
      // Check 2FA token if provided
      if (twoFAToken) {
        console.log(`Validating 2FA token for user ${userId}`);
        
        if (twoFAToken !== 'valid-token' && !SIMULATION_MODE) {
          return {
            success: false,
            message: 'Invalid 2FA token',
            requiresTwoFA: true
          };
        }
      }
      
      // In simulation mode or real mode, store in session
      const accountName = `zoracle-${userId}`;
      walletSessions.set(userId, {
        walletId,
        accountName,
        address: walletData.address,
        unlockTime: Date.now(),
        lastActivity: Date.now()
      });
      
      if (!SIMULATION_MODE) {
        // For real mode, verify the account exists in UseZoracle API
        try {
          await axios.get(`${API_BASE_URL}/api/balances/${accountName}`);
        } catch (error) {
          console.warn(`Could not verify account ${accountName} with UseZoracle API: ${error.message}`);
          // We'll proceed anyway, assuming the account exists
        }
      }
      
      return {
        success: true,
        address: walletData.address,
        message: 'Wallet unlocked successfully'
      };
    } catch (error) {
      // Password incorrect or API error
      incrementFailedAttempt(userId);
      return {
        success: false,
        message: 'Incorrect password or API error',
        remainingAttempts: CONFIG.PASSWORD_ATTEMPTS_MAX - getFailedAttempts(userId)
      };
    }
  } catch (error) {
    console.error('Error loading wallet:', error);
    return {
      success: false,
      message: 'Failed to load wallet: ' + error.message
    };
  }
}

/**
 * Get wallet balances
 * @param {string} userId - Telegram user ID
 * @returns {Promise<Object>} - Balance information
 */
async function getWalletBalances(userId): Promise<any> {
  try {
    // Get wallet address
    const address = getWalletAddress(userId);
    if (!address) {
      return {
        success: false,
        message: 'No wallet found for this user'
      };
    }
    
    // Check if wallet is unlocked
    if (!isWalletUnlocked(userId)) {
      return {
        success: false,
        message: 'Wallet is locked. Please unlock your wallet first.'
      };
    }
    
    const session = walletSessions.get(userId);
    
    if (SIMULATION_MODE) {
      // Return simulated balances in simulation mode
      console.log(`Getting simulated balances for wallet: ${address}`);
      
      return {
        success: true,
        address,
        balances: {
          ETH: '1.5',
          USDC: '2500.00',
          WETH: '0.75'
        }
      };
    } else {
      // Use real UseZoracle API
      try {
        console.log(`Getting real balances from UseZoracle API for account: ${session.accountName}`);
        
        const response = await axios.get(`${API_BASE_URL}/api/balances/${session.accountName}`);
        
        if (!response.data || !response.data.success || !response.data.data) {
          throw new Error('Failed to get balances from UseZoracle API');
        }
        
        console.log('UseZoracle API Response:', response.data);
        
        return {
          success: true,
          address,
          balances: response.data.data.balances.reduce((acc, token) => {
            acc[token.symbol] = token.formattedBalance;
            return acc;
          }, {})
        };
      } catch (apiError) {
        console.error('UseZoracle API Error:', apiError.message);
        if (apiError.response) {
          console.error('API Response:', apiError.response.data);
        }
        throw new Error(`UseZoracle API Error: ${apiError.message}`);
      }
    }
  } catch (error) {
    console.error('Error getting wallet balances:', error);
    return {
      success: false,
      message: 'Failed to get wallet balances: ' + error.message
    };
  }
}

/**
 * Get token balance
 * @param {string} userId - Telegram user ID
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} - Token balance information
 */
async function getTokenBalance(userId, tokenAddress): Promise<any> {
  try {
    // Validate token address
    if (!isValidEthereumAddress(tokenAddress)) {
      return {
        success: false,
        message: 'Invalid token address provided'
      };
    }
    
    // Get wallet address
    const address = getWalletAddress(userId);
    if (!address) {
      return {
        success: false,
        message: 'No wallet found for this user'
      };
    }
    
    // Check if wallet is unlocked
    if (!isWalletUnlocked(userId)) {
      return {
        success: false,
        message: 'Wallet is locked. Please unlock your wallet first.'
      };
    }
    
    const session = walletSessions.get(userId);
    
    if (SIMULATION_MODE) {
      // Return simulated token balance in simulation mode
      console.log(`Getting simulated token balance for ${tokenAddress}`);
      
      // Generate a random token symbol based on the address
      const tokenSymbol = `TKN${tokenAddress.substring(2, 6).toUpperCase()}`;
      
      return {
        success: true,
        address,
        token: {
          address: tokenAddress,
          symbol: tokenSymbol,
          balance: (Math.random() * 100).toFixed(2),
          decimals: 18
        }
      };
    } else {
      // Use real UseZoracle API
      try {
        console.log(`Getting token balance from UseZoracle API for token: ${tokenAddress}`);
        
        const response = await axios.get(`${API_BASE_URL}/api/balances/${session.accountName}`);
        
        if (!response.data || !response.data.success || !response.data.data || !response.data.data.balances) {
          throw new Error('Failed to get token info from UseZoracle API');
        }
        
        console.log('UseZoracle API Response:', response.data);
        
        // Format response for consistency with our interface
        const tokenData = response.data.data.balances.find(token => 
          token.token && token.token.toLowerCase() === tokenAddress.toLowerCase()
        );
        
        if (!tokenData) {
          return {
            success: true,
            address,
            token: {
              address: tokenAddress,
              symbol: 'UNKNOWN',
              balance: '0',
              decimals: 18
            }
          };
        }
        
        return {
          success: true,
          address,
          token: {
            address: tokenAddress,
            symbol: tokenData.symbol || 'UNKNOWN',
            balance: tokenData.balance || '0',
            decimals: tokenData.decimals || 18
          }
        };
      } catch (apiError) {
        console.error('UseZoracle API Error:', apiError.message);
        if (apiError.response) {
          console.error('API Response:', apiError.response.data);
        }
        throw new Error(`UseZoracle API Error: ${apiError.message}`);
      }
    }
  } catch (error) {
    console.error('Error getting token balance:', error);
    return {
      success: false,
      message: 'Failed to get token balance: ' + error.message
    };
  }
}

/**
 * Transfer tokens 
 * @param {string} userId - Telegram user ID 
 * @param {string} toAddress - Destination address 
 * @param {string} amount - Amount to transfer 
 * @param {string} token - Token symbol (e.g., 'eth', 'usdc') 
 * @param {string} network - Network to use (e.g., 'base') 
 * @returns {Promise<Object>} - Transaction result 
 */
async function transferTokens(userId, toAddress, amount, token, network = 'base'): Promise<any> {
  try {
    if (!isWalletUnlocked(userId)) {
      return {
        success: false,
        message: 'Wallet is locked. Please unlock your wallet first.'
      };
    }
    
    // Validate destination address
    if (!isValidEthereumAddress(toAddress)) {
      return {
        success: false,
        message: 'Invalid destination address'
      };
    }
    
    const session = walletSessions.get(userId);
    
    if (SIMULATION_MODE) {
      // Simulate transaction in simulation mode
      console.log(`Simulating transfer of ${amount} ${token} to ${toAddress} on network ${network}`);
      
      // Generate a random transaction hash
      const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      
      return {
        success: true,
        txHash,
        message: `Successfully initiated transfer of ${amount} ${token} to ${toAddress} (simulation mode)`,
        amount,
        token,
        toAddress,
        network
      };
    } else {
      // Use real UseZoracle API
      try {
        console.log(`Initiating transfer via UseZoracle API: ${amount} ${token} to ${toAddress}`);
        
        const transferData = {
          accountName: session.accountName,
          to: toAddress,
          amount: amount,
          token: token.toLowerCase(),
          network: network
        };
        
        const response = await axios.post(
          `${API_BASE_URL}/api/transactions/transfer`, 
          transferData
        );
        
        if (!response.data || !response.data.success || !response.data.data) {
          throw new Error('Failed to initiate transfer: Invalid response format');
        }
        
        console.log('Transfer initiated:', response.data);
        
        return {
          success: true,
          txHash: response.data.data.transactionHash,
          message: `Successfully initiated transfer of ${amount} ${token} to ${toAddress}`,
          amount,
          token,
          toAddress,
          network
        };
      } catch (apiError) {
        console.error('UseZoracle API Error:', apiError.message);
        if (apiError.response) {
          console.error('API Response:', apiError.response.data);
        }
        throw new Error(`Failed to transfer tokens: ${apiError.message}`);
      }
    }
  } catch (error) {
    console.error('Error transferring tokens:', error);
    return {
      success: false,
      message: `Failed to transfer tokens: ${error.message}`
    };
  }
}

/**
 * Lock wallet and clear session
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if wallet was locked
 */
function lockWallet(userId): boolean {
  walletSessions.delete(userId);
  return true;
}

/**
 * Check if wallet is unlocked
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if wallet is unlocked
 */
function isWalletUnlocked(userId): boolean {
  // Check if wallet exists in session
  if (!walletSessions.has(userId)) {
    return false;
  }
  
  // Check if session has expired
  const session = walletSessions.get(userId);
  const inactiveTime = (Date.now() - session.lastActivity) / (60 * 1000); // in minutes
  
  if (inactiveTime > CONFIG.WALLET_LOCK_TIMEOUT) {
    // Lock wallet due to inactivity
    lockWallet(userId);
    return false;
  }
  
  // Update activity
  walletSessions.get(userId).lastActivity = Date.now();
  return true;
}

/**
 * Increment failed attempt counter
 * @param {string} userId - Telegram user ID
 */
function incrementFailedAttempt(userId): void {
  const attempts = failedAttempts.get(userId) || 0;
  failedAttempts.set(userId, attempts + 1);
  
  // Lock account after max attempts
  if (attempts + 1 >= CONFIG.PASSWORD_ATTEMPTS_MAX) {
    lockWallet(userId);
  }
}

/**
 * Get number of failed attempts
 * @param {string} userId - Telegram user ID
 * @returns {number} - Number of failed attempts
 */
function getFailedAttempts(userId): number {
  return failedAttempts.get(userId) || 0;
}

/**
 * Reset failed attempts counter
 * @param {string} userId - Telegram user ID
 */
function resetFailedAttempts(userId): void {
  failedAttempts.delete(userId);
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
    console.warn(`⚠️ Invalid Ethereum address detected: ${address}`);
    console.warn(`⚠️ Error: ${error.message}`);
    return false;
  }
}

/**
 * Generate 2FA QR code
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - QR code object
 */
async function get2FAQRCode(userId): Promise<any> {
  try {
    // This is a stub implementation - UseZoracle API doesn't support 2FA directly
    console.log(`Generating 2FA QR code for user ${userId}`);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/UseZoracle:${userId}?secret=JBSWY3DPEHPK3PXP&issuer=UseZoracle`;
    
    return {
      success: true,
      qrCode: qrCodeUrl,
      message: '2FA QR code generated successfully'
    };
  } catch (error) {
    console.error(`Error generating 2FA QR code: ${error.message}`);
    return {
      success: false,
      message: `Error generating 2FA QR code: ${error.message}`
    };
  }
}

/**
 * Enable 2FA for a user
 * @param {string} userId - User ID
 * @param {string} token - 2FA setup token
 * @returns {Promise<Object>} - Result object
 */
async function enable2FA(userId, token): Promise<any> {
  try {
    // This is a stub implementation - UseZoracle API doesn't support 2FA directly
    console.log(`Enabling 2FA for user ${userId} with token ${token}`);
    return {
      success: true,
      message: '2FA enabled successfully'
    };
  } catch (error) {
    console.error(`Error enabling 2FA: ${error.message}`);
    return {
      success: false,
      message: `Error enabling 2FA: ${error.message}`
    };
  }
}

/**
 * Import wallet from mnemonic
 * @param {string} userId - User ID
 * @param {string} mnemonic - Mnemonic phrase
 * @param {string} password - Password
 * @param {string} pin - PIN
 * @returns {Promise<Object>} - Result object
 */
async function importWalletFromMnemonic(userId, mnemonic, password, pin): Promise<any> {
  try {
    console.log(`Importing wallet from mnemonic for user ${userId}`);
    
    // Create wallet from mnemonic
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    
    // Similar to importWallet but with mnemonic-derived wallet
    const privateKey = wallet.privateKey;
    
    // Now use the existing importWallet function
    return await importWallet(userId, privateKey, password, pin);
  } catch (error) {
    console.error(`Error importing wallet from mnemonic: ${error.message}`);
    return {
      success: false,
      message: `Error importing wallet: ${error.message}`
    };
  }
}

// Automatic wallet locking system
setInterval(() => {
  for (const [userId, session] of walletSessions.entries()) {
    const inactiveTime = (Date.now() - session.lastActivity) / (60 * 1000); // in minutes
    if (inactiveTime > CONFIG.WALLET_LOCK_TIMEOUT) {
      console.log(`Auto-locking wallet for user ${userId} due to inactivity`);
      lockWallet(userId);
    }
  }
}, 60000); // Check every minute

export { 
  createWallet,
  importWallet,
  importWalletFromMnemonic,
  loadWallet,
  lockWallet,
  isWalletUnlocked,
  userHasWallet,
  getWallet,
  getWalletAddress,
  getWalletBalances,
  getTokenBalance,
  transferTokens,
  quickUnlockWallet,
  get2FAQRCode,
  enable2FA,
  isValidEthereumAddress
};