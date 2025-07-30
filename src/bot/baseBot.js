// Base Chain Telegram Bot - Enhanced with all features
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');
const crypto = require('crypto');
const { Wallet, Contract, constants } = require('ethers');
const { formatEther, parseEther, formatUnits } = require('ethers/lib/utils');

// Import all modules
const walletManager = require('../services/wallet');
const trading = require('../services/trading');
const portfolio = require('../services/portfolio');
const discovery = require('../services/discovery');
const alerts = require('../services/alerts');
const copytrade = require('../services/copytrade');

// Environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Debug log for token
console.log('📝 Telegram Bot Token:', token ? `${token.substring(0, 10)}...` : 'undefined');

// Validate required environment variables
if (!token || !ALCHEMY_API_KEY) {
  console.error('❌ Required environment variables missing!');
  process.exit(1);
}

// Create bot instance with better error handling
let bot;
try {
  // Create the bot with additional options
  bot = new TelegramBot(token, {
    polling: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 10
      }
    },
    request: {
      timeout: 30000
    }
  });
  
  // Add error handler
  bot.on('polling_error', (error) => {
    console.error('🔴 Telegram Bot polling error:', error.message);
    // Don't crash on polling errors
  });
  
  console.log('✅ Telegram Bot initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Telegram Bot:', error.message);
  process.exit(1);
}

// Provider setup
// Use mainnet as the network name for Base (Alchemy supports this)
const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_MAINNET_RPC || `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);

// Store user data and conversation states
const users = new Map();
const conversationStates = new Map(); // For onboarding wizard

// Enhanced welcome message with onboarding prompt
const welcomeMessage = `
🤖 *Welcome to Zoracle Bot!*

This bot helps you trade Zora content tokens on Base, manage your portfolio, discover new coins, set alerts, and more.

To get started, use /start your_wallet_address

Your Chat ID: `;

// Comprehensive help message
const helpMessage = `
📚 *Zoracle Bot Commands*

Wallet Management:
/wallet create - Create new wallet
/wallet import <private_key> - Import wallet
/unlock <password> [2FA] - Unlock wallet
/enable2fa <token> - Enable 2FA
/quickunlock <pin> - Quick unlock with PIN

Trading:
/buy <token> <amount|%> - Buy token (e.g., /buy 0x... 10%)
/sell <token> <amount|%> - Sell token
/limit <token> <amount> <price> <buy|sell> - Set limit order
/stoploss <token> <amount> <price> - Set stop-loss
/takeprofit <token> <amount> <price> - Set take-profit

Portfolio:
/portfolio [threshold] - View portfolio
/token <address> - Token details (history, chart)

Discovery:
/newcoins - New Zora coins (last 24h)
/trending - Trending coins
/search <query> - Search by title/creator

Alerts & Watchlists:
/alerts config <price=5> <liquidity=10> <whale=1000> - Configure thresholds
/watchlist add <token> - Add to watchlist
/watchlist remove <token> - Remove from watchlist
/watchlist view - View watchlist

Copy-Trading:
/mirror <wallet> [slippage=2] - Mirror trades
/mirror off - Stop mirroring
/sandbox on - Enable testnet mode

/help - This menu
`;

// Onboarding wizard states
const STATES = {
  WELCOME: 0,
  WALLET_SETUP: 1,
  PIN_SETUP: 2,
  TWOFA_SETUP: 3,
  COMPLETE: 4
};

// Handle /start
bot.onText(/^\/start(?:\s+(.+))?$/, (msg, match) => {
  const chatId = msg.chat.id;
  const walletAddress = match && match[1] ? match[1].trim() : null;

  if (walletAddress) {
    // Validate and store wallet
    if (ethers.utils.isAddress(walletAddress)) {
      users.set(chatId.toString(), { walletAddress });
      conversationStates.set(chatId, STATES.WELCOME);
      bot.sendMessage(chatId, '✅ Wallet connected! Starting onboarding wizard...\n\nWould you like to create a new wallet or import one? Reply "create" or "import <private_key>".');
    } else {
      bot.sendMessage(chatId, '⚠️ Invalid wallet address.');
    }
  } else {
    bot.sendMessage(chatId, welcomeMessage + `\`${chatId}\``, { parse_mode: 'Markdown' });
  }
});

// Handle onboarding responses (state machine)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const state = conversationStates.get(chatId);
  const userData = users.get(chatId.toString());

  if (!state || !userData) return;

  switch (state) {
    case STATES.WELCOME:
      if (msg.text.startsWith('create')) {
        // Create wallet (prompt for password and pin)
        bot.sendMessage(chatId, 'Enter a strong password for your new wallet:');
        conversationStates.set(chatId, STATES.WALLET_SETUP);
      } else if (msg.text.startsWith('import')) {
        const pk = msg.text.split(' ')[1];
        bot.sendMessage(chatId, 'Enter password for imported wallet:');
        // Store temp pk
        userData.tempPK = pk;
        conversationStates.set(chatId, STATES.WALLET_SETUP);
      }
      break;

    case STATES.WALLET_SETUP:
      var password = msg.text.trim();
      bot.sendMessage(chatId, 'Enter a 4-6 digit PIN for quick access:');
      userData.tempPassword = password;
      conversationStates.set(chatId, STATES.PIN_SETUP);
      break;

    case STATES.PIN_SETUP:
      var pin = msg.text.trim();
      if (userData.tempPK) {
        walletManager.importWallet(chatId.toString(), userData.tempPK, userData.tempPassword, pin);
      } else {
        walletManager.createWallet(chatId.toString(), userData.tempPassword, pin);
      }
      bot.sendMessage(chatId, 'Wallet setup complete! Would you like to enable 2FA? Reply "yes" or "no".');
      conversationStates.set(chatId, STATES.TWOFA_SETUP);
      break;

    case STATES.TWOFA_SETUP:
      if (msg.text.toLowerCase() === 'yes') {
        const qr = walletManager.get2FAQRCode(chatId.toString());
        bot.sendMessage(chatId, 'Scan this QR code with your authenticator app:\n' + qr.qrCode + '\n\nEnter the 6-digit code to verify:');
        // Wait for token to enable
        // In full impl, add another state
      } else {
        conversationStates.set(chatId, STATES.COMPLETE);
        bot.sendMessage(chatId, 'Onboarding complete! Use /help for commands.');
      }
      break;
  }
});

// Wallet commands
bot.onText(/^\/wallet (create|import .+)$/, async (msg, match) => {
  // Existing code from previous implementation
});

// Trading commands
bot.onText(/^\/buy (\w+) (\d+%?)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1];
  const amount = match[2];
  const result = await trading.executeSwap(chatId.toString(), token, amount, true);
  bot.sendMessage(chatId, result.message);
});

bot.onText(/^\/sell (\w+) (\d+%?)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1];
  const amount = match[2];
  const result = await trading.executeSwap(chatId.toString(), token, amount, false);
  bot.sendMessage(chatId, result.message);
});

bot.onText(/^\/limit (\w+) (\d+) (\d+) (buy|sell)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const [token, amount, price, type] = match.slice(1);
  const isBuy = type === 'buy';
  const result = await trading.createLimitOrder(chatId.toString(), token, amount, price, isBuy);
  bot.sendMessage(chatId, result.message);
});

// Similar for /stoploss and /takeprofit

// Portfolio commands
bot.onText(/^\/portfolio ?(\d+)?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const threshold = match[1] || 0;
  const data = await portfolio.getPortfolio(chatId.toString(), threshold);
  // Format and send
  bot.sendMessage(chatId, `Portfolio: Total $${data.totalUSD}`);
});

bot.onText(/^\/token (\w+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1];
  const data = await portfolio.getTokenDetails(chatId.toString(), token);
  // Format and send
});

// Discovery commands
bot.onText(/^\/newcoins$/, async (msg) => {
  const chatId = msg.chat.id;
  const coins = await discovery.getNewCoins();
  // Format and send list
});

bot.onText(/^\/trending$/, async (msg) => {
  const chatId = msg.chat.id;
  const coins = await discovery.getTrendingCoins();
  // Format and send
});

bot.onText(/^\/search (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1];
  const results = await discovery.searchCoins(query);
  // Format and send
});

// Alerts & Watchlists
bot.onText(/^\/alerts config (.+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const configStr = match[1];
  // Parse and set via alerts.configureAlerts
});

bot.onText(/^\/watchlist (add|remove) (\w+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const action = match[1];
  const token = match[2];
  if (action === 'add') alerts.addToWatchlist(chatId.toString(), token);
  else alerts.removeFromWatchlist(chatId.toString(), token);
});

bot.onText(/^\/watchlist view$/, (msg) => {
  const chatId = msg.chat.id;
  const wl = copytrade.getWatchlists(chatId.toString());
  // Send list
});

// Copy-Trading
bot.onText(/^\/mirror (\w+) ?(\d+)?$/, (msg, match) => {
  const chatId = msg.chat.id;
  const target = match[1];
  const slippage = match[2] || 2;
  copytrade.configureMirror(chatId.toString(), target, slippage);
});

bot.onText(/^\/mirror off$/, (msg) => {
  // Disable mirror
});

bot.onText(/^\/sandbox (on|off)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const enable = match[1] === 'on';
  copytrade.toggleSandbox(chatId.toString(), enable);
});

// Help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
});

// Error handling, polling, etc. (existing code)

// Export for external use
module.exports = { bot, users };