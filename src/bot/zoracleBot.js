// Zoracle Telegram Bot for Creator Activity Notifications
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Get token from environment variables with no fallback (force use of .env)
const token = process.env.TELEGRAM_BOT_TOKEN;

// Validate required environment variables
if (!token) {
  console.error('❌ ERROR: TELEGRAM_BOT_TOKEN is not set in environment variables!');
  console.error('Please create a .env file with your bot token or set it as an environment variable.');
  process.exit(1); // Exit with error
}

// Create a bot instance
const bot = new TelegramBot(token, { polling: true });

// Store user data
const users = new Map();

// Welcome message
const welcomeMessage = `
🤖 *Welcome to the Zoracle Creator Activity Bot!*

This bot will notify you when creators you follow mint new tokens or interact with existing ones.

To get started, please connect your wallet address using the command:
\`/start your_wallet_address\`

For example:
\`/start 0x1234abcd...\`

Your Chat ID is: 
`;

// Help message
const helpMessage = `
📚 *Zoracle Bot Commands:*

/start wallet_address - Connect your wallet to receive notifications
/status - Check your connection status
/chatid - Get your Telegram Chat ID
/help - Show this help message

Need more help? Visit [zoracle.io](https://zoracle.io) for more information.
`;

// Verify bot is connected
bot.getMe().then(botInfo => {
  console.log('✅ Bot connected successfully!');
  console.log(`📝 Bot username: @${botInfo.username}`);
  console.log('🚀 Zoracle Creator Activity Bot is running...');
}).catch(error => {
  console.error('❌ Failed to connect bot:', error);
});

// Handle /start command with parameter
bot.onText(/^\/start\s+(.+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const walletAddress = match[1].trim();
  
  console.log(`Received /start command with wallet from ${chatId}: ${walletAddress}`);
  
  // Validate wallet address format (basic check)
  if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    bot.sendMessage(chatId, '⚠️ Invalid wallet address format. Please use a valid Ethereum address starting with 0x followed by 40 hexadecimal characters.');
    return;
  }
  
  // Store user data
  users.set(chatId.toString(), {
    walletAddress,
    username: msg.from.username || 'Unknown',
    firstName: msg.from.first_name || '',
    lastName: msg.from.last_name || '',
    followedCreators: [],
    lastActive: new Date().toISOString()
  });
  
  // Send confirmation
  bot.sendMessage(chatId, 
    `✅ *Connected Successfully!*\n\nYour wallet address \`${walletAddress}\` has been connected to this chat.\n\nTo complete setup, go back to the Zoracle website and enter your Chat ID:\n\`${chatId}\`\n\nYou'll start receiving notifications when creators you follow take actions.`,
    { parse_mode: 'Markdown' }
  );
  
  console.log(`New user connected: ${chatId} with wallet ${walletAddress}`);
});

// Handle plain /start command (without parameters)
bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received plain /start command from ${chatId}`);
  bot.sendMessage(chatId, welcomeMessage + `\`${chatId}\``, { parse_mode: 'Markdown' });
});

// Handle /chatid command
bot.onText(/\/chatid/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received /chatid command from ${chatId}`);
  bot.sendMessage(chatId, `Your Chat ID is: \`${chatId}\``, { parse_mode: 'Markdown' });
});

// Handle /status command
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received /status command from ${chatId}`);
  const userData = users.get(chatId.toString());
  
  if (!userData) {
    bot.sendMessage(chatId, '❌ You are not connected yet. Please use `/start your_wallet_address` to connect.', { parse_mode: 'Markdown' });
    return;
  }
  
  bot.sendMessage(chatId, 
    `📊 *Your Connection Status*\n\nWallet: \`${userData.walletAddress}\`\nUsername: @${userData.username}\nChat ID: \`${chatId}\`\nConnected since: ${new Date(userData.lastActive).toLocaleString()}`,
    { parse_mode: 'Markdown' }
  );
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  console.log(`Received /help command from ${msg.chat.id}`);
  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown', disable_web_page_preview: true });
});

// Handle all other messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  // Ignore commands that we've already handled
  if (msg.text && (
    msg.text.startsWith('/start') || 
    msg.text === '/help' || 
    msg.text === '/status' ||
    msg.text === '/chatid'
  )) {
    return;
  }
  
  console.log(`Received message from ${chatId}: ${msg.text}`);
  
  // Check if user is registered
  const userData = users.get(chatId.toString());
  if (userData) {
    bot.sendMessage(chatId, 'I only respond to commands. Try /help for a list of available commands.');
  } else {
    bot.sendMessage(chatId, welcomeMessage + `\`${chatId}\``, { parse_mode: 'Markdown' });
  }
});

// Enhanced error handling
bot.on('polling_error', (error) => {
  console.error('Polling error details:', error.code, error.message);
  if (error.code === 'ETELEGRAM') {
    console.error('Telegram API error. Check your bot token!');
  }
  if (error.code === 'ENOTFOUND') {
    console.error('Network error. Check your internet connection!');
  }
});

// Sample function to send notifications (this would be called by your web app)
function sendNotification(chatId, creatorAddress, tokenAddress, transactionHash) {
  const message = `
🚨 *Creator Activity Detected*

A creator you're following has taken action:

Creator: \`${creatorAddress}\`
Token: \`${tokenAddress}\`
Transaction: [View on BaseScan](https://basescan.org/tx/${transactionHash})
Token: [View on Zoracle](https://zoracle.io/token/${tokenAddress})

_This notification was sent automatically by Zoracle._
`;

  bot.sendMessage(chatId, message, { 
    parse_mode: 'Markdown',
    disable_web_page_preview: false
  });
}

// This would normally be exposed via an API endpoint
// For demonstration, we're just exporting it
module.exports = {
  sendNotification,
  bot,
  users
}; 