/**
 * Database Operations
 * 
 * This file contains CRUD operations for MongoDB models.
 */
import { User, Transaction, Alert, CopyTrade, Token  } from './models';

/**
 * User Operations
 */
const UserOps = {
  /**
   * Get a user by Telegram ID
   * @param {string} telegramId - Telegram ID
   * @returns {Promise<Object>} User object
   */
  async getUser(telegramId) {
    console.log(`🔍 Database: Getting user with Telegram ID: ${telegramId}`);
    const user = await User.findOne({ telegramId });
    console.log(`📊 Database: User found:`, user ? 'Yes' : 'No');
    return user;
  },

  /**
   * Create or update a user
   * @param {string} telegramId - Telegram ID
   * @param {Object} userData - User data
   * @returns {Promise<Object>} User object
   */
  async upsertUser(telegramId, userData) {
    console.log(`💾 Database: Upserting user with Telegram ID: ${telegramId}`);
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    const result = await User.findOneAndUpdate({ telegramId }, userData, options);
    console.log(`✅ Database: User upserted successfully`);
    return result;
  },

  /**
   * Update user's wallet
   * @param {string} telegramId - Telegram ID
   * @param {string} walletAddress - Wallet address
   * @param {string} encryptedPrivateKey - Encrypted private key
   * @returns {Promise<Object>} Updated user object
   */
  async updateUserWallet(telegramId, walletAddress, encryptedPrivateKey) {
    return await User.findOneAndUpdate(
      { telegramId },
      { walletAddress, encryptedPrivateKey },
      { new: true }
    );
  },

  /**
   * Update user's PIN
   * @param {string} telegramId - Telegram ID
   * @param {string} pin - Hashed PIN
   * @returns {Promise<Object>} Updated user object
   */
  async updateUserPin(telegramId, pin) {
    return await User.findOneAndUpdate(
      { telegramId },
      { pin },
      { new: true }
    );
  },

  /**
   * Update user's 2FA status
   * @param {string} telegramId - Telegram ID
   * @param {boolean} enabled - 2FA enabled status
   * @param {string} secret - 2FA secret
   * @returns {Promise<Object>} Updated user object
   */
  async updateUser2FA(telegramId, enabled, secret) {
    return await User.findOneAndUpdate(
      { telegramId },
      { twoFactorEnabled: enabled, twoFactorSecret: secret },
      { new: true }
    );
  },

  /**
   * Update user's last active timestamp
   * @param {string} telegramId - Telegram ID
   * @returns {Promise<Object>} Updated user object
   */
  async updateLastActive(telegramId) {
    return await User.findOneAndUpdate(
      { telegramId },
      { lastActive: new Date() },
      { new: true }
    );
  },

  /**
   * Get all users
   * @returns {Promise<Array>} Array of user objects
   */
  async getAllUsers() {
    return await User.find();
  },

  /**
   * Get users with wallets
   * @returns {Promise<Array>} Array of user objects with wallets
   */
  async getUsersWithWallets() {
    return await User.find({ walletAddress: { $exists: true, $ne: null } });
  }
};

/**
 * Transaction Operations
 */
const TransactionOps = {
  /**
   * Create a transaction
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async createTransaction(transactionData) {
    console.log(`💾 Database: Creating transaction for user: ${transactionData.telegramId}`);
    const transaction = new Transaction(transactionData);
    const result = await transaction.save();
    console.log(`✅ Database: Transaction created with ID: ${result._id}`);
    return result;
  },

  /**
   * Get a transaction by ID
   * @param {string} id - Transaction ID
   * @returns {Promise<Object>} Transaction object
   */
  async getTransaction(id) {
    return await Transaction.findById(id);
  },

  /**
   * Get a transaction by hash
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction object
   */
  async getTransactionByHash(txHash) {
    return await Transaction.findOne({ txHash });
  },

  /**
   * Update a transaction
   * @param {string} id - Transaction ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransaction(id, updateData) {
    return await Transaction.findByIdAndUpdate(id, updateData, { new: true });
  },

  /**
   * Update a transaction by hash
   * @param {string} txHash - Transaction hash
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransactionByHash(txHash, updateData) {
    return await Transaction.findOneAndUpdate({ txHash }, updateData, { new: true });
  },

  /**
   * Get user's transactions
   * @param {string} telegramId - Telegram ID
   * @param {number} limit - Limit results
   * @returns {Promise<Array>} Array of transaction objects
   */
  async getUserTransactions(telegramId, limit = 10) {
    return await Transaction.find({ telegramId })
      .sort({ timestamp: -1 })
      .limit(limit);
  },

  /**
   * Get user's transactions for a specific token
   * @param {string} telegramId - Telegram ID
   * @param {string} tokenAddress - Token address
   * @returns {Promise<Array>} Array of transaction objects
   */
  async getUserTokenTransactions(telegramId, tokenAddress) {
    return await Transaction.find({ telegramId, tokenAddress })
      .sort({ timestamp: -1 });
  },

  /**
   * Get pending transactions
   * @returns {Promise<Array>} Array of pending transactions
   */
  async getPendingTransactions() {
    return await Transaction.find({ status: 'pending' });
  }
};

/**
 * Alert Operations
 */
const AlertOps = {
  /**
   * Create an alert
   * @param {Object} alertData - Alert data
   * @returns {Promise<Object>} Created alert
   */
  async createAlert(alertData) {
    const alert = new Alert(alertData);
    return await alert.save();
  },

  /**
   * Get an alert by ID
   * @param {string} id - Alert ID
   * @returns {Promise<Object>} Alert object
   */
  async getAlert(id) {
    return await Alert.findById(id);
  },

  /**
   * Update an alert
   * @param {string} id - Alert ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated alert
   */
  async updateAlert(id, updateData) {
    return await Alert.findByIdAndUpdate(id, updateData, { new: true });
  },

  /**
   * Delete an alert
   * @param {string} id - Alert ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteAlert(id) {
    return await Alert.findByIdAndDelete(id);
  },

  /**
   * Get user's alerts
   * @param {string} telegramId - Telegram ID
   * @returns {Promise<Array>} Array of alert objects
   */
  async getUserAlerts(telegramId) {
    return await Alert.find({ telegramId });
  },

  /**
   * Get user's active alerts
   * @param {string} telegramId - Telegram ID
   * @returns {Promise<Array>} Array of active alert objects
   */
  async getUserActiveAlerts(telegramId) {
    return await Alert.find({ telegramId, active: true });
  },

  /**
   * Get alerts for a specific token
   * @param {string} tokenAddress - Token address
   * @returns {Promise<Array>} Array of alert objects
   */
  async getTokenAlerts(tokenAddress) {
    return await Alert.find({ tokenAddress, active: true });
  }
};

/**
 * CopyTrade Operations
 */
const CopyTradeOps = {
  /**
   * Create a copy trade
   * @param {Object} copyTradeData - Copy trade data
   * @returns {Promise<Object>} Created copy trade
   */
  async createCopyTrade(copyTradeData) {
    const copyTrade = new CopyTrade(copyTradeData);
    return await copyTrade.save();
  },

  /**
   * Get a copy trade by ID
   * @param {string} id - Copy trade ID
   * @returns {Promise<Object>} Copy trade object
   */
  async getCopyTrade(id) {
    return await CopyTrade.findById(id);
  },

  /**
   * Update a copy trade
   * @param {string} id - Copy trade ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated copy trade
   */
  async updateCopyTrade(id, updateData) {
    return await CopyTrade.findByIdAndUpdate(id, updateData, { new: true });
  },

  /**
   * Delete a copy trade
   * @param {string} id - Copy trade ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteCopyTrade(id) {
    return await CopyTrade.findByIdAndDelete(id);
  },

  /**
   * Get user's copy trades
   * @param {string} telegramId - Telegram ID
   * @param {number} timeout - Optional timeout in milliseconds
   * @returns {Promise<Array>} Array of copy trade objects
   */
  async getUserCopyTrades(telegramId, timeout = 5000) {
    try {
      // Create a query with timeout option
      const query = CopyTrade.find({ telegramId });
      
      // Set a timeout for the query
      query.maxTimeMS(timeout);
      
      // Execute the query with timeout
      return await query.exec();
    } catch (error) {
      console.error(`Error fetching copy trades for user ${telegramId}:`, error.message);
      // Return empty array on error
      return [];
    }
  },

  /**
   * Get user's active copy trades
   * @param {string} telegramId - Telegram ID
   * @param {number} timeout - Optional timeout in milliseconds
   * @returns {Promise<Array>} Array of active copy trade objects
   */
  async getUserActiveCopyTrades(telegramId, timeout = 5000) {
    try {
      // Create a query with timeout option
      const query = CopyTrade.find({ telegramId, active: true });
      
      // Set a timeout for the query
      query.maxTimeMS(timeout);
      
      // Execute the query with timeout
      return await query.exec();
    } catch (error) {
      console.error(`Error fetching active copy trades for user ${telegramId}:`, error.message);
      // Return empty array on error
      return [];
    }
  },

  /**
   * Get all active copy trades
   * @param {number} timeout - Optional timeout in milliseconds
   * @returns {Promise<Array>} Array of active copy trade objects
   */
  async getAllActiveCopyTrades(timeout = 5000) {
    try {
      // Create a query with timeout option
      const query = CopyTrade.find({ active: true });
      
      // Set a timeout for the query
      query.maxTimeMS(timeout);
      
      // Execute the query with timeout
      return await query.exec();
    } catch (error) {
      console.error(`Error fetching all active copy trades:`, error.message);
      // Return empty array on error
      return [];
    }
  },

  /**
   * Get copy trades for a target wallet
   * @param {string} targetWallet - Target wallet address
   * @param {number} timeout - Optional timeout in milliseconds
   * @returns {Promise<Array>} Array of copy trade objects
   */
  async getCopyTradesByTarget(targetWallet, timeout = 5000) {
    try {
      // Create a query with timeout option
      const query = CopyTrade.find({ targetWallet, active: true });
      
      // Set a timeout for the query
      query.maxTimeMS(timeout);
      
      // Execute the query with timeout
      return await query.exec();
    } catch (error) {
      console.error(`Error fetching copy trades for target wallet ${targetWallet}:`, error.message);
      // Return empty array on error
      return [];
    }
  }
};

/**
 * Token Operations
 */
const TokenOps = {
  /**
   * Create or update a token
   * @param {string} address - Token address
   * @param {Object} tokenData - Token data
   * @returns {Promise<Object>} Token object
   */
  async upsertToken(address, tokenData) {
    const options = { new: true, upsert: true, setDefaultsOnInsert: true };
    return await Token.findOneAndUpdate({ address }, tokenData, options);
  },

  /**
   * Get a token by address
   * @param {string} address - Token address
   * @returns {Promise<Object>} Token object
   */
  async getToken(address) {
    return await Token.findOne({ address });
  },

  /**
   * Get tokens by creator
   * @param {string} creatorAddress - Creator address
   * @returns {Promise<Array>} Array of token objects
   */
  async getTokensByCreator(creatorAddress) {
    return await Token.find({ creatorAddress });
  },

  /**
   * Get Zora tokens
   * @param {number} limit - Limit results
   * @returns {Promise<Array>} Array of Zora token objects
   */
  async getZoraTokens(limit = 20) {
    return await Token.find({ isZoraToken: true })
      .sort({ priceUpdateTime: -1 })
      .limit(limit);
  },

  /**
   * Update token price
   * @param {string} address - Token address
   * @param {string} price - Token price
   * @returns {Promise<Object>} Updated token
   */
  async updateTokenPrice(address, price) {
    return await Token.findOneAndUpdate(
      { address },
      { lastPrice: price, priceUpdateTime: new Date() },
      { new: true }
    );
  },

  /**
   * Search tokens by name or symbol
   * @param {string} query - Search query
   * @param {number} limit - Limit results
   * @returns {Promise<Array>} Array of matching token objects
   */
  async searchTokens(query, limit = 10) {
    const regex = new RegExp(query, 'i');
    return await Token.find({
      $or: [
        { name: regex },
        { symbol: regex }
      ]
    }).limit(limit);
  }
};

export { 
  UserOps,
  TransactionOps,
  AlertOps,
  CopyTradeOps,
  TokenOps
 }; 