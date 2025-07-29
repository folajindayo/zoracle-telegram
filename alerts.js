// Alerts & Notifications Module
const { ethers } = require('ethers');
const { CONFIG } = require('./config');
const walletManager = require('./wallet');
const discovery = require('./discovery');

// Provider setup
const provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);

// In-memory alert configurations (use DB in production)
const userAlerts = new Map(); // userId => { watchlist: [], thresholds: { price: 5, liquidity: 10, whale: 1000 } }

// Event listeners for real-time alerts
// This would use websockets or Alchemy notify in production

/**
 * Configure alerts for a user
 * @param {string} userId - User ID
 * @param {Object} config - Alert configuration
 */
function configureAlerts(userId, config) {
  userAlerts.set(userId, {
    watchlist: config.watchlist || [],
    thresholds: {
      priceChange: config.priceChange || 5, // percent
      liquidityChange: config.liquidityChange || 10, // percent
      whaleAmount: config.whaleAmount || 1000 // USD
    },
    contentAlerts: config.contentAlerts || true // Enable content-specific alerts
  });
}

/**
 * Add token to watchlist
 * @param {string} userId - User ID
 * @param {string} tokenAddress - Token to watch
 */
function addToWatchlist(userId, tokenAddress) {
  if (!userAlerts.has(userId)) {
    configureAlerts(userId, {});
  }
  const alerts = userAlerts.get(userId);
  if (!alerts.watchlist.includes(tokenAddress)) {
    alerts.watchlist.push(tokenAddress);
  }
}

/**
 * Remove token from watchlist
 * @param {string} userId - User ID
 * @param {string} tokenAddress - Token to remove
 */
function removeFromWatchlist(userId, tokenAddress) {
  if (userAlerts.has(userId)) {
    const alerts = userAlerts.get(userId);
    alerts.watchlist = alerts.watchlist.filter(t => t !== tokenAddress);
  }
}

/**
 * Check and send price alert
 * @param {string} tokenAddress - Token address
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - New price
 */
function checkPriceAlert(tokenAddress, oldPrice, newPrice) {
  const change = ((newPrice - oldPrice) / oldPrice) * 100;
  for (const [userId, alerts] of userAlerts.entries()) {
    if (alerts.watchlist.includes(tokenAddress) && Math.abs(change) >= alerts.thresholds.priceChange) {
      // Send notification via bot
      // bot.sendMessage(userId, `Price alert: ${tokenAddress} changed by ${change}%`);
    }
  }
}

/**
 * Check and send liquidity alert
 * @param {string} tokenAddress - Token address
 * @param {number} oldLiquidity - Previous liquidity USD
 * @param {number} newLiquidity - New liquidity USD
 */
function checkLiquidityAlert(tokenAddress, oldLiquidity, newLiquidity) {
  const change = ((newLiquidity - oldLiquidity) / oldLiquidity) * 100;
  for (const [userId, alerts] of userAlerts.entries()) {
    if (alerts.watchlist.includes(tokenAddress) && Math.abs(change) >= alerts.thresholds.liquidityChange) {
      // Send notification
    }
  }
}

/**
 * Check and send whale swap alert
 * @param {string} tokenAddress - Token address
 * @param {number} amountUSD - Swap amount in USD
 * @param {string} txHash - Transaction hash
 */
function checkWhaleAlert(tokenAddress, amountUSD, txHash) {
  for (const [userId, alerts] of userAlerts.entries()) {
    if (alerts.watchlist.includes(tokenAddress) && amountUSD >= alerts.thresholds.whaleAmount) {
      // Send whale alert
    }
  }
}

/**
 * Send content-specific alert
 * @param {string} creator - Creator address
 * @param {string} action - Action type (mint, royalty change)
 * @param {Object} details - Additional details
 */
function sendContentAlert(creator, action, details) {
  for (const [userId, alerts] of userAlerts.entries()) {
    if (alerts.contentAlerts /* && follows creator */) {
      // Send notification
    }
  }
}

// Monitoring loop (simplified)
setInterval(async () => {
  // Check new coins for content alerts
  const newCoins = await discovery.getNewCoins();
  newCoins.forEach(coin => {
    sendContentAlert(coin.creator, 'mint', { token: coin.address });
  });

  // Other monitoring...
}, 60000); // Check every minute

module.exports = {
  configureAlerts,
  addToWatchlist,
  removeFromWatchlist,
  checkPriceAlert,
  checkLiquidityAlert,
  checkWhaleAlert,
  sendContentAlert
};