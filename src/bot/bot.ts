import { CONFIG  } from '../config';
import { bot, users  } from './baseBot';

// Add isPolling method to check if bot is polling if not already added
if (!bot.isPolling) {
  bot.isPolling = function() {
    return this.polling;
  };
}

// Add specific error handlers if not already added
bot.on('polling_error', (error) => {
  if ((error as any).code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
    console.error('❌ Multiple bot instances detected!');
    console.error('Make sure only one instance of the bot is running.');
    console.error('Try running: npm run kill-bot before starting again.');
  } else if ((error as any).code === 'ETELEGRAM' && error.message.includes('401 Unauthorized')) {
    console.error('❌ Invalid Telegram bot token!');
    console.error('Please check your TELEGRAM_BOT_TOKEN in the .env file.');
    console.error('You can get a valid token from @BotFather on Telegram.');
  }
});

// Logging Middleware
bot.on('message', (msg) => {
  console.log(`[${new Date().toISOString()}] Chat ID: ${msg.chat.id}, User: ${msg.from.username || msg.from.first_name}, Message: ${msg.text}`);
});

// Start Command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  // Use HTML mode instead of MarkdownV2 to avoid escaping issues
  bot.sendMessage(chatId, 'Welcome! I am your Zoracle Telegram Bot. How can I assist you today?', { parse_mode: 'HTML' });
});

// Help Command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
<b>Here are the commands you can use:</b>
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
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

// About Command
bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;
  const aboutMessage = `
<b>Zoracle Telegram Bot v${CONFIG.BOT_VERSION}</b>

A Telegram bot for trading Zora content tokens on Base blockchain with advanced features including wallet management, swap engine, portfolio tracking, content discovery, alerts, and copy-trading.

Built with ❤️ for the Base ecosystem.
`;
  bot.sendMessage(chatId, aboutMessage, { parse_mode: 'HTML' });
});

// Import handlers
import './handlers/walletHandlers';
import './handlers/tradeHandlers';
import './handlers/portfolioHandlers';
import './handlers/discoveryHandlers';
import './handlers/alertHandlers';
import './handlers/copytradeHandlers';

// Handlers are initialized when imported

export {  bot, users  }; 