// Wallet management service
const { ethers } = require('ethers');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { CONFIG, ABIS } = require('../../config');
const { getDatabase } = require('../database');

// Provider setup
const provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);

// In-memory session storage
const walletSessions = new Map();
const failedAttempts = new Map();

// Ensure wallet directory exists
if (!fs.existsSync(CONFIG.WALLETS_DIR)) {
  fs.mkdirSync(CONFIG.WALLETS_DIR, { recursive: true });
}

/**
 * Create a new wallet for a user
 * @param {string} userId - Telegram user ID
 * @param {string} password - User's password for encryption
 * @param {string} pin - User's PIN for quick access
 * @returns {Promise<Object>} - Wallet info object
 */
async function createWallet(userId, password, pin) {
  try {
    // Generate a new random wallet
    const wallet = ethers.Wallet.createRandom();
    const walletInfo = await encryptAndSaveWallet(userId, wallet.privateKey, password, pin);
    
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
 * @returns {Promise<Object>} - Wallet info object
 */
async function importWallet(userId, privateKey, password, pin) {
  try {
    // Validate private key format and create wallet
    const wallet = new ethers.Wallet(privateKey);
    const walletInfo = await encryptAndSaveWallet(userId, privateKey, password, pin);
    
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
 * @returns {Promise<Object>} - Wallet info object
 */
async function importWalletFromMnemonic(userId, mnemonic, password, pin) {
  try {
    // Validate mnemonic format and create wallet
    const wallet = ethers.Wallet.fromMnemonic(mnemonic);
    const walletInfo = await encryptAndSaveWallet(userId, wallet.privateKey, password, pin);
    
    return {
      success: true,
      address: wallet.address,
      message: 'Wallet imported successfully from mnemonic'
    };
  } catch (error) {
    console.error('Error importing wallet from mnemonic:', error);
    return {
      success: false,
      message: 'Failed to import wallet from mnemonic: ' + error.message
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
async function encryptAndSaveWallet(userId, privateKey, password, pin) {
  // Generate a salt for this wallet
  const salt = crypto.randomBytes(16).toString('hex');
  
  // Create encryption key from password and salt
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(16);
  
  // Encrypt private key
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encryptedPrivateKey = cipher.update(privateKey, 'utf8', 'hex');
  encryptedPrivateKey += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Hash for verification (without storing the actual private key)
  const keyHash = crypto.createHash('sha256').update(privateKey).digest('hex');
  
  // Create PIN hash with different salt
  const pinSalt = crypto.randomBytes(16).toString('hex');
  const pinHash = crypto.createHash('sha256').update(pin + pinSalt).digest('hex');
  
  // Create wallet object
  const wallet = new ethers.Wallet(privateKey);
  
  // Generate 2FA secret
  const twoFactorSecret = speakeasy.generateSecret({
    name: `Zoracle:${wallet.address.substring(0, 8)}`
  });
  
  const walletInfo = {
    address: wallet.address,
    encryptedPrivateKey,
    iv: iv.toString('hex'),
    authTag,
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
  const walletFile = path.join(CONFIG.WALLETS_DIR, `${userId}.json`);
  fs.writeFileSync(walletFile, JSON.stringify(walletInfo, null, 2));
  
  // Also save to database if available
  const db = getDatabase();
  if (db) {
    await db.wallets.put({
      userId,
      address: wallet.address,
      encryptedData: walletInfo,
      createdAt: Date.now()
    });
  }
  
  return {
    ...walletInfo,
    twoFactorSetupUrl: twoFactorSecret.otpauth_url
  };
}

/**
 * Generate backup codes for 2FA recovery
 * @param {number} count - Number of backup codes to generate
 * @returns {Array<string>} - List of backup codes
 */
function generateBackupCodes(count = 8) {
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
 * @returns {Promise<Object>} - Result object
 */
async function enable2FA(userId, token) {
  try {
    // Check if wallet file exists
    const walletFile = path.join(CONFIG.WALLETS_DIR, `${userId}.json`);
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
    
    // Update database if available
    const db = getDatabase();
    if (db) {
      const dbWallet = await db.wallets.get(userId);
      if (dbWallet) {
        dbWallet.encryptedData.twoFactorEnabled = true;
        await db.wallets.put(dbWallet);
      }
    }
    
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
async function get2FAQRCode(userId) {
  try {
    // Check if wallet file exists
    const walletFile = path.join(CONFIG.WALLETS_DIR, `${userId}.json`);
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
    
    const qrCode = await qrcode.toDataURL(otpauth_url);
    
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
 * Load and decrypt wallet
 * @param {string} userId - Telegram user ID
 * @param {string} password - Password for decryption
 * @param {string} twoFactorToken - Optional 2FA token
 * @returns {Promise<Object>} - Wallet object or error
 */
async function loadWallet(userId, password, twoFactorToken = null) {
  try {
    // Check if wallet file exists
    const walletFile = path.join(CONFIG.WALLETS_DIR, `${userId}.json`);
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
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(walletData.authTag, 'hex'));
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
 * Get unlocked wallet instance for trading
 * @param {string} userId - Telegram user ID
 * @returns {ethers.Wallet|null} - Wallet instance or null if locked
 */
function getUnlockedWallet(userId) {
  if (!isWalletUnlocked(userId)) {
    return null;
  }
  return walletSessions.get(userId).wallet;
}

/**
 * Check if wallet is unlocked and session is valid
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if wallet is unlocked
 */
function isWalletUnlocked(userId) {
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
  session.lastActivity = Date.now();
  
  return true;
}

/**
 * Lock wallet and clear session
 * @param {string} userId - Telegram user ID
 * @returns {boolean} - True if wallet was locked
 */
function lockWallet(userId) {
  // Remove from session
  walletSessions.delete(userId);
  return true;
}

/**
 * Increment failed attempt counter
 * @param {string} userId - Telegram user ID
 * @returns {number} - Number of failed attempts
 */
function incrementFailedAttempt(userId) {
  const attempts = getFailedAttempts(userId) + 1;
  failedAttempts.set(userId, attempts);
  return attempts;
}

/** 