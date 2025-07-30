// Zoracle Telegram Bot for Creator Activity Notifications
import TelegramBot from 'node-telegram-bot-api';
import { escapeMarkdown, escapeMarkdownPreserveFormat, markdownToHtml } from '../utils/telegramUtils';
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
🤖 <b>Welcome to the Zoracle Creator Activity Bot!</b>

This bot will notify you when creators you follow mint new tokens or interact with existing ones.

To get started, please connect your wallet address using the command:
<code>/start your_wallet_address</code>

For example:
<code>/start 0x1234abcd...</code>

Your Chat ID is: 
`;

// Help message
const helpMessage = `
📚 <b>Zoracle Bot Commands:</b>

/start wallet_address - Connect your wallet to receive notifications
/status - Check your connection status
/chatid - Get your Telegram Chat ID
/help - Show this help message

Need more help? Visit <a href="https://zoracle.io">zoracle.io</a> for more information.
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
  const confirmationMsg = 
    `✅ <b>Connected Successfully!</b>\n\nYour wallet address <code>${walletAddress}</code> has been connected to this chat.\n\nTo complete setup, go back to the Zoracle website and enter your Chat ID:\n<code>${chatId}</code>\n\nYou'll start receiving notifications when creators you follow take actions.`;
  bot.sendMessage(chatId, confirmationMsg, { parse_mode: 'HTML' });
  
  console.log(`New user connected: ${chatId} with wallet ${walletAddress}`);
});

// Handle plain /start command (without parameters)
bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received plain /start command from ${chatId}`);
  bot.sendMessage(chatId, welcomeMessage + `<code>${chatId}</code>`, { parse_mode: 'HTML' });
});

// Handle /chatid command
bot.onText(/\/chatid/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received /chatid command from ${chatId}`);
  bot.sendMessage(chatId, `Your Chat ID is: <code>${chatId}</code>`, { parse_mode: 'HTML' });
});

// Handle /status command
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received /status command from ${chatId}`);
  const userData = users.get(chatId.toString());
  
  if (!userData) {
    bot.sendMessage(chatId, '❌ You are not connected yet. Please use <code>/start your_wallet_address</code> to connect.', { parse_mode: 'HTML' });
    return;
  }
  
  const statusMsg = 
    `📊 <b>Your Connection Status</b>\n\nWallet: <code>${userData.walletAddress}</code>\nUsername: @${userData.username}\nChat ID: <code>${chatId}</code>\nConnected since: ${new Date(userData.lastActive).toLocaleString()}`;
  bot.sendMessage(chatId, statusMsg, { parse_mode: 'HTML' });
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  console.log(`Received /help command from ${msg.chat.id}`);
  bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'HTML', disable_web_page_preview: true });
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
    bot.sendMessage(chatId, welcomeMessage + `<code>${chatId}</code>`, { parse_mode: 'HTML' });
  }
});

// Enhanced error handling
bot.on('polling_error', (error) => {
  console.error('Polling error details:', (error as any).code, error.message);
  if ((error as any).code === 'ETELEGRAM') {
    console.error('Telegram API error. Check your bot token!');
  }
  if ((error as any).code === 'ENOTFOUND') {
    console.error('Network error. Check your internet connection!');
  }
});

// Sample function to send notifications (this would be called by your web app)
function sendNotification(chatId, creatorAddress, tokenAddress, transactionHash): any {
  const message = `
🚨 <b>Creator Activity Detected</b>

A creator you're following has taken action:

Creator: <code>${creatorAddress}</code>
Token: <code>${tokenAddress}</code>
Transaction: <a href="https://basescan.org/tx/${transactionHash}">View on BaseScan</a>
Token: <a href="https://zoracle.io/token/${tokenAddress}">View on Zoracle</a>

<i>This notification was sent automatically by Zoracle.</i>
`;

  bot.sendMessage(chatId, message, { 
    parse_mode: 'HTML',
    disable_web_page_preview: false
  });
}

// This would normally be exposed via an API endpoint
// For demonstration, we're just exporting it
export { 
  sendNotification,
  bot,
  users
 }; 