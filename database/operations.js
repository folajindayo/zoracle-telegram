/**
 * Database Operations for Zoracle Telegram Bot
 */
const { User, Transaction, Alert, CopyTrade, Token } = require('./models');
const { Op } = require('sequelize');

/**
 * User Operations
 */
const UserOps = {
  /**
   * Create or update a user
   * @param {string} telegramId - Telegram user ID
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} - Updated user object
   */
  async upsertUser(telegramId, userData) {
    const [user, created] = await User.findOrCreate({
      where: { telegramId },
      defaults: userData
    });
    
    if (!created && userData) {
      await user.update(userData);
    }
    
    return user.toJSON();
  },
  
  /**
   * Get a user by Telegram ID
   * @param {string} telegramId - Telegram user ID
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async getUser(telegramId) {
    const user = await User.findByPk(telegramId);
    return user ? user.toJSON() : null;
  },
  
  /**
   * Update user's last active timestamp
   * @param {string} telegramId - Telegram user ID
   * @returns {Promise<boolean>} - Success status
   */
  async updateLastActive(telegramId) {
    const result = await User.update(
      { lastActive: new Date() },
      { where: { telegramId } }
    );
    return result[0] > 0;
  }
};

/**
 * Transaction Operations
 */
const TransactionOps = {
  /**
   * Create a new transaction
   * @param {Object} txData - Transaction data
   * @returns {Promise<Object>} - Created transaction
   */
  async createTransaction(txData) {
    const tx = await Transaction.create(txData);
    return tx.toJSON();
  },
  
  /**
   * Update a transaction
   * @param {string} id - Transaction ID
   * @param {Object} txData - Transaction data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateTransaction(id, txData) {
    const result = await Transaction.update(
      txData,
      { where: { id } }
    );
    return result[0] > 0;
  },
  
  /**
   * Update a transaction by tx hash
   * @param {string} txHash - Transaction hash
   * @param {Object} txData - Transaction data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateTransactionByHash(txHash, txData) {
    const result = await Transaction.update(
      txData,
      { where: { txHash } }
    );
    return result[0] > 0;
  },
  
  /**
   * Get user's transactions
   * @param {string} telegramId - Telegram user ID
   * @param {number} limit - Number of transactions to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} - Array of transactions
   */
  async getUserTransactions(telegramId, limit = 10, offset = 0) {
    const txs = await Transaction.findAll({
      where: { telegramId },
      order: [['timestamp', 'DESC']],
      limit,
      offset
    });
    return txs.map(tx => tx.toJSON());
  },
  
  /**
   * Get user's transactions for a specific token
   * @param {string} telegramId - Telegram user ID
   * @param {string} tokenAddress - Token address
   * @returns {Promise<Array>} - Array of transactions
   */
  async getUserTokenTransactions(telegramId, tokenAddress) {
    const txs = await Transaction.findAll({
      where: { 
        telegramId,
        tokenAddress
      },
      order: [['timestamp', 'DESC']]
    });
    return txs.map(tx => tx.toJSON());
  }
};

/**
 * Alert Operations
 */
const AlertOps = {
  /**
   * Create a new alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} - Created alert
   */
  async createAlert(alertData) {
    const alert = await Alert.create(alertData);
    return alert.toJSON();
  },
  
  /**
   * Get user's alerts
   * @param {string} telegramId - Telegram user ID
   * @returns {Promise<Array>} - Array of alerts
   */
  async getUserAlerts(telegramId) {
    const alerts = await Alert.findAll({
      where: { 
        telegramId,
        active: true
      },
      order: [['createdAt', 'DESC']]
    });
    return alerts.map(alert => alert.toJSON());
  },
  
  /**
   * Get active alerts for a specific token
   * @param {string} tokenAddress - Token address
   * @returns {Promise<Array>} - Array of alerts
   */
  async getTokenAlerts(tokenAddress) {
    const alerts = await Alert.findAll({
      where: { 
        tokenAddress,
        active: true
      }
    });
    return alerts.map(alert => alert.toJSON());
  },
  
  /**
   * Deactivate an alert
   * @param {string} id - Alert ID
   * @returns {Promise<boolean>} - Success status
   */
  async deactivateAlert(id) {
    const result = await Alert.update(
      { active: false },
      { where: { id } }
    );
    return result[0] > 0;
  },
  
  /**
   * Update alert's last triggered timestamp
   * @param {string} id - Alert ID
   * @returns {Promise<boolean>} - Success status
   */
  async updateAlertTriggered(id) {
    const result = await Alert.update(
      { lastTriggered: new Date() },
      { where: { id } }
    );
    return result[0] > 0;
  }
};

/**
 * CopyTrade Operations
 */
const CopyTradeOps = {
  /**
   * Create a new copy trade configuration
   * @param {Object} copyTradeData - Copy trade data
   * @returns {Promise<Object>} - Created copy trade configuration
   */
  async createCopyTrade(copyTradeData) {
    const copyTrade = await CopyTrade.create(copyTradeData);
    return copyTrade.toJSON();
  },
  
  /**
   * Get user's copy trade configurations
   * @param {string} telegramId - Telegram user ID
   * @returns {Promise<Array>} - Array of copy trade configurations
   */
  async getUserCopyTrades(telegramId) {
    const copyTrades = await CopyTrade.findAll({
      where: { telegramId },
      order: [['createdAt', 'DESC']]
    });
    return copyTrades.map(ct => ct.toJSON());
  },
  
  /**
   * Get all active copy trades for a target wallet
   * @param {string} targetWallet - Target wallet address
   * @returns {Promise<Array>} - Array of copy trade configurations
   */
  async getActiveTargetCopyTrades(targetWallet) {
    const copyTrades = await CopyTrade.findAll({
      where: { 
        targetWallet,
        active: true
      }
    });
    return copyTrades.map(ct => ct.toJSON());
  },
  
  /**
   * Update a copy trade configuration
   * @param {string} id - Copy trade ID
   * @param {Object} copyTradeData - Copy trade data to update
   * @returns {Promise<boolean>} - Success status
   */
  async updateCopyTrade(id, copyTradeData) {
    const result = await CopyTrade.update(
      copyTradeData,
      { where: { id } }
    );
    return result[0] > 0;
  },
  
  /**
   * Toggle copy trade active status
   * @param {string} id - Copy trade ID
   * @param {boolean} active - Active status
   * @returns {Promise<boolean>} - Success status
   */
  async toggleCopyTradeActive(id, active) {
    const result = await CopyTrade.update(
      { active },
      { where: { id } }
    );
    return result[0] > 0;
  }
};

/**
 * Token Operations
 */
const TokenOps = {
  /**
   * Upsert token information
   * @param {string} address - Token address
   * @param {Object} tokenData - Token data
   * @returns {Promise<Object>} - Updated token object
   */
  async upsertToken(address, tokenData) {
    const [token, created] = await Token.findOrCreate({
      where: { address },
      defaults: { address, ...tokenData }
    });
    
    if (!created && tokenData) {
      await token.update(tokenData);
    }
    
    return token.toJSON();
  },
  
  /**
   * Get token information
   * @param {string} address - Token address
   * @returns {Promise<Object|null>} - Token object or null if not found
   */
  async getToken(address) {
    const token = await Token.findByPk(address);
    return token ? token.toJSON() : null;
  },
  
  /**
   * Get all Zora tokens
   * @param {number} limit - Number of tokens to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} - Array of tokens
   */
  async getZoraTokens(limit = 20, offset = 0) {
    const tokens = await Token.findAll({
      where: { isZoraToken: true },
      order: [['priceUpdateTime', 'DESC']],
      limit,
      offset
    });
    return tokens.map(token => token.toJSON());
  },
  
  /**
   * Search tokens by name or symbol
   * @param {string} query - Search query
   * @param {number} limit - Number of tokens to return
   * @returns {Promise<Array>} - Array of tokens
   */
  async searchTokens(query, limit = 10) {
    const tokens = await Token.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${query}%` } },
          { symbol: { [Op.like]: `%${query}%` } }
        ]
      },
      limit
    });
    return tokens.map(token => token.toJSON());
  }
};

module.exports = {
  UserOps,
  TransactionOps,
  AlertOps,
  CopyTradeOps,
  TokenOps
}; 