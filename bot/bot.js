const TelegramBot = require('node-telegram-bot-api');
const { CONFIG } = require('../config');
const { users, token } = require('./baseBot');

// Initialize bot with polling
let bot;
try {
  bot = new TelegramBot(token, { 
    polling: true,
    filepath: false // Disable file downloading to avoid disk space issues
  });
  
  // Add isPolling method to check if bot is polling
  bot.isPolling = function() {
    return this.polling;
  };
  
  // Add specific error handlers
  bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
      console.error('❌ Multiple bot instances detected!');
      console.error('Make sure only one instance of the bot is running.');
      console.error('Try running: pkill -f "node index.js" before starting again.');
      process.exit(1);
    } else if (error.code === 'ETELEGRAM' && error.message.includes('401 Unauthorized')) {
      console.error('❌ Invalid Telegram bot token!');
      console.error('Please check your TELEGRAM_BOT_TOKEN in the .env file.');
      console.error('You can get a valid token from @BotFather on Telegram.');
      process.exit(1);
    } else {
      console.error('Polling error:', error.code, error.message);
    }
  });
} catch (error) {
  console.error('❌ Failed to initialize Telegram bot:', error.message);
  process.exit(1);
}

// Logging Middleware
bot.on('message', (msg) => {
  console.log(`[${new Date().toISOString()}] Chat ID: ${msg.chat.id}, User: ${msg.from.username || msg.from.first_name}, Message: ${msg.text}`);
});

// Start Command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `Welcome! I am your Zoracle Telegram Bot. How can I assist you today?`);
});

// Help Command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
Here are the commands you can use:
/start - Start the bot and get a welcome message.
/help - Display this help message.
/wallet - Manage your wallet (create, import, view balance).
/balance - Check your ETH and token balances.
/buy <token_address> <amount> - Buy tokens with ETH.
/sell <token_address> <amount> - Sell tokens for ETH.
/portfolio - View your token portfolio.
/transactions - View your transaction history.
/pnl - Calculate profit/loss for your holdings.
/search <query> - Search for tokens.
/trending - Show trending tokens.
/new - Show newly created tokens.
/alerts - Manage your price alerts.
/addalert <token_address> - Add a price alert.
/mirror <wallet_address> - Mirror another wallet's trades.
/mirrors - List active mirrors.
`;
  bot.sendMessage(chatId, helpMessage);
});

// About Command
bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;
  const aboutMessage = `
Zoracle Telegram Bot v${CONFIG.BOT_VERSION}

A Telegram bot for trading Zora content tokens on Base blockchain with advanced features including wallet management, swap engine, portfolio tracking, content discovery, alerts, and copy-trading.

Built with ❤️ for the Base ecosystem.
`;
  bot.sendMessage(chatId, aboutMessage);
});

// Import command handlers
require('./handlers/walletHandlers')(bot, users);
require('./handlers/tradeHandlers')(bot, users);
require('./handlers/portfolioHandlers')(bot, users);
require('./handlers/discoveryHandlers')(bot, users);
require('./handlers/alertHandlers')(bot, users);
require('./handlers/copytradeHandlers')(bot, users);

module.exports = { bot, users }; 