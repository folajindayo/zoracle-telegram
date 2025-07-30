// Wallet management service for Zoracle Bot
import { ethers  } from 'ethers';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CONFIG, ABIS  } from '../config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { UserOps  } from '../database/operations';

// Directory to store encrypted wallets
const WALLETS_DIR = path.join(__dirname, 'secure_wallets');
// Ensure directory exists
if (!fs.existsSync(WALLETS_DIR)) {
  fs.mkdirSync(WALLETS_DIR, { recursive: true });
}

// Provider setup
const provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);

// Wallet sessions (in-memory)
const walletSessions = new Map();

// User wallet activity tracking for auto-lock
const walletActivity = new Map();

// Failed PIN/password attempt tracking
const failedAttempts = new Map();

/**
 * Create a new wallet for a user
 * @param {string} userId - Telegram user ID
 * @param {string} password - User's password for encryption
 * @param {string} pin - User's PIN for quick access
 * @returns {Object} - Wallet info object
 */
async function createWallet(userId, password, pin): Promise<any> {
  try {
    // Generate a new random wallet
    const wallet = ethers.Wallet.createRandom();
    const walletInfo = await encryptAndSaveWallet(userId, wallet.privateKey, password, pin);
    
    // Start tracking activity for this wallet
    walletActivity.set(userId, Date.now());
    
    return {
      success: true,
      address: wallet.address,
      mnemonic: wallet.mnemonic.phrase,
      message: 'Wallet created successfully'
    };
  } catch (error) {
    console.error('Error creating wallet:', error);
    return {
      success: false,
      message: 'Failed to create wallet: ' + error.message
    };
  }
}

/**
 * Import an existing wallet using a private key
 * @param {string} userId - Telegram user ID
 * @param {string} privateKey - Private key to import
 * @param {string} password - User's password for encryption
 * @param {string} pin - User's PIN for quick access
 * @returns {Object} - Wallet info object
 */
async function importWallet(userId, privateKey, password, pin): Promise<any> {
  try {
    // Validate private key format and create wallet
    const wallet = new ethers.Wallet(privateKey);
    const walletInfo = await encryptAndSaveWallet(userId, privateKey, password, pin);
    
    // Start tracking activity for this wallet
    walletActivity.set(userId, Date.now());
    
    return {
      success: true,
      address: wallet.address,
      message: 'Wallet imported successfully'
    };
  } catch (error) {
    console.error('Error importing wallet:', error);
    return {
      success: false,
      message: 'Failed to import wallet: ' + error.message
    };
  }
}

/**
 * Import a wallet using mnemonic phrase
 * @param {string} userId - Telegram user ID
 * @param {string} mnemonic - Mnemonic phrase
 * @param {string} password - User's password for encryption
 * @param {string} pin - User's PIN for quick access
 * @returns {Object} - Wallet info object
 */
async function importWalletFromMnemonic(userId, mnemonic, password, pin): Promise<any> {
  try {
    // Validate mnemonic format and create wallet
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    const walletInfo = await encryptAndSaveWallet(userId, wallet.privateKey, password, pin);
    
    // Start tracking activity for this wallet
    walletActivity.set(userId, Date.now());
    
    return {
      success: true,
      address: wallet.address,
      message: 'Wallet imported successfully from mnemonic'
    };
  } catch (error) {
    console.error('Error importing wallet from mnemonic:', error);
    return {
      success: false,
      message: 'Failed to import * as wallet from mnemonic: ' + error.message
    };
  }
}

/**
 * Encrypt and save wallet to storage
 * @param {string} userId - Telegram user ID
 * @param {string} privateKey - Private key to encrypt
 * @param {string} password - Password for encryption
 * @param {string} pin - PIN for quick access
 * @returns {Object} - Encrypted wallet info
 */
async function encryptAndSaveWallet(userId, privateKey, password, pin): Promise<any> {
  // Generate a salt for this wallet
  const salt = crypto.randomBytes(16).toString('hex');
  
  // Create encryption key from password and salt
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(16);
  
  // Encrypt private key
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encryptedPrivateKey = cipher.update(privateKey, 'utf8', 'hex');
  encryptedPrivateKey += cipher.final('hex');
  
  // Hash for verification (without storing the actual private key)
  const keyHash = crypto.createHash('sha256').update(privateKey).digest('hex');
  
  // Create PIN hash with different salt
  const pinSalt = crypto.randomBytes(16).toString('hex');
  const pinHash = crypto.createHash('sha256').update(pin + pinSalt).digest('hex');
  
  // Create wallet object
  const wallet = new ethers.Wallet(privateKey);
  
  // Generate 2FA secret (optional)
  const twoFactorSecret = speakeasy.generateSecret({
    name: `Zoracle:${wallet.address.substring(0, 8)}`
  });
  
  const walletInfo = {
    address: wallet.address,
    encryptedPrivateKey,
    iv: iv.toString('hex'),
    salt,
    keyHash,
    pinHash,
    pinSalt,
    twoFactorEnabled: false, // Disabled by default
    twoFactorSecret: twoFactorSecret.base32, // Store secret for later activation
    twoFactorBackupCodes: generateBackupCodes(), // Generate backup codes
    createdAt: Date.now()
  };
  
  // Save to file
  const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
  fs.writeFileSync(walletFile, JSON.stringify(walletInfo, null, 2));
  
  // Return wallet info with 2FA setup details
  return {
    ...walletInfo,
    twoFactorSetupUrl: twoFactorSecret.otpauth_url
  };
}

/**
 * Generate backup codes for 2FA recovery
 * @returns {Array<string>} - List of backup codes
 */
function generateBackupCodes(count = 8): any {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Enable 2FA for a user's wallet
 * @param {string} userId - Telegram user ID
 * @param {string} token - TOTP token for verification
 * @returns {Object} - Result object
 */
async function enable2FA(userId, token): Promise<any> {
  try {
    // Check if wallet file exists
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (!fs.existsSync(walletFile)) {
      return {
        success: false,
        message: 'No wallet found for this user.'
      };
    }
    
    // Read wallet data
    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: walletData.twoFactorSecret,
      encoding: 'base32',
      token: token
    });
    
    if (!verified) {
      return {
        success: false,
        message: 'Invalid 2FA token. Please try again.'
      };
    }
    
    // Enable 2FA
    walletData.twoFactorEnabled = true;
    fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2));
    
    return {
      success: true,
      message: '2FA has been successfully enabled for your wallet.',
      backupCodes: walletData.twoFactorBackupCodes
    };
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return {
      success: false,
      message: 'Failed to enable 2FA: ' + error.message
    };
  }
}

/**
 * Generate a QR code for 2FA setup
 * @param {string} userId - Telegram user ID
 * @returns {Promise<Object>} - QR code data URL
 */
async function get2FAQRCode(userId): Promise<any> {
  try {
    // Check if wallet file exists
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (!fs.existsSync(walletFile)) {
      return {
        success: false,
        message: 'No wallet found for this user.'
      };
    }
    
    // Read wallet data
    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    
    // Generate QR code
    const otpauth_url = `otpauth://totp/Zoracle:${walletData.address.substring(0, 8)}?secret=${walletData.twoFactorSecret}&issuer=Zoracle`;
    
    const qrCode = await QRCode.toDataURL(otpauth_url);
    
    return {
      success: true,
      qrCode,
      secret: walletData.twoFactorSecret
    };
  } catch (error) {
    console.error('Error generating 2FA QR code:', error);
    return {
      success: false,
      message: 'Failed to generate 2FA QR code: ' + error.message
    };
  }
}

/**
 * Load and decrypt wallet with PIN
 * @param {string} userId - Telegram user ID
 * @param {string} pin - PIN for quick access
 * @returns {Object} - Wallet object or error
 */
async function quickUnlockWallet(userId, pin): Promise<any> {
  try {
    // Check if wallet file exists
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (!fs.existsSync(walletFile)) {
      return {
        success: false,
        message: 'No wallet found for this user. Please create or import a wallet first.'
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
    
    // If 2FA is enabled, require token
    if (walletData.twoFactorEnabled) {
      return {
        success: false,
        requireTwoFactor: true,
        message: 'Please enter your 2FA token to unlock wallet'
      };
    }
    
    // Reset failed attempts counter
    resetFailedAttempts(userId);
    
    // Load actual wallet with password (to be implemented in a secure way)
    // For now, we'll assume the wallet is already unlocked or store password in session
    // This is just a placeholder for the PIN-based quick access flow
    
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
 * Verify 2FA token for a sensitive action
 * @param {string} userId - Telegram user ID
 * @param {string} token - 2FA token
 * @returns {Object} - Verification result
 */
function verify2FAToken(userId, token): any {
  try {
    // Check if wallet file exists
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (!fs.existsSync(walletFile)) {
      return {
        success: false,
        message: 'No wallet found for this user.'
      };
    }
    
    // Read wallet data
    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    
    // If 2FA is not enabled, return success
    if (!walletData.twoFactorEnabled) {
      return {
        success: true,
        message: '2FA not enabled for this wallet'
      };
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: walletData.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 period before/after for clock drift
    });
    
    if (!verified) {
      return {
        success: false,
        message: 'Invalid 2FA token. Please try again.'
      };
    }
    
    return {
      success: true,
      message: '2FA token verified successfully'
    };
  } catch (error) {
    console.error('Error verifying 2FA token:', error);
    return {
      success: false,
      message: 'Failed to verify 2FA token: ' + error.message
    };
  }
}

/**
 * Increment failed attempt counter
 * @param {string} userId - Telegram user ID
 */
function incrementFailedAttempt(userId): any {
  const attempts = failedAttempts.get(userId) || 0;
  failedAttempts.set(userId, attempts + 1);
  
  // Lock account after max attempts
  if (attempts + 1 >= CONFIG.PASSWORD_ATTEMPTS_MAX) {
    // Lock the wallet
    lockWallet(userId);
  }
}

/**
 * Get number of failed attempts
 * @param {string} userId - Telegram user ID
 * @returns {number} - Number of failed attempts
 */
function getFailedAttempts(userId): any {
  return failedAttempts.get(userId) || 0;
}

/**
 * Reset failed attempts counter
 * @param {string} userId - Telegram user ID
 */
function resetFailedAttempts(userId): any {
  failedAttempts.delete(userId);
}

/**
 * Load and decrypt wallet
 * @param {string} userId - Telegram user ID
 * @param {string} password - Password for decryption
 * @param {string} twoFactorToken - Optional 2FA token
 * @returns {Object} - Wallet object or error
 */
async function loadWallet(userId, password, twoFactorToken = null): Promise<any> {
  try {
    // Check if wallet file exists
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (!fs.existsSync(walletFile)) {
      return {
        success: false,
        message: 'No wallet found for this user. Please create or import a wallet first.'
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
    
    // Derive key from password and salt
    const key = crypto.scryptSync(password, walletData.salt, 32);
    const iv = Buffer.from(walletData.iv, 'hex');
    
    // Decrypt private key
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let privateKey = decipher.update(walletData.encryptedPrivateKey, 'hex', 'utf8');
    privateKey += decipher.final('utf8');
    
    // Verify the key hash
    const keyHash = crypto.createHash('sha256').update(privateKey).digest('hex');
    if (keyHash !== walletData.keyHash) {
      incrementFailedAttempt(userId);
      return {
        success: false,
        message: 'Incorrect password',
        remainingAttempts: CONFIG.PASSWORD_ATTEMPTS_MAX - getFailedAttempts(userId)
      };
    }
    
    // Check if 2FA is enabled and verify token if needed
    if (walletData.twoFactorEnabled) {
      // If no token provided, prompt for it
      if (!twoFactorToken) {
        return {
          success: false,
          requireTwoFactor: true,
          message: 'Please provide your 2FA token to unlock wallet'
        };
      }
      
      // Verify 2FA token
      const verified = speakeasy.totp.verify({
        secret: walletData.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 1 // Allow 1 period before/after for clock drift
      });
      
      if (!verified) {
        return {
          success: false,
          requireTwoFactor: true,
          message: 'Invalid 2FA token. Please try again.'
        };
      }
    }
    
    // Reset failed attempts
    resetFailedAttempts(userId);
    
    // Create wallet
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Update activity timestamp
    walletActivity.set(userId, Date.now());
    
    // Store in session
    walletSessions.set(userId, {
      wallet,
      address: wallet.address,
      unlockTime: Date.now(),
      lastActivity: Date.now()
    });
    
    return {
      success: true,
      address: wallet.address,
      message: 'Wallet unlocked successfully'
    };
  } catch (error) {
    console.error('Error loading wallet:', error);
    return {
      success: false,
      message: 'Failed to load wallet: ' + error.message
    };
  }
}

/**
 * Check if a user has a wallet
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if wallet exists
 */
function userHasWallet(userId): any {
  const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
  return fs.existsSync(walletFile);
}

/**
 * Get wallet address for a user
 * @param {string} userId - Telegram user ID
 * @returns {string|null} - Wallet address or null if not found
 */
function getWalletAddress(userId): any {
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
 * Check if 2FA is enabled for a user
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if 2FA is enabled
 */
function is2FAEnabled(userId): any {
  try {
    const walletFile = path.join(WALLETS_DIR, `${userId}.json`);
    if (fs.existsSync(walletFile)) {
      const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
      return !!walletData.twoFactorEnabled;
    }
    return false;
  } catch (error) {
    console.error('Error checking 2FA status:', error);
    return false;
  }
}

/**
 * Check if wallet is unlocked and session is valid
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if wallet is unlocked
 */
function isWalletUnlocked(userId): any {
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
  walletActivity.set(userId, Date.now());
  walletSessions.get(userId).lastActivity = Date.now();
  
  return true;
}

/**
 * Get unlocked wallet instance for trading
 * @param {string} userId - Telegram user ID
 * @returns {ethers.Wallet|null} - Wallet instance or null if locked
 */
function getUnlockedWallet(userId): any {
  if (!isWalletUnlocked(userId)) {
    return null;
  }
  return walletSessions.get(userId).wallet;
}

/**
 * Lock wallet and clear session
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if wallet was locked
 */
function lockWallet(userId): any {
  // Remove from session
  walletSessions.delete(userId);
  return true;
}

/**
 * Get ETH and token balances for a wallet
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
    
    // Get ETH balance
    const ethBalance = await provider.getBalance(address);
    
    // Return balances
    return {
      success: true,
      address,
      balances: {
        ETH: ethers.utils.formatEther(ethBalance)
      }
    };
  } catch (error) {
    console.error('Error getting wallet balances:', error);
    return {
      success: false,
      message: 'Failed to get wallet balances: ' + error.message
    };
  }
}

/**
 * Get token balance for a specific token
 * @param {string} userId - Telegram user ID
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} - Token balance information
 */
async function getTokenBalance(userId, tokenAddress): Promise<any> {
  try {
    // Get wallet address
    const address = getWalletAddress(userId);
    if (!address) {
      return {
        success: false,
        message: 'No wallet found for this user'
      };
    }
    
    // Create token contract
    const tokenContract = new ethers.Contract(tokenAddress, ABIS.ERC20_ABI, provider);
    
    // Get token info
    const [balance, decimals, symbol] = await Promise.all([
      tokenContract.balanceOf(address),
      tokenContract.decimals(),
      tokenContract.symbol()
    ]);
    
    // Format balance
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    
    return {
      success: true,
      address,
      token: {
        address: tokenAddress,
        symbol,
        balance: formattedBalance,
        decimals
      }
    };
  } catch (error) {
    console.error('Error getting token balance:', error);
    return {
      success: false,
      message: 'Failed to get token balance: ' + error.message
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
  getUnlockedWallet,
  userHasWallet,
  getWalletAddress,
  getWalletBalances,
  getTokenBalance,
  quickUnlockWallet,
  enable2FA,
  verify2FAToken,
  get2FAQRCode,
  is2FAEnabled
 }; 