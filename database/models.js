const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'zoracle.sqlite'),
  logging: false
});

// User model
const User = sequelize.define('User', {
  telegramId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  walletAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  encryptedPrivateKey: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  pin: {
    type: DataTypes.STRING,
    allowNull: true
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  twoFactorSecret: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastActive: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

// Transaction model
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  telegramId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: User,
      key: 'telegramId'
    }
  },
  type: {
    type: DataTypes.STRING, // 'buy', 'sell', 'approval'
    allowNull: false
  },
  tokenAddress: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tokenSymbol: {
    type: DataTypes.STRING,
    allowNull: true
  },
  amount: {
    type: DataTypes.STRING, // Store as string to preserve precision
    allowNull: false
  },
  ethValue: {
    type: DataTypes.STRING, // Store as string to preserve precision
    allowNull: true
  },
  txHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING, // 'pending', 'confirmed', 'failed'
    defaultValue: 'pending'
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  gasUsed: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gasPrice: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

// Alert model
const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  telegramId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: User,
      key: 'telegramId'
    }
  },
  tokenAddress: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tokenSymbol: {
    type: DataTypes.STRING,
    allowNull: true
  },
  type: {
    type: DataTypes.STRING, // 'price_above', 'price_below', 'liquidity_change'
    allowNull: false
  },
  threshold: {
    type: DataTypes.STRING, // Store as string to preserve precision
    allowNull: false
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastTriggered: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

// CopyTrade model
const CopyTrade = sequelize.define('CopyTrade', {
  id: {
    type: DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  telegramId: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: User,
      key: 'telegramId'
    }
  },
  targetWallet: {
    type: DataTypes.STRING,
    allowNull: false
  },
  maxEthPerTrade: {
    type: DataTypes.STRING, // Store as string to preserve precision
    allowNull: false
  },
  slippage: {
    type: DataTypes.FLOAT,
    defaultValue: 2.0 // 2% default slippage
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  sandboxMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

// Token model for caching token info
const Token = sequelize.define('Token', {
  address: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  symbol: {
    type: DataTypes.STRING,
    allowNull: true
  },
  decimals: {
    type: DataTypes.INTEGER,
    defaultValue: 18
  },
  lastPrice: {
    type: DataTypes.STRING,
    allowNull: true
  },
  priceUpdateTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isZoraToken: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  creatorAddress: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

// Initialize database
async function initDb() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync all models
    await sequelize.sync();
    console.log('✅ Database synchronized successfully.');
    
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  User,
  Transaction,
  Alert,
  CopyTrade,
  Token,
  initDb
}; 