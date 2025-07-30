/**
 * MongoDB Models
 * 
 * This file defines the MongoDB schemas and models using Mongoose.
 */
import * as mongoose from 'mongoose';
const { Schema } = mongoose;

// User Schema
const UserSchema = new Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String
  },
  walletAddress: {
    type: String
  },
  encryptedPrivateKey: {
    type: String
  },
  pin: {
    type: String
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Transaction Schema
const TransactionSchema = new Schema({
  telegramId: {
    type: String,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    required: true,
    enum: ['buy', 'sell', 'approve', 'transfer']
  },
  tokenAddress: {
    type: String,
    required: true
  },
  tokenSymbol: {
    type: String
  },
  amount: {
    type: String,
    required: true
  },
  ethValue: {
    type: String
  },
  txHash: {
    type: String
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'confirmed', 'failed']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  gasUsed: {
    type: String
  },
  gasPrice: {
    type: String
  }
}, { timestamps: true });

// Alert Schema
const AlertSchema = new Schema({
  telegramId: {
    type: String,
    required: true,
    ref: 'User'
  },
  tokenAddress: {
    type: String,
    required: true
  },
  tokenSymbol: {
    type: String
  },
  type: {
    type: String,
    required: true,
    enum: ['price_above', 'price_below', 'liquidity_change']
  },
  threshold: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  lastTriggered: {
    type: Date
  }
}, { timestamps: true });

// CopyTrade Schema
const CopyTradeSchema = new Schema({
  telegramId: {
    type: String,
    required: true,
    ref: 'User'
  },
  targetWallet: {
    type: String,
    required: true
  },
  maxEthPerTrade: {
    type: String,
    required: true
  },
  slippage: {
    type: Number,
    default: 2.0
  },
  active: {
    type: Boolean,
    default: true
  },
  sandboxMode: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Token Schema
const TokenSchema = new Schema({
  address: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String
  },
  symbol: {
    type: String
  },
  decimals: {
    type: Number,
    default: 18
  },
  lastPrice: {
    type: String
  },
  priceUpdateTime: {
    type: Date
  },
  isZoraToken: {
    type: Boolean,
    default: false
  },
  creatorAddress: {
    type: String
  }
}, { timestamps: true });

// Create models
const User = mongoose.model('User', UserSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const Alert = mongoose.model('Alert', AlertSchema);
const CopyTrade = mongoose.model('CopyTrade', CopyTradeSchema);
const Token = mongoose.model('Token', TokenSchema);

/**
 * Initialize database connection
 * @returns {Promise<boolean>} Success status
 */
async function initDb(): Promise<any> {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zoracle';
    
    await mongoose.connect(mongoUri, {
      
      
    });
    
    console.log('✅ MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    return false;
  }
}

export { 
  mongoose,
  User,
  Transaction,
  Alert,
  CopyTrade,
  Token,
  initDb
 }; 