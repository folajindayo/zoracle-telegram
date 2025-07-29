// Copy-Trading & Watchlists Module
const { ethers } = require('ethers');
const { CONFIG } = require('./config');
const trading = require('./trading');
const walletManager = require('./wallet');

// Provider setup (mainnet and testnet)
const providers = {
  mainnet: new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL),
  testnet: new ethers.providers.JsonRpcProvider('https://sepolia.base.org') // Base Sepolia testnet
};

// In-memory watchlists and mirror configurations (use DB in production)
const watchlists = new Map(); // userId => { name: string, tokens: string[], alerts: boolean }
const mirrorConfigs = new Map(); // userId => { targetWallet: string, slippageGuard: number, active: boolean, sandbox: boolean }

// Event emitter for copy trades (simplified; use Alchemy webhook in production)
const eventEmitter = new require('events').EventEmitter();
const tradeEvents = new eventEmitter();

/**
 * Create or update watchlist
 * @param {string} userId - User ID
 * @param {string} name - Watchlist name
 * @param {Array<string>} tokens - Token addresses
 * @param {boolean} alerts - Enable grouped alerts
 */
function createWatchlist(userId, name, tokens, alerts = true) {
  watchlists.set(userId, { name, tokens, alerts });
}

/**
 * Get user's watchlists
 * @param {string} userId - User ID
 * @returns {Object} - Watchlist data
 */
function getWatchlists(userId) {
  return watchlists.get(userId) || { tokens: [] };
}

/**
 * Configure mirror trading
 * @param {string} userId - User ID
 * @param {string} targetWallet - Wallet to mirror
 * @param {number} slippageGuard - Max slippage percent
 * @param {boolean} sandbox - Use testnet mode
 */
function configureMirror(userId, targetWallet, slippageGuard = 2, sandbox = false) {
  mirrorConfigs.set(userId, { targetWallet, slippageGuard, active: true, sandbox });
  startMonitoring(userId, targetWallet, sandbox);
}

/**
 * Start monitoring target wallet for trades
 * @param {string} userId - User ID
 * @param {string} targetWallet - Wallet to monitor
 * @param {boolean} sandbox - Testnet mode
 */
function startMonitoring(userId, targetWallet, sandbox) {
  const provider = providers[sandbox ? 'testnet' : 'mainnet'];

  // Simplified monitoring - in real, use Alchemy's transaction webhooks
  // This is a polling mock for demonstration
  setInterval(async () => {
    // Fetch recent transactions (mock)
    const txs = await provider.getTransactionCount(targetWallet); // Placeholder
    // For each new trade tx, parse and emit
    tradeEvents.emit('trade', { userId, target: targetWallet, trade: { token: '0x...', amount: '1', isBuy: true } });
  }, 10000); // Poll every 10s
}

// Listen for trades and mirror
tradeEvents.on('trade', async (data) => {
  const config = mirrorConfigs.get(data.userId);
  if (!config.active) return;

  // Check slippage
  const quote = await trading.getTokenQuote(data.trade.token, data.trade.amount, data.trade.isBuy);
  if (quote.priceImpact > config.slippageGuard) {
    // Notify user of skipped trade due to slippage
    return;
  }

  // Execute mirrored trade
  await trading.executeSwap(data.userId, data.trade.token, data.trade.amount, data.trade.isBuy, config.slippageGuard);
});

/**
 * Toggle sandbox mode
 * @param {string} userId - User ID
 * @param {boolean} enable - Enable/disable sandbox
 */
function toggleSandbox(userId, enable) {
  const config = mirrorConfigs.get(userId);
  if (config) {
    config.sandbox = enable;
    // Restart monitoring with new provider
    startMonitoring(userId, config.targetWallet, enable);
  }
}

module.exports = {
  createWatchlist,
  getWatchlists,
  configureMirror,
  toggleSandbox
};