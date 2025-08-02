// Base Chain Telegram Bot - Enhanced with all features
import TelegramBot from 'node-telegram-bot-api';
import { ethers  } from 'ethers';
import axios from 'axios';
import * as crypto from 'crypto';
import { Wallet, Contract, constants  } from 'ethers';
import { formatEther, parseEther, formatUnits  } from '../utils/ethersUtils';
import { escapeMarkdown, escapeMarkdownPreserveFormat } from '../utils/telegramUtils';
import { markdownToHtml } from '../utils/telegramUtils'; // Added for markdownToHtml

// Import all modules
import * as walletManager from '../services/cdpWallet';
import * as trading from '../services/trading';
import * as portfolio from '../services/portfolio';
import * as discovery from '../services/discovery';
import * as alerts from '../services/alerts';
import * as copytrade from '../services/copytrade';

// Environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;
// No longer need Alchemy API key as we're using Ankr

// Debug log for token
console.log('📝 Telegram Bot Token:', token ? `${token.substring(0, 10)}...` : 'undefined');

// Validate required environment variables
if (!token) {
  console.error('❌ Required environment variables missing!');
  process.exit(1);
}

// Create bot instance with better error handling
const bot = new TelegramBot(token, {
  polling: {
    interval: 300,
    autoStart: false, // Don't start polling yet
    params: {
      timeout: 10,
      allowed_updates: ['message', 'callback_query', 'inline_query']
    }
  },
  // No additional options needed
});

// Add error handler
bot.on('polling_error', (error) => {
  console.error('🔴 Telegram Bot polling error:', error.message);
  // Don't crash on polling errors
});

// Clear webhook and start polling when the module is imported
axios.get(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`)
  .then(response => {
    console.log(`✅ Webhook deletion status: ${response.status}`);
    bot.startPolling();
    console.log('✅ Telegram Bot initialized successfully');
  })
  .catch(error => {
    console.error('❌ Failed to delete webhook:', error.message);
    // Continue anyway, let's try to start polling
    bot.startPolling();
  });

// Provider setup
// Use Ankr RPC for Base network
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL || 'https://rpc.ankr.com/base/b39a19f9ecf66252bf862fe6948021cd1586009ee97874655f46481cfbf3f129');

// Set up bot menu commands
bot.setMyCommands([
  { command: 'start', description: '🚀 Start the bot' },
  { command: 'help', description: '📚 Show help menu' },
  { command: 'wallet', description: '🔐 Manage wallet' },
  { command: 'portfolio', description: '💰 View portfolio' },
  { command: 'trade', description: '🔄 Trading options' },
  { command: 'sniper', description: '🎯 Token sniper' },
  { command: 'history', description: '📊 Transaction history' },
  { command: 'alerts', description: '🔔 Price alerts' },
  { command: 'discover', description: '🔍 Discover tokens' },
  { command: 'settings', description: '⚙️ Bot settings' }
]);

// Store user data and conversation states
const users = new Map();
const conversationStates = new Map(); // For onboarding wizard

// Enhanced welcome message with onboarding prompt
const welcomeMessage = `
🤖 <b>Welcome to Zoracle Bot!</b>

This bot helps you trade Zora content tokens on Base, manage your portfolio, discover new coins, set alerts, and more.

To get started, use /start your_wallet_address

Your Chat ID: `;

// Comprehensive help message
const helpMessage = `
📚 <b>Zoracle Bot Commands</b>

<b>🚀 Quick Start:</b>
/start - Start the bot
/help - Show this help menu

<b>🔐 Wallet Management:</b>
/wallet - Manage your wallet (create, import, unlock)
/portfolio - View your portfolio and balances
/history - View transaction history

<b>🔄 Trading Features:</b>
/trade - Trading options (swap, buy, sell)
/sniper - Set up token sniping bots
/limit - Create limit orders
/transfer - Send tokens to other wallets

<b>🔍 Discovery & Research:</b>
/discover - Find new and trending tokens
/search - Search for specific tokens
/alerts - Set up price alerts

<b>⚙️ Settings & Tools:</b>
/settings - Configure bot preferences
/help - Show this help menu

<b>💡 Pro Tips:</b>
• Use the Menu button (📋) for quick access
• Set up alerts to never miss opportunities
• Use snipers for new token launches
• Check portfolio regularly for updates

<b>🎯 Popular Commands:</b>
/trade - Start trading
/sniper - Set up automated buying
/portfolio - Check your holdings
/discover - Find new opportunities
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
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const walletAddress = match && match[1] ? match[1].trim() : null;
  
  // Import database operations
  const { UserOps } = await import('../database/operations');
  
  // Store user data in database
  try {
    await UserOps.upsertUser(userId, {
      telegramId: userId,
      username: msg.from.username || msg.from.first_name,
      lastActive: new Date()
    });
    console.log(`✅ User ${userId} saved to database`);
  } catch (error) {
    console.error(`❌ Failed to save user ${userId} to database:`, error);
  }

  if (walletAddress) {
    // Validate and store wallet
    if (ethers.utils.isAddress(walletAddress)) {
      users.set(chatId.toString(), { walletAddress });
      conversationStates.set(chatId, STATES.WELCOME);
      
      // Show wallet options with buttons
      const walletOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔑 Create New Wallet', callback_data: 'wallet_create' }],
            [{ text: '📥 Import Existing Wallet', callback_data: 'wallet_import' }]
          ]
        },
        parse_mode: 'HTML' as const
      };
      
      bot.sendMessage(
        chatId, 
        '✅ <b>Wallet connected!</b>\n\nWhat would you like to do?', 
        walletOptions
      );
    } else {
      bot.sendMessage(chatId, '⚠️ Invalid wallet address.');
    }
  } else {
    // Check if user already has a wallet
    if (walletManager.userHasWallet(chatId.toString())) {
      // User has a wallet, show unlock options
      const unlockOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔓 Unlock Wallet', callback_data: 'wallet_unlock' }],
            [{ text: '🔐 Quick Unlock (PIN)', callback_data: 'wallet_quick_unlock' }],
            [{ text: '❓ Help', callback_data: 'show_help' }]
          ]
        },
        parse_mode: 'HTML' as const
      };
      
      bot.sendMessage(
        chatId, 
        welcomeMessage + `<code>${chatId}</code>\n\nYou have an existing wallet. Please unlock it to continue.`, 
        unlockOptions
      );
    } else {
      // New user, show wallet setup options
      const setupOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔑 Create New Wallet', callback_data: 'wallet_create' }],
            [{ text: '📥 Import Existing Wallet', callback_data: 'wallet_import' }],
            [{ text: '❓ Help', callback_data: 'show_help' }]
          ]
        },
        parse_mode: 'HTML' as const
      };
      
      bot.sendMessage(
        chatId, 
        welcomeMessage + `<code>${chatId}</code>\n\nLet's get started by setting up your wallet:`, 
        setupOptions
      );
    }
  }
});

// Handle callback queries (button clicks)
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  // Acknowledge the callback query
  bot.answerCallbackQuery(callbackQuery.id);
  
  // Get or initialize user data
  if (!users.has(chatId.toString())) {
    users.set(chatId.toString(), {});
  }
  const userData = users.get(chatId.toString());
  
  // Handle different button actions
  switch (data) {
    case 'wallet_create':
      // Start wallet creation flow
      conversationStates.set(chatId, STATES.WALLET_SETUP);
      userData.isCreating = true;
      delete userData.tempPK; // Clear any previous import data
      
      bot.sendMessage(chatId, '🔐 <b>Create a New Wallet</b>\n\nPlease enter a strong password for your new wallet:', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'wallet_import':
      // Show import options
      bot.sendMessage(chatId, '📥 <b>Import Wallet</b>\n\nPlease select import method:', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔑 Private Key', callback_data: 'import_privatekey' }],
            [{ text: '🔤 Seed Phrase', callback_data: 'import_seed' }],
            [{ text: '↩️ Back', callback_data: 'back_to_start' }]
          ]
        }
      });
      break;
      
    case 'import_privatekey':
      conversationStates.set(chatId, 'AWAITING_PRIVATEKEY');
      bot.sendMessage(chatId, '🔑 *Import with Private Key*\n\nPlease enter your private key:\n\n⚠️ _Never share your private key with anyone else!_', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'import_seed':
      conversationStates.set(chatId, 'AWAITING_SEED');
      bot.sendMessage(chatId, '🔤 *Import with Seed Phrase*\n\nPlease enter your 12 or 24-word seed phrase:\n\n⚠️ _Never share your seed phrase with anyone else!_', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'wallet_unlock':
      conversationStates.set(chatId, 'AWAITING_PASSWORD');
      bot.sendMessage(chatId, '🔓 *Unlock Wallet*\n\nPlease enter your wallet password:', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'wallet_quick_unlock':
      conversationStates.set(chatId, 'AWAITING_PIN');
      bot.sendMessage(chatId, '🔐 *Quick Unlock*\n\nPlease enter your PIN:', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'show_help':
      bot.sendMessage(chatId, escapeMarkdownPreserveFormat(helpMessage), { parse_mode: 'MarkdownV2' as const });
      break;
      
    case 'back_to_start':
      // Go back to start menu
      var setupOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔑 Create New Wallet', callback_data: 'wallet_create' }],
            [{ text: '📥 Import Existing Wallet', callback_data: 'wallet_import' }],
            [{ text: '❓ Help', callback_data: 'show_help' }]
          ]
        },
        parse_mode: 'HTML' as const
      };
      
      bot.sendMessage(chatId, 'What would you like to do?', setupOptions);
      break;
      
    case 'enable_2fa':
      var qr = await walletManager.get2FAQRCode(chatId.toString());
      if (qr.success) {
        // QR code from UseZoracle API is already a URL, not a base64 string
        bot.sendMessage(chatId, `📱 *2FA Setup*\n\nScan this QR code with your authenticator app:\n\n${qr.qrCode}\n\nThen enter the 6-digit code to verify:`, {
          parse_mode: 'Markdown' as const
        });
        conversationStates.set(chatId, 'AWAITING_2FA_TOKEN');
      } else {
        bot.sendMessage(chatId, '❌ Failed to generate 2FA QR code: ' + qr.message);
      }
      break;
      
    case 'skip_2fa':
      conversationStates.set(chatId, STATES.COMPLETE);
      showMainMenu(chatId);
      break;
      
    // Add more cases for other buttons as needed
  }
});

// Function to show main menu after successful login
function showMainMenu(chatId): any {
  const mainMenuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 Portfolio', callback_data: 'show_portfolio' }, { text: '🔄 Trade', callback_data: 'show_trade_options' }],
        [{ text: '🎯 Sniper', callback_data: 'sniper_new' }, { text: '💸 Transfer', callback_data: 'transfer' }],
        [{ text: '⏱️ Limit Orders', callback_data: 'limit_new' }, { text: '👥 Copy Trading', callback_data: 'show_copy_trading' }],
        [{ text: '📊 History', callback_data: 'show_transactions' }, { text: '🔔 Alerts', callback_data: 'show_alerts' }],
        [{ text: '🔍 Discover', callback_data: 'show_discover' }, { text: '⚙️ Settings', callback_data: 'show_settings' }],
        [{ text: '🎁 Referrals', callback_data: 'show_referrals' }]
      ]
    },
    parse_mode: 'HTML' as const
  };
  
  bot.sendMessage(chatId, '🏠 <b>Main Menu</b>\n\nWhat would you like to do today?', mainMenuOptions);
}

// Add handlers for main menu buttons
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  
  // Handle portfolio and trading actions
  if (action === 'show_portfolio') {
    try {
      // Import wallet manager directly
      const walletManager = require('../services/cdpWallet');
      const userId = chatId.toString();

      // Get user data
      if (!users.has(userId)) {
        users.set(userId, {});
      }
      const user = users.get(userId);
      
      // Check if wallet exists
      if (!walletManager.userHasWallet(userId)) {
        bot.sendMessage(chatId, '❌ You don\'t have a wallet set up yet. Please use /wallet to create one.');
        return;
      }
      
      // Check if wallet is unlocked and try to unlock with PIN
      if (!walletManager.isWalletUnlocked(userId)) {
        if (user.pin) {
          const unlockResult = await walletManager.quickUnlockWallet(userId, user.pin);
          if (!unlockResult.success) {
            bot.sendMessage(chatId, `❌ Your wallet is locked. Please use /wallet to unlock it first.\n\nError: ${unlockResult.message}`);
            return;
          }
        } else {
          bot.sendMessage(chatId, '❌ Your wallet is locked. Please use /wallet to unlock it first.');
          return;
        }
      }
      
      // Get real wallet balances from UseZoracle API
      const balanceResult = await walletManager.getWalletBalances(userId);
      
      if (!balanceResult.success) {
        bot.sendMessage(chatId, `❌ Failed to load portfolio: ${balanceResult.message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
        return;
      }
      
      // Process the balance data using the new API response format
      const balances = balanceResult.data.balances || [];
      const totalUsdValue = balanceResult.data.totalUsdValue || 0;
      let portfolioText = '💰 <b>Your Portfolio</b>\n\n';
      
      // Add total value header using API response
      portfolioText += `Total Value: $${totalUsdValue.toFixed(2)}\n\n`;
      portfolioText += 'Holdings:\n';
      
      // Process each token balance
      for (const balance of balances) {
        const token = balance.token;
        const amount = balance.amount;
        const usdValue = balance.usdValue || 0;
        
        // Format balance and USD value
        const formattedBalance = parseFloat(amount.formatted).toFixed(6);
        const formattedUsdValue = usdValue.toFixed(2);
        
        // Add token to portfolio message
        portfolioText += `• ${token.symbol}: ${formattedBalance} ($${formattedUsdValue})\n`;
      }
      
      const portfolioOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Transaction History', callback_data: 'show_transactions' }],
            [{ text: '🔄 Refresh Portfolio', callback_data: 'show_portfolio' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        },
        parse_mode: 'HTML' as const
      };
      
      bot.sendMessage(chatId, portfolioText, portfolioOptions);
    } catch (error) {
      console.error('Error displaying portfolio:', error);
      bot.sendMessage(chatId, `❌ An error occurred while loading your portfolio: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  } 
  else if (action === 'show_trade_options') {
    const tradeOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💵 Buy Tokens', callback_data: 'trade_buy' }],
          [{ text: '💸 Sell Tokens', callback_data: 'trade_sell' }],
          [{ text: '🔄 Swap Tokens', callback_data: 'trade_swap' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      },
      parse_mode: 'HTML' as const
    };
    
    bot.sendMessage(chatId, '🔄 <b>Trading</b>\n\nWhat would you like to do?', tradeOptions);
  }
  else if (action === 'trade_buy') {
    conversationStates.set(chatId, 'AWAITING_BUY_TOKEN');
    bot.sendMessage(chatId, '💵 <b>Buy Tokens</b>\n\nPlease enter the token address you want to buy:', {
      parse_mode: 'HTML' as const,
      reply_markup: {
        force_reply: true
      }
    });
  }
  else if (action === 'trade_swap') {
    try {
      // Import the swaps service
      const swapService = require('../services/swaps');
      
      // Show a loading message
      const loadingMessage = await bot.sendMessage(chatId, '⏳ Loading available tokens...');
      
      // Get the common tokens for the base network
      const tokensResult = await swapService.getTokenAddresses('base');
      
      // Delete the loading message
      bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => console.error('Error deleting loading message:', e));
      
      if (tokensResult.success && tokensResult.tokens) {
        const tokens = tokensResult.tokens || {};
        
        // Create buttons for common tokens
        const tokenButtons = [];
        
        // ETH is special
        tokenButtons.push([{ text: '💠 ETH (Native)', callback_data: 'swap_from_ETH' }]);
        
        // Add other common tokens
        if (typeof tokens === 'object' && tokens !== null) {
          for (const [symbol, address] of Object.entries(tokens)) {
            if (symbol !== 'ETH') { // Skip ETH as we added it separately
              tokenButtons.push([{ text: `${symbol}`, callback_data: `swap_from_${symbol}` }]);
            }
          }
        }
        
        // Add back button
        tokenButtons.push([{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]);
        
        // Store user's tokens for the session
        if (!users.has(chatId.toString())) {
          users.set(chatId.toString(), {});
        }
        const userData = users.get(chatId.toString());
        userData.availableTokens = tokens;
        
        bot.sendMessage(chatId, '🔄 <b>Swap Tokens</b>\n\nSelect a token to swap <b>from</b>:', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: tokenButtons
          }
        });
      } else {
        bot.sendMessage(chatId, `❌ Error loading tokens: ${tokensResult.message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error initializing token swap:', error);
      bot.sendMessage(chatId, `❌ Error initializing swap: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
    }
  }
  else if (action.startsWith('swap_from_')) {
    try {
      // Extract the token symbol from the callback data
      const fromToken = action.substring('swap_from_'.length);
      
      // Get user data
      if (!users.has(chatId.toString())) {
        users.set(chatId.toString(), {});
      }
      const userData = users.get(chatId.toString());
      
      // Store the fromToken for the session
      userData.swapFromToken = fromToken;
      
      // Get available tokens with fallback
      const tokens = userData.availableTokens || {
        ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        WETH: '0x4200000000000000000000000000000000000006',
        USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        USDT: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'
      };
      
      // Create buttons for tokens to swap to
      const tokenButtons = [];
      
      // Add ETH if from token isn't ETH
      if (fromToken !== 'ETH') {
        tokenButtons.push([{ text: '💠 ETH (Native)', callback_data: 'swap_to_ETH' }]);
      }
      
      // Add other tokens except the from token
      if (typeof tokens === 'object' && tokens !== null) {
        for (const [symbol, address] of Object.entries(tokens)) {
          if (symbol !== 'ETH' && symbol !== fromToken) {
            tokenButtons.push([{ text: symbol, callback_data: `swap_to_${symbol}` }]);
          }
        }
      }
      
      // Add custom token option for sniping
      tokenButtons.push([{ text: '🎯 Custom Token (Snipe)', callback_data: 'swap_to_custom' }]);
      
      // Add back buttons
      tokenButtons.push([
        { text: '⬅️ Different Source', callback_data: 'trade_swap' },
        { text: '🏠 Back to Trading', callback_data: 'show_trade_options' }
      ]);
      
      bot.sendMessage(chatId, `🔄 <b>Swap Tokens</b>\n\nSwapping from <b>${fromToken}</b>\n\nSelect a token to swap <b>to</b>:`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: tokenButtons
        }
      });
    } catch (error) {
      console.error('Error selecting from token for swap:', error);
      bot.sendMessage(chatId, `❌ Error selecting token: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
    }
  }
  else if (action === 'swap_to_custom') {
    try {
      // Get user data
      if (!users.has(chatId.toString())) {
        users.set(chatId.toString(), {});
      }
      const userData = users.get(chatId.toString());
      
      // Get the from token
      const fromToken = userData.swapFromToken;
      
      if (!fromToken) {
        throw new Error('Source token not selected');
      }
      
      // Set the conversation state for custom token input
      conversationStates.set(chatId, 'AWAITING_CUSTOM_TOKEN');
      
      // Send message asking for custom token address
      bot.sendMessage(chatId, `🎯 <b>Custom Token Snipe</b>\n\nSwapping from <b>${fromToken}</b> to custom token\n\nPlease enter the contract address of the token you want to snipe:\n\n<i>Example: 0x1234567890123456789012345678901234567890</i>`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⬅️ Back to Token Selection', callback_data: 'trade_swap' }],
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error selecting custom token for swap:', error);
      bot.sendMessage(chatId, `❌ Error selecting token: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
    }
  }
  else if (action.startsWith('swap_to_')) {
    try {
      // Extract the token symbol from the callback data
      const toToken = action.substring('swap_to_'.length);
      
      // Get user data
      if (!users.has(chatId.toString())) {
        users.set(chatId.toString(), {});
      }
      const userData = users.get(chatId.toString());
      
      // Store the toToken for the session
      userData.swapToToken = toToken;
      
      // Get the from token
      const fromToken = userData.swapFromToken;
      
      if (!fromToken) {
        throw new Error('Source token not selected');
      }
      
      // Set the conversation state
      conversationStates.set(chatId, 'AWAITING_SWAP_AMOUNT');
      
      // Get tokens data
      const tokens = userData.availableTokens || {};
      
      // Send message asking for amount
      bot.sendMessage(chatId, `🔄 <b>Swap Tokens</b>\n\nSwapping from <b>${fromToken}</b> to <b>${toToken}</b>\n\nPlease enter the amount of ${fromToken} you want to swap:`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
    } catch (error) {
      console.error('Error selecting to token for swap:', error);
      bot.sendMessage(chatId, `❌ Error selecting token: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
    }
  }
  else if (action === 'trade_sell') {
    // Get user's tokens
    try {
      const portfolioData = await portfolio.getPortfolio(chatId.toString());
      
      if (portfolioData.success && portfolioData.tokens && portfolioData.tokens.length > 0) {
        const tokenButtons = portfolioData.tokens.map(token => {
          return [{ text: `${token.symbol} (${token.balance})`, callback_data: `sell_token_${token.address}` }];
        });
        
        tokenButtons.push([{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]);
        
        bot.sendMessage(chatId, '💸 *Sell Tokens*\n\nSelect a token to sell:', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: tokenButtons
          }
        });
      } else {
        bot.sendMessage(chatId, '❌ No tokens found in your portfolio.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error getting tokens for sell:', error);
      bot.sendMessage(chatId, '❌ An error occurred while loading your tokens.');
    }
  }
  else if (action.startsWith('confirm_buy_')) {
    // Parse the confirmation data (slippage_amount_tokenAddress)
    const parts = action.split('_');
    if (parts.length < 4) return;
    
    const slippage = parseFloat(parts[2]);
    const amount = parts[3];
    
    // Normalize token address to checksum format
    let tokenAddress;
    try {
      tokenAddress = ethers.utils.getAddress(parts[4]);
    } catch (error) {
      bot.sendMessage(chatId, '❌ <b>Invalid Token Address Format</b>\n\nThe token address format is invalid.', {
        parse_mode: 'HTML' as const
      });
      return;
    }
    
    bot.sendMessage(chatId, '⏳ <b>Processing Trade</b>\n\nExecuting your purchase, please wait...', {
      parse_mode: 'HTML' as const
    });
    
    try {
      // Get trading service
      const trading = await import('../services/trading');
      
      // Execute the trade
      const result = await trading.executeSwap(chatId.toString(), tokenAddress, amount, true, slippage);
      
      if (result.txHash) {
        // Format success message
        let successMsg = `✅ <b>Trade Successful!</b>\n\n`;
        successMsg += `You bought ${result.tokenAmount || 'tokens'} using ${amount} ETH.\n\n`;
        successMsg += `<a href="https://basescan.org/tx/${result.txHash}">View on BaseScan</a>`;
        
        bot.sendMessage(chatId, successMsg, {
          parse_mode: 'HTML' as const,
          disable_web_page_preview: true
        });
        
        // Clear conversation state
        conversationStates.delete(chatId);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Error executing buy trade:', error);
      bot.sendMessage(chatId, `❌ <b>Trade Failed</b>\n\n${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_buy' }]
          ]
        }
      });
      conversationStates.delete(chatId);
    }
  }
  else if (action === 'cancel_trade') {
    bot.sendMessage(chatId, '❌ <b>Trade Cancelled</b>', {
      parse_mode: 'HTML' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to Trade Options', callback_data: 'show_trade_options' }]
        ]
      }
    });
    conversationStates.delete(chatId);
  }
  else if (action.startsWith('confirm_swap_')) {
    // Handle swap confirmation
    try {
      // Import the walletManager and swaps service
      const walletManager = require('../services/cdpWallet');
      const swapService = require('../services/swaps');
      
      // Parse the callback data
      // Format: confirm_swap_[slippage]
      const parts = action.split('_');
      const slippageBps = parseInt(parts[2]);
      
      // Get user data
      if (!users.has(chatId.toString())) {
        throw new Error('User session data not found');
      }
      const userData = users.get(chatId.toString());
      
      // Ensure we have all required data
      if (!userData.swapFromToken || !userData.swapToToken || !userData.swapAmount || !userData.swapFromAmount) {
        throw new Error('Missing swap parameters');
      }
      
      // Check if wallet is unlocked
      if (!walletManager.isWalletUnlocked(chatId.toString())) {
        if (userData.pin) {
          // Try to unlock with PIN
          const unlockResult = await walletManager.quickUnlockWallet(chatId.toString(), userData.pin);
          if (!unlockResult.success) {
            bot.sendMessage(chatId, '❌ Your wallet is locked. Please use /wallet to unlock it first.');
            return;
          }
        } else {
          bot.sendMessage(chatId, '❌ Your wallet is locked. Please use /wallet to unlock it first.');
          return;
        }
      }
      
      // Show executing message
      const executingMsg = await bot.sendMessage(chatId, '⏳ Executing swap...');
      
      // Get account name for the swap API
      const accountName = `zoracle-${chatId.toString()}`;
      
      // Execute the swap
      const swapResult = await swapService.executeSwap(
        accountName,
        userData.swapFromToken,
        userData.swapToToken,
        userData.swapFromAmount,
        slippageBps,
        'base'
      );
      
      // Delete the executing message
      bot.deleteMessage(chatId, executingMsg.message_id).catch(e => {});
      
      if (swapResult.success) {
        // Format the result message
        let resultMsg = '✅ <b>Swap Executed Successfully!</b>\n\n';
        resultMsg += `From: ${userData.swapAmount} ${userData.swapFromToken}\n`;
        resultMsg += `To: ${swapResult.amountReceived} ${userData.swapToToken}\n`;
        resultMsg += `Fee: ${ethers.utils.formatUnits(swapResult.feeAmount || '0')} ${userData.swapToToken} (5%)\n\n`;
        
        if (swapResult.transactionHash) {
          resultMsg += `<a href="https://basescan.org/tx/${swapResult.transactionHash}">View on BaseScan</a>\n`;
        }
        
        // Add buttons
        const buttons = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 New Swap', callback_data: 'trade_swap' }],
              [{ text: '💰 View Portfolio', callback_data: 'show_portfolio' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          },
          parse_mode: 'HTML' as const
        };
        
        bot.sendMessage(chatId, resultMsg, buttons);
        
        // Clear swap data
        delete userData.swapFromToken;
        delete userData.swapToToken;
        delete userData.swapAmount;
        delete userData.swapFromAmount;
        delete userData.swapEstimate;
      } else {
        bot.sendMessage(chatId, `❌ Swap failed: ${swapResult.message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
      }
      
      // Clear conversation state
      conversationStates.delete(chatId);
    } catch (error) {
      console.error('Error confirming swap:', error);
      bot.sendMessage(chatId, `❌ Error confirming swap: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
      
      // Clear conversation state
      conversationStates.delete(chatId);
    }
  }
  else if (action === 'cancel_swap') {
    // Handle swap cancellation
    try {
      // Get user data
      if (users.has(chatId.toString())) {
        const userData = users.get(chatId.toString());
        
        // Clear swap data
        delete userData.swapFromToken;
        delete userData.swapToToken;
        delete userData.swapAmount;
        delete userData.swapFromAmount;
        delete userData.swapEstimate;
      }
      
      // Clear conversation state
      conversationStates.delete(chatId);
      
      // Send confirmation and return to trade options
      bot.sendMessage(chatId, '❌ Swap cancelled.');
      
      // Show trade options
      const tradeOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💵 Buy Tokens', callback_data: 'trade_buy' }],
            [{ text: '💸 Sell Tokens', callback_data: 'trade_sell' }],
            [{ text: '🔄 Swap Tokens', callback_data: 'trade_swap' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        },
        parse_mode: 'HTML' as const
      };
      
      bot.sendMessage(chatId, '🔄 <b>Trading</b>\n\nWhat would you like to do?', tradeOptions);
    } catch (error) {
      console.error('Error canceling swap:', error);
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      showMainMenu(chatId);
    }
  }
  else if (action === 'use_max_eth') {
    try {
      // Get user's ETH balance
      const balanceResult = await getEthBalance(chatId.toString());
      const ethBalance = balanceResult.balance || '0';
      
      // Calculate max amount (with buffer for gas)
      const maxAmount = parseFloat(ethBalance) * 0.95;
      const amountETH = maxAmount.toFixed(6);
      
      // Get token info from user data
      const userData = users.get(chatId.toString()) || {};
      const buyToken = userData.buyToken;
      
      if (!buyToken || !buyToken.address) {
        throw new Error('Token information not found.');
      }
      
      // Ask for confirmation with slippage options
      const confirmMessage = `🔄 <b>Confirm Trade</b>\n\n` +
        `You are about to buy tokens with ${amountETH} ETH (maximum available).\n\n` +
        `Token: ${buyToken.info?.name || buyToken.address}\n` +
        `Price: ${buyToken.price} ETH\n\n` +
        `Please select your slippage tolerance:`;
      
      bot.sendMessage(chatId, confirmMessage, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '0.5%', callback_data: `confirm_buy_0.5_${amountETH}_${buyToken.address}` },
              { text: '1%', callback_data: `confirm_buy_1.0_${amountETH}_${buyToken.address}` },
              { text: '2%', callback_data: `confirm_buy_2.0_${amountETH}_${buyToken.address}` }
            ],
            [
              { text: '❌ Cancel', callback_data: 'cancel_trade' }
            ]
          ]
        }
      });
      
      // Update conversation state
      conversationStates.set(chatId, 'AWAITING_BUY_CONFIRM');
      
    } catch (error) {
      console.error('Error processing max ETH input:', error);
      bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_buy' }]
          ]
        }
      });
      conversationStates.delete(chatId);
    }
  }
  else if (action.startsWith('sell_token_')) {
    // Extract token address from action and convert to checksum format
    let tokenAddress;
    try {
      tokenAddress = ethers.utils.getAddress(action.substring('sell_token_'.length));
    } catch (error) {
      bot.sendMessage(chatId, '❌ <b>Invalid Token Address</b>\n\nThe token address format is invalid.', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_sell' }]
          ]
        }
      });
      return;
    }
    
    try {
      // Create token contract to get details
      const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL || 'https://rpc.ankr.com/base/b39a19f9ecf66252bf862fe6948021cd1586009ee97874655f46481cfbf3f129');
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
          "function totalSupply() view returns (uint256)",
          "function balanceOf(address) view returns (uint256)"
        ],
        provider
      );
      
      // Get wallet address
      const walletAddress = walletManager.getWalletAddress(chatId.toString());
      if (!walletAddress) {
        throw new Error('Wallet not found or locked.');
      }
      
      // Fetch detailed token information
      const [name, symbol, decimals, totalSupply, userBalance] = await Promise.all([
        tokenContract.name().catch(() => "Unknown Token"),
        tokenContract.symbol().catch(() => "????"),
        tokenContract.decimals().catch(() => 18),
        tokenContract.totalSupply().catch(() => ethers.BigNumber.from("0")),
        tokenContract.balanceOf(walletAddress).catch(() => ethers.BigNumber.from("0"))
      ]);
      
      // Format supply and balance with appropriate decimals
      const formattedTotalSupply = ethers.utils.formatUnits(totalSupply, decimals);
      const formattedUserBalance = ethers.utils.formatUnits(userBalance, decimals);
      
      // Get token price
      const trading = await import('../services/trading');
      const priceQuote = await trading.getTokenPrice(tokenAddress);
      
      // Calculate ETH value of user's tokens
      const ethValue = parseFloat(formattedUserBalance) * parseFloat(priceQuote.price);
      
      // Send detailed token info message
      const detailedTokenInfo = `🔍 <b>Token Information</b>\n\n` +
        `<b>Name:</b> ${name}\n` +
        `<b>Symbol:</b> ${symbol}\n` +
        `<b>Address:</b> <code>${tokenAddress}</code>\n` +
        `<b>Decimals:</b> ${decimals}\n` +
        `<b>Total Supply:</b> ${parseFloat(formattedTotalSupply).toLocaleString()} ${symbol}\n` +
        `<b>Current Price:</b> ${priceQuote.price} ETH\n\n` +
        `<b>Your Balance:</b> ${parseFloat(formattedUserBalance).toLocaleString()} ${symbol}\n` +
        `<b>Value:</b> ~${ethValue.toFixed(6)} ETH`;
      
      // Add BaseScan link
      const basescanLink = `\n<a href="https://basescan.org/token/${tokenAddress}">View on BaseScan</a>`;
      
      // First, send the token details message
      await bot.sendMessage(chatId, detailedTokenInfo + basescanLink, {
        parse_mode: 'HTML' as const,
        disable_web_page_preview: true
      });
      
      // Get user data object or create it
      if (!users.has(chatId.toString())) {
        users.set(chatId.toString(), {});
      }
      
      // Store token info in user data
      const userData = users.get(chatId.toString());
      userData.sellToken = {
        address: tokenAddress,
        info: {
          name,
          symbol,
          decimals,
          totalSupply: formattedTotalSupply,
        },
        balance: formattedUserBalance,
        price: priceQuote.price
      };
      
      // Update conversation state
      conversationStates.set(chatId, 'AWAITING_SELL_AMOUNT');
      
      // Ask for amount to sell
      const message = `💸 <b>Sell ${name} (${symbol})</b>\n\n` +
        `How many tokens would you like to sell? (You can also type "max" to sell your entire balance)`;
      
      bot.sendMessage(chatId, message, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Sell Max Balance', callback_data: 'sell_max_tokens' }],
            [{ text: '❌ Cancel', callback_data: 'cancel_trade' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('Error processing token sell selection:', error);
      bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_sell' }]
          ]
        }
      });
    }
  }
  else if (action === 'sell_max_tokens') {
    try {
      // Get token info from user data
      const userData = users.get(chatId.toString()) || {};
      const sellToken = userData.sellToken;
      
      if (!sellToken || !sellToken.address || !sellToken.balance) {
        throw new Error('Token information not found.');
      }
      
      // Calculate estimated ETH to receive
      const estimatedETH = parseFloat(sellToken.balance) * parseFloat(sellToken.price);
      
      // Ask for confirmation with slippage options
      const confirmMessage = `🔄 <b>Confirm Trade</b>\n\n` +
        `You are about to sell ${sellToken.balance} ${sellToken.info.symbol} (your entire balance).\n\n` +
        `Estimated to receive: ~${estimatedETH.toFixed(6)} ETH\n\n` +
        `Please select your slippage tolerance:`;
      
      bot.sendMessage(chatId, confirmMessage, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '0.5%', callback_data: `confirm_sell_0.5_${sellToken.balance}_${sellToken.address}` },
              { text: '1%', callback_data: `confirm_sell_1.0_${sellToken.balance}_${sellToken.address}` },
              { text: '2%', callback_data: `confirm_sell_2.0_${sellToken.balance}_${sellToken.address}` }
            ],
            [
              { text: '❌ Cancel', callback_data: 'cancel_trade' }
            ]
          ]
        }
      });
      
      // Update conversation state
      conversationStates.set(chatId, 'AWAITING_SELL_CONFIRM');
      
    } catch (error) {
      console.error('Error processing max token sell:', error);
      bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_sell' }]
          ]
        }
      });
    }
  }
  else if (action.startsWith('confirm_sell_')) {
    // Parse the confirmation data (slippage_amount_tokenAddress)
    const parts = action.split('_');
    if (parts.length < 4) return;
    
    const slippage = parseFloat(parts[2]);
    const amount = parts[3];
    
    // Normalize token address to checksum format
    let tokenAddress;
    try {
      tokenAddress = ethers.utils.getAddress(parts[4]);
    } catch (error) {
      bot.sendMessage(chatId, '❌ <b>Invalid Token Address Format</b>\n\nThe token address format is invalid.', {
        parse_mode: 'HTML' as const
      });
      return;
    }
    
    bot.sendMessage(chatId, '⏳ <b>Processing Trade</b>\n\nExecuting your sale, please wait...', {
      parse_mode: 'HTML' as const
    });
    
    try {
      // Get trading service
      const trading = await import('../services/trading');
      
      // Execute the trade
      const result = await trading.executeSwap(chatId.toString(), tokenAddress, amount, false, slippage);
      
      if (result.txHash) {
        // Format success message
        let successMsg = `✅ <b>Trade Successful!</b>\n\n`;
        successMsg += `You sold ${amount} tokens for ${result.ethAmount || '0'} ETH.\n\n`;
        successMsg += `<a href="https://basescan.org/tx/${result.txHash}">View on BaseScan</a>`;
        
        bot.sendMessage(chatId, successMsg, {
          parse_mode: 'HTML' as const,
          disable_web_page_preview: true
        });
        
        // Clear conversation state
        conversationStates.delete(chatId);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Error executing sell trade:', error);
      bot.sendMessage(chatId, `❌ <b>Trade Failed</b>\n\n${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_sell' }]
          ]
        }
      });
      conversationStates.delete(chatId);
    }
  }
  else if (action === 'show_discover') {
    const discoverOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🆕 New Coins', callback_data: 'discover_new' }],
          [{ text: '🔥 Trending', callback_data: 'discover_trending' }],
          [{ text: '🔍 Search', callback_data: 'discover_search' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      },
      parse_mode: 'HTML' as const
    };
    
    bot.sendMessage(chatId, '🔍 *Discover*\n\nExplore Zora content coins:', discoverOptions);
  }
  else if (action === 'show_copy_trading') {
    const copyTradeOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Add Mirror', callback_data: 'add_mirror' }],
          [{ text: '📋 View Active Mirrors', callback_data: 'view_mirrors' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      },
      parse_mode: 'HTML' as const
    };
    
    bot.sendMessage(chatId, '👥 <b>Copy Trading</b>\n\nMirror trades from other wallets automatically.', copyTradeOptions);
  }
  else if (action === 'discover_new') {
    try {
      const newCoins = await discovery.getNewCoins();
      
      if (newCoins && newCoins.length > 0) {
        let coinsText = '🆕 *New Coins (Last 24h)*\n\n';
        
        newCoins.slice(0, 10).forEach((coin, index) => {
          coinsText += `${index + 1}. *${coin.name}* (${coin.symbol})\n`;
          coinsText += `   Creator: ${coin.creator || 'Unknown'}\n`;
          coinsText += `   Address: \`${coin.address}\`\n\n`;
        });
        
        bot.sendMessage(chatId, coinsText, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
      } else {
        bot.sendMessage(chatId, '❌ No new coins found in the last 24 hours.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error getting new coins:', error);
      bot.sendMessage(chatId, '❌ An error occurred while fetching new coins.');
    }
  }
  else if (action === 'add_mirror') {
    // Direct implementation for copy trading setup
    try {
      // Prompt for wallet address
      bot.sendMessage(chatId, 'Please enter the wallet address you want to mirror trades from:');
      
      // Create mirror directly, bypassing PIN checks
      conversationStates.set(chatId, 'AWAITING_MIRROR_WALLET');
    } catch (error) {
      console.error('Error starting copy trade setup:', error);
      bot.sendMessage(chatId, '❌ Error: Could not start copy trading setup. Try again later.');
    }
  }
  else if (action === 'view_mirrors') {
    try {
      // Show a loading message
      const loadingMessage = await bot.sendMessage(chatId, '⏳ Loading your mirrors...');
      
      // Get user's copy-trades from database with increased timeout
      const copyTradeOps = require('../database/operations').CopyTradeOps;
      
      // Use a Promise.race with a timeout to prevent blocking
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timed out')), 7000);
      });
      
      // Fetch user's copy trades with increased timeout (8 seconds)
      const userCopyTradesPromise = copyTradeOps.getUserCopyTrades(chatId.toString(), 8000);
      
      // Race between the fetch and the timeout
      const userCopyTrades = await Promise.race([
        userCopyTradesPromise,
        timeoutPromise
      ]).catch(error => {
        console.error('Error fetching mirrors (Promise.race):', error);
        // Return empty array on error
        return [];
      });
      
      // Delete the loading message
      bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => console.error('Error deleting loading message:', e));
      
      if (!userCopyTrades || userCopyTrades.length === 0) {
        const options = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Add Mirror', callback_data: 'add_mirror' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        };
        
        bot.sendMessage(chatId, 'You don\'t have any active mirrors. Click "Add Mirror" to set up copy trading.', options);
        return;
      }
      
      // Create message with all mirrors
      let message = '🔄 <b>Your Active Mirrors:</b>\n\n';
      
      for (let i = 0; i < userCopyTrades.length; i++) {
        const copyTrade = userCopyTrades[i];
        const status = copyTrade.active ? '✅ Active' : '⏸️ Paused';
        const mode = copyTrade.sandboxMode ? '🧪 Sandbox' : '🔴 Live';
        
        // Safe access to prevent errors if data is malformed
        const targetWallet = copyTrade.targetWallet || '0x0000000000000000000000000000000000000000';
        const maxEthPerTrade = copyTrade.maxEthPerTrade || '0';
        const slippage = copyTrade.slippage || 1;
        
        const walletAddr = `${targetWallet.substring(0, 6)}...${targetWallet.substring(targetWallet.length - 4)}`;
        
        message += `${i + 1}. <code>${walletAddr}</code>\n`;
        message += `   Status: ${status}\n`;
        message += `   Mode: ${mode}\n`;
        message += `   Max ETH per trade: ${maxEthPerTrade} ETH\n`;
        message += `   Slippage: ${slippage}%\n\n`;
      }
      
      // Add inline keyboard for actions
      const options = {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ Add Mirror', callback_data: 'add_mirror' },
              { text: '🗑️ Remove Mirror', callback_data: 'remove_mirror' }
            ],
            [
              { text: '⏸️ Pause Mirror', callback_data: 'pause_mirror' },
              { text: '▶️ Resume Mirror', callback_data: 'resume_mirror' }
            ],
            [
              { text: '🧪 Toggle Sandbox', callback_data: 'toggle_sandbox' },
              { text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, message, options);
    } catch (error) {
      console.error('Error fetching mirrors:', error);
      bot.sendMessage(chatId, `❌ Error fetching your mirrors: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'view_mirrors' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  }
  else if (action === 'mirror_sandbox_yes' || action === 'mirror_sandbox_no') {
    try {
      // Get user data
      if (!users.has(chatId.toString())) {
        users.set(chatId.toString(), {});
      }
      const userData = users.get(chatId.toString());
      
      // Set sandbox mode
      const sandboxMode = action === 'mirror_sandbox_yes';
      userData.mirrorSandbox = sandboxMode;
      
      // Process mirror setup directly without PIN check
      const copyTradeService = require('../services/copytrade');
      
      // Add copy trade - use configureMirror instead of addCopyTrade
      copyTradeService.configureMirror(
        chatId.toString(),
        userData.mirrorTarget,
        userData.mirrorSlippage,
        userData.mirrorSandbox
      );
      
      // Success message
      const modeText = sandboxMode ? '🧪 Sandbox Mode (Simulated)' : '🔴 Live Mode (Real)';
      const walletAddr = `${userData.mirrorTarget.substring(0, 6)}...${userData.mirrorTarget.substring(userData.mirrorTarget.length - 4)}`;
      
      bot.sendMessage(chatId, 
        '✅ <b>Copy-trade set up successfully!</b>\n\n' +
        `Target wallet: <code>${walletAddr}</code>\n` +
        `Max ETH per trade: ${userData.mirrorMaxEth} ETH\n` +
        `Slippage: ${userData.mirrorSlippage}%\n` +
        `Mode: ${modeText}\n\n` +
        'You will now automatically mirror trades from this wallet.', 
        { parse_mode: 'HTML' as const }
      );
      
      // Clear conversation state
      conversationStates.delete(chatId);
      
      // Clear mirror setup data
      delete userData.mirrorTarget;
      delete userData.mirrorMaxEth;
      delete userData.mirrorSlippage;
      delete userData.mirrorSandbox;
      
    } catch (error) {
      console.error('Error setting up copy-trade:', error);
      bot.sendMessage(chatId, `❌ <b>Error setting up copy-trade</b>:\n\n${error.message}`, 
        { parse_mode: 'HTML' as const }
      );
      conversationStates.delete(chatId);
    }
  }
  else if (action === 'show_transactions') {
    try {
      const userId = callbackQuery.from.id.toString();
      
      // Check if user has a wallet
      const walletManager = require('../services/cdpWallet');
      
      if (!walletManager.userHasWallet(userId)) {
        bot.sendMessage(chatId, '❌ You don\'t have a wallet set up yet. Please use /wallet to create one.');
        return;
      }
      
      // Get UseZoracle API wallet address
      const address = await walletManager.getUseZoracleAddress(userId);
      
      if (!address) {
        bot.sendMessage(chatId, '❌ Unable to get wallet address. Please make sure your wallet is unlocked.');
        return;
      }
      
      // Show loading message
      const loadingMessage = await bot.sendMessage(chatId, 
        `🔍 <b>Loading Transaction History</b>\n📝 <b>Wallet:</b> ${address}\n\nFetching your transactions from the blockchain...`, 
        { parse_mode: 'HTML' as const }
      );
      
      // Import blockchain explorer service
      const { getTransactions } = require('../services/blockExplorer');
      
      // Get real transaction data
      const txResult = await getTransactions(address, 5);
      
      // Check if we got data successfully
      if (!txResult.success || !txResult.data || txResult.data.length === 0) {
        bot.editMessageText(
          `📜 <b>Transaction History</b>\n📝 <b>Wallet Address:</b> ${address}\n\nNo transactions found for this wallet address. This could be a new wallet or our explorer API might be experiencing issues.`,
          {
            chat_id: chatId,
            message_id: loadingMessage.message_id,
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Refresh', callback_data: 'refresh_history' }],
                [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
              ]
            }
          }
        );
        return;
      }
      
      // Build transactions message
      let txMessage = `📜 <b>Transaction History</b>\n`;
      txMessage += `📝 <b>Wallet Address:</b> ${address}\n\n`;
      
      // Parse and display transactions
      for (const tx of txResult.data) {
        // Format the date
        const date = new Date(tx.timestamp).toLocaleDateString();
        const time = new Date(tx.timestamp).toLocaleTimeString();
        
        // Format transaction type
        let typeIcon = '↔️';
        let typeText = 'INTERACTION';
        
        if (tx.from && tx.to && tx.from.toLowerCase() === address.toLowerCase()) {
          typeIcon = '📤';
          typeText = 'SENT';
        } else if (tx.to && tx.to.toLowerCase() === address.toLowerCase()) {
          typeIcon = '📥';
          typeText = 'RECEIVED';
        }
        
        // Format the value
        const valueText = tx.value ? `${tx.value.toFixed(6)} ETH` : '';
        
        // Transaction status
        const statusIcon = tx.status === 'success' ? '✅' : '❌';
        
        // Build transaction line
        txMessage += `${typeIcon} <b>${typeText}</b> ${statusIcon} - ${date} ${time}\n`;
        if (valueText) {
          txMessage += `Amount: ${valueText}\n`;
        }
        txMessage += `<a href="https://basescan.org/tx/${tx.txHash}">View on Basescan</a>\n\n`;
      }
      
      // Add options to return to portfolio or main menu
      const options = {
        parse_mode: 'HTML' as const,
        chat_id: chatId,
        message_id: loadingMessage.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'refresh_history' }],
            [{ text: '⬅️ Back to Portfolio', callback_data: 'show_portfolio' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      };
      
      bot.editMessageText(txMessage, options);
    } catch (error) {
      console.error('Error displaying transaction history:', error);
      bot.sendMessage(chatId, `❌ An error occurred while loading your transaction history: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  }
  else if (action === 'transfer') {
    // Call transfer command directly
    const userId = callbackQuery.from.id.toString();
    
    // Use the transfer command implementation directly
    bot.sendMessage(chatId, '💸 <b>Transfer Tokens</b>\n\nPlease enter the destination address:', {
      parse_mode: 'HTML' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancel', callback_data: 'back_to_main' }]
        ]
      }
    });
    
    // Set state for transfer
    conversationStates.set(chatId, 'AWAITING_TRANSFER_ADDRESS');
  }
  else if (action === 'show_settings') {
    // Call settings command directly
    const msg = { chat: { id: chatId }, from: callbackQuery.from, text: '/settings' } as any;
    bot.sendMessage(chatId, '⚙️ <b>Bot Settings</b>\n\nConfigure your bot preferences:', {
      parse_mode: 'HTML' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔔 Notification Settings', callback_data: 'settings_notifications' }],
          [{ text: '🌐 Language Settings', callback_data: 'settings_language' }],
          [{ text: '🔄 Trading Defaults', callback_data: 'settings_trading' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
  else if (action === 'show_referrals') {
    // Call referrals command directly
    const userId = callbackQuery.from.id.toString();
    const referralLink = `https://t.me/ZoracleTradingBot?start=ref_${userId}`;
    
    bot.sendMessage(chatId, `🎁 <b>Referral Program</b>\n\nInvite friends to use Zoracle Bot and earn rewards!\n\nYour referral link:\n${referralLink}\n\nRewards:\n• 5% of fees from referred users\n• Special features unlocked at 5+ referrals`, {
      parse_mode: 'HTML' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 My Referrals', callback_data: 'show_my_referrals' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
  else if (action === 'refresh_history') {
    // Handle refresh history action by directly calling the same code as show_transactions
    // but without emitting an event (to avoid TypeScript errors)
    try {
      const userId = callbackQuery.from.id.toString();
      
      // Check if user has a wallet
      const walletManager = require('../services/cdpWallet');
      
      if (!walletManager.userHasWallet(userId)) {
        bot.sendMessage(chatId, '❌ You don\'t have a wallet set up yet. Please use /wallet to create one.');
        return;
      }
      
      // Clear address cache to force fresh API call
      walletManager.clearAddressCache(userId);
      
      // Get UseZoracle API wallet address
      const address = await walletManager.getUseZoracleAddress(userId);
      
      if (!address) {
        bot.sendMessage(chatId, '❌ Unable to get wallet address. Please make sure your wallet is unlocked.');
        return;
      }
      
      // Show loading message
      const loadingMessage = await bot.sendMessage(chatId, 
        `🔍 <b>Refreshing Transaction History</b>\n📝 <b>Wallet:</b> ${address}\n\nFetching your latest transactions from the blockchain...`, 
        { parse_mode: 'HTML' as const }
      );
      
      // Import blockchain explorer service
      const { getTransactions } = require('../services/blockExplorer');
      
      // Get real transaction data (force refresh to bypass cache)
      const txResult = await getTransactions(address, 5, true);
      
      // Check if we got data successfully
      if (!txResult.success || !txResult.data || txResult.data.length === 0) {
        bot.editMessageText(
          `📜 <b>Transaction History</b>\n📝 <b>Wallet Address:</b> ${address}\n\nNo transactions found for this wallet address. This could be a new wallet or our explorer API might be experiencing issues.`,
          {
            chat_id: chatId,
            message_id: loadingMessage.message_id,
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Refresh', callback_data: 'refresh_history' }],
                [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
              ]
            }
          }
        );
        return;
      }
      
      // Build transactions message
      let txMessage = `📜 <b>Transaction History</b>\n`;
      txMessage += `📝 <b>Wallet Address:</b> ${address}\n\n`;
      
      // Parse and display transactions
      for (const tx of txResult.data) {
        // Format the date
        const date = new Date(tx.timestamp).toLocaleDateString();
        const time = new Date(tx.timestamp).toLocaleTimeString();
        
        // Format transaction type
        let typeIcon = '↔️';
        let typeText = 'INTERACTION';
        
        if (tx.from && tx.to && tx.from.toLowerCase() === address.toLowerCase()) {
          typeIcon = '📤';
          typeText = 'SENT';
        } else if (tx.to && tx.to.toLowerCase() === address.toLowerCase()) {
          typeIcon = '📥';
          typeText = 'RECEIVED';
        }
        
        // Format the value
        const valueText = tx.value ? `${tx.value.toFixed(6)} ETH` : '';
        
        // Transaction status
        const statusIcon = tx.status === 'success' ? '✅' : '❌';
        
        // Build transaction line
        txMessage += `${typeIcon} <b>${typeText}</b> ${statusIcon} - ${date} ${time}\n`;
        if (valueText) {
          txMessage += `Amount: ${valueText}\n`;
        }
        txMessage += `<a href="https://basescan.org/tx/${tx.txHash}">View on Basescan</a>\n\n`;
      }
      
      // Add options to return to portfolio or main menu
      const options = {
        parse_mode: 'HTML' as const,
        chat_id: chatId,
        message_id: loadingMessage.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'refresh_history' }],
            [{ text: '⬅️ Back to Portfolio', callback_data: 'show_portfolio' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      };
      
      bot.editMessageText(txMessage, options);
    } catch (error) {
      console.error('Error refreshing transaction history:', error);
      bot.sendMessage(chatId, `❌ An error occurred while refreshing your transaction history: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  }
  else if (action === 'sniper_new') {
    try {
      // Check if user has a wallet
      const walletManager = require('../services/cdpWallet');
      const userId = callbackQuery.from.id.toString();
      
      if (!walletManager.userHasWallet(userId)) {
        bot.sendMessage(chatId, '❌ You don\'t have a wallet set up yet. Please use /wallet to create one.');
        return;
      }
      
      // Check if wallet is unlocked
      if (!walletManager.isWalletUnlocked(userId)) {
        bot.sendMessage(chatId, '❌ Your wallet is locked. Please use /wallet to unlock it first.');
        return;
      }
      
      // Set conversation state for sniper setup
      conversationStates.set(chatId, 'AWAITING_SNIPER_TOKEN');
      
      bot.sendMessage(chatId, '🎯 <b>New Sniper Bot</b>\n\nEnter the token contract address you want to snipe:\n\n<i>Example: 0x1234567890123456789012345678901234567890</i>', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Sniper Menu', callback_data: 'sniper_menu' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error setting up sniper:', error);
      bot.sendMessage(chatId, `❌ Error setting up sniper: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  }
  else if (action === 'sniper_list') {
    try {
      // Get user's active snipers
      const userId = callbackQuery.from.id.toString();
      
      if (!users.has(userId)) {
        users.set(userId, {});
      }
      const userData = users.get(userId);
      const snipers = userData.snipers || [];
      
      if (snipers.length === 0) {
        bot.sendMessage(chatId, '📋 <b>My Snipers</b>\n\nYou don\'t have any active sniper bots yet.', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ New Sniper Bot', callback_data: 'sniper_new' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
        return;
      }
      
      // Build sniper list message
      let message = '📋 <b>My Snipers</b>\n\n';
      const buttons = [];
      
      snipers.forEach((sniper, index) => {
        message += `${index + 1}. <b>${sniper.tokenSymbol || 'Unknown'}</b>\n`;
        message += `   Address: <code>${sniper.tokenAddress}</code>\n`;
        message += `   Status: ${sniper.active ? '🟢 Active' : '🔴 Inactive'}\n`;
        message += `   Amount: ${sniper.amount} ETH\n\n`;
        
        buttons.push([
          { text: `${sniper.active ? '⏸️ Pause' : '▶️ Resume'}`, callback_data: `sniper_toggle_${index}` },
          { text: '🗑️ Delete', callback_data: `sniper_delete_${index}` }
        ]);
      });
      
      buttons.push([{ text: '➕ New Sniper Bot', callback_data: 'sniper_new' }]);
      buttons.push([{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]);
      
      bot.sendMessage(chatId, message, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    } catch (error) {
      console.error('Error listing snipers:', error);
      bot.sendMessage(chatId, `❌ Error loading snipers: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  }
  else if (action === 'sniper_settings') {
    try {
      bot.sendMessage(chatId, '⚙️ <b>Sniper Settings</b>\n\nConfigure your sniper bot settings:', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏱️ Slippage Tolerance', callback_data: 'sniper_slippage' }],
            [{ text: '💰 Max Buy Amount', callback_data: 'sniper_max_amount' }],
            [{ text: '⚡ Gas Settings', callback_data: 'sniper_gas' }],
            [{ text: '🔔 Notifications', callback_data: 'sniper_notifications' }],
            [{ text: '🏠 Back to Sniper Menu', callback_data: 'sniper_menu' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error showing sniper settings:', error);
      bot.sendMessage(chatId, `❌ Error loading settings: ${error.message}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        }
      });
    }
  }
  else if (action === 'sniper_menu') {
    // Show the sniper menu (same as /sniper command)
    bot.sendMessage(chatId, '🎯 <b>Token Sniper</b>\n\nQuickly buy new tokens as soon as they are available:', {
      parse_mode: 'HTML' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ New Sniper Bot', callback_data: 'sniper_new' }],
          [{ text: '📋 My Snipers', callback_data: 'sniper_list' }],
          [{ text: '⚙️ Sniper Settings', callback_data: 'sniper_settings' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
  else if (action === 'back_to_main') {
    showMainMenu(chatId);
  }
});

// Add new menu commands
// /config wallet command for wallet configuration
bot.onText(/^\/config wallet$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '⚙️ <b>Wallet Configuration</b>\n\nConfigure your wallet settings:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔐 Security Settings', callback_data: 'wallet_security' }],
        [{ text: '💰 Default Gas Settings', callback_data: 'wallet_gas' }],
        [{ text: '🔄 Network Settings', callback_data: 'wallet_network' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /positions command for viewing portfolio positions
bot.onText(/^\/positions$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  try {
    // Get wallet manager
    const walletManager = require('../services/cdpWallet');
    
    // Check if wallet is set up and unlocked
    if (!walletManager.userHasWallet(userId)) {
      bot.sendMessage(chatId, '❌ You need to set up a wallet first. Use /wallet to create one.');
      return;
    }
    
    // Get portfolio data
    // For now, redirect to portfolio view
    bot.sendMessage(chatId, '📊 <b>Your Positions</b>\n\nLoading your portfolio positions...', {
      parse_mode: 'HTML' as const
    });
    
    // Show portfolio directly instead of emit
    try {
      // Get wallet balances
      const balanceResult = await walletManager.getWalletBalances(userId);
      
      if (!balanceResult.success) {
        bot.sendMessage(chatId, `❌ Failed to load positions: ${balanceResult.message}`);
        return;
      }
      
      // Process the balance data
      const balances = balanceResult.balances || {};
      const tokens = Object.keys(balances);
      const address = balanceResult.address; // Get wallet address
      
      // Simple price mapping for estimation
      const priceMapping = {
        'ETH': 3000,
        'WETH': 3000,
        'USDC': 1,
        'USDT': 1,
        'ZORA': 2.5,
        'DEFAULT': 1 // Default price for unknown tokens
      };
      
      // Calculate total portfolio value
      let totalValue = 0;
      let portfolioText = '📊 <b>Your Positions</b>\n\n';
      portfolioText += `📝 <b>Wallet Address:</b> ${address}\n\n`;
      
      if (tokens.length === 0) {
        portfolioText += 'Total Value: N/A\n\n\nNo tokens found in your portfolio.';
      } else {
        // Build token list and calculate total value
        let tokensList = '';
        
        for (const symbol of tokens) {
          const balance = parseFloat(balances[symbol]);
          const price = priceMapping[symbol] || priceMapping.DEFAULT;
          const value = balance * price;
          
          totalValue += value;
          tokensList += `• ${symbol}: ${balances[symbol]} ($${value.toFixed(2)})\n`;
        }
        
        portfolioText += `Total Value: $${totalValue.toFixed(2)}\n\n<b>Holdings:</b>\n${tokensList}`;
      }
      
      const portfolioOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 Transaction History', callback_data: 'show_transactions' }],
            [{ text: '🔄 Refresh Portfolio', callback_data: 'refresh_portfolio' }],
            [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
          ]
        },
        parse_mode: 'HTML' as const
      };
      
      bot.sendMessage(chatId, portfolioText, portfolioOptions);
    } catch (error) {
      console.error('Error displaying portfolio from positions:', error);
      bot.sendMessage(chatId, `❌ An error occurred: ${error.message}`);
    }
  } catch (error) {
    console.error('Error displaying positions:', error);
    bot.sendMessage(chatId, '❌ Failed to load positions: ' + error.message);
  }
});

// /sniper command for token sniping features
bot.onText(/^\/sniper$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🎯 <b>Token Sniper</b>\n\nQuickly buy new tokens as soon as they are available:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ New Sniper Bot', callback_data: 'sniper_new' }],
        [{ text: '📋 My Snipers', callback_data: 'sniper_list' }],
        [{ text: '⚙️ Sniper Settings', callback_data: 'sniper_settings' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /trade command for trading options
bot.onText(/^\/trade$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🔄 <b>Trading Options</b>\n\nChoose your trading method:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Swap Tokens', callback_data: 'trade_swap' }],
        [{ text: '💰 Buy Tokens', callback_data: 'trade_buy' }],
        [{ text: '💸 Sell Tokens', callback_data: 'trade_sell' }],
        [{ text: '⏱️ Limit Orders', callback_data: 'limit_new' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /discover command for token discovery
bot.onText(/^\/discover$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🔍 <b>Discover Tokens</b>\n\nFind new and trending tokens:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🆕 New Tokens', callback_data: 'discover_new' }],
        [{ text: '📈 Trending Tokens', callback_data: 'discover_trending' }],
        [{ text: '🔍 Search Tokens', callback_data: 'discover_search' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /alerts command for price alerts
bot.onText(/^\/alerts$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🔔 <b>Price Alerts</b>\n\nManage your price alerts:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ New Alert', callback_data: 'alert_new' }],
        [{ text: '📋 My Alerts', callback_data: 'alert_list' }],
        [{ text: '⚙️ Alert Settings', callback_data: 'alert_settings' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /settings command for bot settings
bot.onText(/^\/settings$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '⚙️ <b>Bot Settings</b>\n\nConfigure your bot preferences:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔔 Notifications', callback_data: 'settings_notifications' }],
        [{ text: '🌐 Language', callback_data: 'settings_language' }],
        [{ text: '🔄 Trading Defaults', callback_data: 'settings_trading' }],
        [{ text: '🔐 Security', callback_data: 'settings_security' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /copy trade command for copy trading features
bot.onText(/^\/copy trade$/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Show copy trading menu directly
  bot.sendMessage(chatId, '👥 <b>Copy Trading</b>\n\nAutomatically copy trades from successful traders:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Add New Mirror', callback_data: 'add_mirror' }],
        [{ text: '📋 My Active Mirrors', callback_data: 'list_mirrors' }],
        [{ text: '⚙️ Mirror Settings', callback_data: 'mirror_settings' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /limit command for setting limit orders
bot.onText(/^\/limit$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📊 <b>Limit Orders</b>\n\nCreate and manage limit orders:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Create Limit Order', callback_data: 'limit_new' }],
        [{ text: '📋 Active Limit Orders', callback_data: 'limit_active' }],
        [{ text: '📜 Limit Order History', callback_data: 'limit_history' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /transfer command for token transfers
bot.onText(/^\/transfer$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  try {
    // Get wallet manager
    const walletManager = require('../services/cdpWallet');
    
    // Check if wallet is set up
    if (!walletManager.userHasWallet(userId)) {
      bot.sendMessage(chatId, '❌ You need to set up a wallet first. Use /wallet to create one.');
      return;
    }
    
    // Set conversation state for transfer
    conversationStates.set(chatId, 'AWAITING_TRANSFER_ADDRESS');
    
    bot.sendMessage(chatId, '💸 <b>Transfer Tokens</b>\n\nPlease enter the destination address:', {
      parse_mode: 'HTML' as const,
      reply_markup: {
        force_reply: true
      }
    });
  } catch (error) {
    console.error('Error starting transfer:', error);
    bot.sendMessage(chatId, '❌ Failed to start transfer: ' + error.message);
  }
});

// /history command for transaction history
bot.onText(/^\/history$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  try {
    // Get wallet manager
    const walletManager = require('../services/cdpWallet');
    
    // Check if user has a wallet
    if (!walletManager.userHasWallet(userId)) {
      bot.sendMessage(chatId, '❌ You need to set up a wallet first. Use /wallet to create one.');
      return;
    }
    
    // Get UseZoracle API wallet address
    const address = await walletManager.getUseZoracleAddress(userId);
    
    if (!address) {
      bot.sendMessage(chatId, '❌ Unable to get wallet address. Please make sure your wallet is unlocked.');
      return;
    }
    
    // Show loading message
    const loadingMessage = await bot.sendMessage(chatId, 
      `🔍 <b>Loading Transaction History</b>\n📝 <b>Wallet:</b> ${address}\n\nFetching your transactions from the blockchain...`, 
      { parse_mode: 'HTML' as const }
    );
    
    // Import blockchain explorer service
    const { getTransactions } = require('../services/blockExplorer');
    
    // Get real transaction data
    const txResult = await getTransactions(address, 5);
    
    // Check if we got data successfully
    if (!txResult.success || !txResult.data || txResult.data.length === 0) {
      bot.editMessageText(
        `📜 <b>Transaction History</b>\n📝 <b>Wallet Address:</b> ${address}\n\nNo transactions found for this wallet address. This could be a new wallet or our explorer API might be experiencing issues.`,
        {
          chat_id: chatId,
          message_id: loadingMessage.message_id,
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Refresh', callback_data: 'refresh_history' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        }
      );
      return;
    }
    
    // Build transactions message
    let txMessage = `📜 <b>Transaction History</b>\n`;
    txMessage += `📝 <b>Wallet Address:</b> ${address}\n\n`;
    
    // Parse and display transactions
    for (const tx of txResult.data) {
      // Format the date
      const date = new Date(tx.timestamp).toLocaleDateString();
      const time = new Date(tx.timestamp).toLocaleTimeString();
      
      // Format transaction type
      let typeIcon = '↔️';
      let typeText = 'INTERACTION';
      
      if (tx.from && tx.to && tx.from.toLowerCase() === address.toLowerCase()) {
        typeIcon = '📤';
        typeText = 'SENT';
      } else if (tx.to && tx.to.toLowerCase() === address.toLowerCase()) {
        typeIcon = '📥';
        typeText = 'RECEIVED';
      }
      
      // Format the value
      const valueText = tx.value ? `${tx.value.toFixed(6)} ETH` : '';
      
      // Transaction status
      const statusIcon = tx.status === 'success' ? '✅' : '❌';
      
      // Build transaction line
      txMessage += `${typeIcon} <b>${typeText}</b> ${statusIcon} - ${date} ${time}\n`;
      if (valueText) {
        txMessage += `Amount: ${valueText}\n`;
      }
      txMessage += `<a href="https://basescan.org/tx/${tx.txHash}">View on Basescan</a>\n\n`;
    }
    
    // Add options to return to portfolio or main menu
    const options = {
      parse_mode: 'HTML' as const,
      chat_id: chatId,
      message_id: loadingMessage.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: 'refresh_history' }],
          [{ text: '⬅️ Back to Portfolio', callback_data: 'show_portfolio' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      }
    };
    
    bot.editMessageText(txMessage, options);
  } catch (error) {
    console.error('Error displaying transaction history:', error);
    bot.sendMessage(chatId, `❌ An error occurred while loading your transaction history: ${error.message}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      }
    });
  }
});

// /settings command for bot settings
bot.onText(/^\/settings$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '⚙️ <b>Bot Settings</b>\n\nConfigure your bot preferences:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔔 Notification Settings', callback_data: 'settings_notifications' }],
        [{ text: '🌐 Language Settings', callback_data: 'settings_language' }],
        [{ text: '🔄 Trading Defaults', callback_data: 'settings_trading' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// /referrals command for referral program
bot.onText(/^\/referrals$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Generate referral link with user ID
  const referralLink = `https://t.me/ZoracleTradingBot?start=ref_${userId}`;
  
  bot.sendMessage(chatId, `🎁 <b>Referral Program</b>\n\nInvite friends to use Zoracle Bot and earn rewards!\n\nYour referral link:\n${referralLink}\n\nRewards:\n• 5% of fees from referred users\n• Special features unlocked at 5+ referrals`, {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [
        [{ text: '📊 My Referrals', callback_data: 'show_my_referrals' }],
        [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
      ]
    }
  });
});

// Handle onboarding responses (state machine)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = conversationStates.get(chatId);
  
  if (!state) return;
  
  // Get or initialize user data
  if (!users.has(chatId.toString())) {
    users.set(chatId.toString(), {});
  }
  const userData = users.get(chatId.toString());

  // Variables declared outside switch to avoid linter errors
  let pin, result, password, unlockResult, quickPin, quickUnlockResult, 
      setupToken, enable2FAResult, unlockToken, twoFAUnlockResult;

  // Handle different states
  switch (state) {
    case STATES.WALLET_SETUP:
      // Password entered
      userData.tempPassword = msg.text.trim();
      conversationStates.set(chatId, STATES.PIN_SETUP);
      
      bot.sendMessage(chatId, '🔢 <b>Create PIN</b>\n\nEnter a 4-6 digit PIN for quick access:', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      break;

    case STATES.PIN_SETUP:
      // PIN entered
      pin = msg.text.trim();
      
      if (userData.tempPK) {
        // Import wallet
        result = await walletManager.importWallet(chatId.toString(), userData.tempPK, userData.tempPassword, pin);
      } else if (userData.tempSeed) {
        // Import from seed
        result = await walletManager.importWalletFromMnemonic(chatId.toString(), userData.tempSeed, userData.tempPassword, pin);
      } else {
        // Create new wallet
        result = await walletManager.createWallet(chatId.toString(), userData.tempPassword, pin);
      }
      
      if (result.success) {
        // Clear sensitive data
        delete userData.tempPassword;
        delete userData.tempPK;
        delete userData.tempSeed;
        
        // Ask about 2FA
        bot.sendMessage(chatId, '🔐 <b>Wallet Setup Complete!</b>\n\nWould you like to enable Two-Factor Authentication (2FA) for extra security?', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Yes, Enable 2FA', callback_data: 'enable_2fa' }],
              [{ text: '⏭️ Skip for now', callback_data: 'skip_2fa' }]
            ]
          }
        });
        
        // Show wallet address
        if (result.address) {
          bot.sendMessage(chatId, `🏦 <b>Your Wallet Address:</b>\n<code>${result.address}</code>`, {
            parse_mode: 'HTML' as const
          });
        }
        
        // Show mnemonic if created new wallet
        if (result.mnemonic) {
          bot.sendMessage(chatId, '🔐 <b>IMPORTANT: Save Your Recovery Phrase</b>\n\n<code>' + result.mnemonic + '</code>\n\n⚠️ <b>Never share this with anyone!</b> Write it down and keep it in a safe place. You will need it to recover your wallet if you lose access.', {
            parse_mode: 'HTML' as const
          });
        }
      } else {
        bot.sendMessage(chatId, '❌ <b>Error:</b> ' + result.message, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'back_to_start' }]
            ]
          }
        });
      }
      break;
      
    case 'AWAITING_PRIVATEKEY':
      // Private key entered
      userData.tempPK = msg.text.trim();
      conversationStates.set(chatId, STATES.WALLET_SETUP);
      
      // Delete the message containing the private key for security
      bot.deleteMessage(chatId, msg.message_id).catch(e => console.log('Could not delete message with private key'));
      
      bot.sendMessage(chatId, '🔐 <b>Import Wallet</b>\n\nPlease enter a password to encrypt your wallet:', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'AWAITING_SEED':
      // Seed phrase entered
      userData.tempSeed = msg.text.trim();
      conversationStates.set(chatId, STATES.WALLET_SETUP);
      
      // Delete the message containing the seed phrase for security
      bot.deleteMessage(chatId, msg.message_id).catch(e => console.log('Could not delete message with seed phrase'));
      
      bot.sendMessage(chatId, '🔐 <b>Import Wallet</b>\n\nPlease enter a password to encrypt your wallet:', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'AWAITING_PASSWORD':
      // Password entered for unlock
      password = msg.text.trim();
      
      // Delete the message containing the password for security
      bot.deleteMessage(chatId, msg.message_id).catch(e => console.log('Could not delete message with password'));
      
      unlockResult = await walletManager.loadWallet(chatId.toString(), password);
      
      if (unlockResult.success) {
        bot.sendMessage(chatId, '✅ <b>Wallet Unlocked Successfully!</b>', {
          parse_mode: 'HTML' as const
        });
        
        // Show main menu
        showMainMenu(chatId);
      } else if (unlockResult.requireTwoFactor) {
        conversationStates.set(chatId, 'AWAITING_2FA_UNLOCK');
        userData.tempPassword = password;
        
        bot.sendMessage(chatId, '🔐 <b>2FA Required</b>\n\nPlease enter your 6-digit authentication code:', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            force_reply: true
          }
        });
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + unlockResult.message, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'wallet_unlock' }]
            ]
          }
        });
      }
      break;

    case 'AWAITING_PIN':
      // PIN entered for quick unlock
      quickPin = msg.text.trim();
      
      // Delete the message containing the PIN for security
      bot.deleteMessage(chatId, msg.message_id).catch(e => console.log('Could not delete message with PIN'));
      
      quickUnlockResult = await walletManager.quickUnlockWallet(chatId.toString(), quickPin);
      
      if (quickUnlockResult.success) {
        bot.sendMessage(chatId, '✅ <b>Wallet Unlocked Successfully!</b>', {
          parse_mode: 'HTML' as const
        });
        
        // Show main menu
        showMainMenu(chatId);
      } else if (quickUnlockResult.requireTwoFactor) {
        conversationStates.set(chatId, 'AWAITING_2FA_QUICK_UNLOCK');
        userData.tempPin = quickPin;
        
        bot.sendMessage(chatId, '🔐 <b>2FA Required</b>\n\nPlease enter your 6-digit authentication code:', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            force_reply: true
          }
        });
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + quickUnlockResult.message, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'wallet_quick_unlock' }]
            ]
          }
        });
      }
      break;
      
    case 'AWAITING_2FA_TOKEN':
      // 2FA token entered for setup
      setupToken = msg.text.trim();
      
      enable2FAResult = await walletManager.enable2FA(chatId.toString(), setupToken);
      
      if (enable2FAResult.success) {
        bot.sendMessage(chatId, '✅ <b>2FA Enabled Successfully!</b>\n\n🔐 <b>Backup Codes:</b>\n' + 
          enable2FAResult.backupCodes.join('\n') + 
          '\n\n⚠️ Save these backup codes in a safe place. You can use them if you lose access to your authenticator app.', {
          parse_mode: 'HTML' as const
        });
        
        // Show main menu
        conversationStates.set(chatId, STATES.COMPLETE);
        showMainMenu(chatId);
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + enable2FAResult.message, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'enable_2fa' }],
              [{ text: '⏭️ Skip for now', callback_data: 'skip_2fa' }]
            ]
          }
        });
      }
      break;
      
    case 'AWAITING_2FA_UNLOCK':
      // 2FA token entered for unlock
      unlockToken = msg.text.trim();
      
      // Try to unlock with password and 2FA
      twoFAUnlockResult = await walletManager.loadWallet(chatId.toString(), userData.tempPassword, unlockToken);
      
      // Clear sensitive data
      delete userData.tempPassword;
      
      if (twoFAUnlockResult.success) {
        bot.sendMessage(chatId, '✅ <b>Wallet Unlocked Successfully!</b>', {
          parse_mode: 'HTML' as const
        });
        
        // Show main menu
        showMainMenu(chatId);
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + twoFAUnlockResult.message, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'wallet_unlock' }]
            ]
          }
        });
      }
      break;

    case 'AWAITING_BUY_TOKEN':
      // User entered token address for buying
      let inputTokenAddress = msg.text.trim();
      
      try {
        // Check if wallet is unlocked
        if (!walletManager.isWalletUnlocked(chatId.toString())) {
          bot.sendMessage(chatId, '🔒 <b>Wallet Locked</b>\n\nYou need to unlock your wallet first.', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔓 Unlock Wallet', callback_data: 'wallet_unlock' }]
              ]
            }
          });
          conversationStates.delete(chatId);
          return;
        }
        
        // Validate and normalize token address
        let tokenAddress;
        try {
          // Convert to checksum address format
          tokenAddress = ethers.utils.getAddress(inputTokenAddress);
        } catch (error) {
          bot.sendMessage(chatId, '❌ <b>Invalid Address</b>\n\nPlease enter a valid token contract address.', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: 'trade_buy' }]
              ]
            }
          });
          return;
        }
        
        // Get token info
        const tokenInfo = await getTokenInfo(tokenAddress);
        
        // Get token price and additional data
        const trading = await import('../services/trading');
        const priceQuote = await trading.getTokenPrice(tokenAddress);
        
        // Create token contract to get additional details
        const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL || 'https://rpc.ankr.com/base/b39a19f9ecf66252bf862fe6948021cd1586009ee97874655f46481cfbf3f129');
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function totalSupply() view returns (uint256)",
            "function balanceOf(address) view returns (uint256)"
          ],
          provider
        );
        
        // Fetch detailed token information
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          tokenContract.name().catch(() => "Unknown Token"),
          tokenContract.symbol().catch(() => "????"),
          tokenContract.decimals().catch(() => 18),
          tokenContract.totalSupply().catch(() => ethers.BigNumber.from("0"))
        ]);
        
        // Format total supply with appropriate decimals
        const formattedTotalSupply = ethers.utils.formatUnits(totalSupply, decimals);
        
        // Send detailed token info message
        const detailedTokenInfo = `🔍 <b>Token Information</b>\n\n` +
          `<b>Name:</b> ${name}\n` +
          `<b>Symbol:</b> ${symbol}\n` +
          `<b>Address:</b> <code>${tokenAddress}</code>\n` +
          `<b>Decimals:</b> ${decimals}\n` +
          `<b>Total Supply:</b> ${parseFloat(formattedTotalSupply).toLocaleString()} ${symbol}\n` +
          `<b>Current Price:</b> ${priceQuote.price} ETH\n`;
          
        // Add BaseScan link
        const basescanLink = `<a href="https://basescan.org/token/${tokenAddress}">View on BaseScan</a>`;
        
        // First, send the token details message
        await bot.sendMessage(chatId, detailedTokenInfo + "\n" + basescanLink, {
          parse_mode: 'HTML' as const,
          disable_web_page_preview: true
        });
        
        // Update conversation state with token info
        conversationStates.set(chatId, 'AWAITING_BUY_AMOUNT');
        userData.buyToken = {
          address: tokenAddress,
          info: {
            name,
            symbol,
            decimals,
            totalSupply: formattedTotalSupply,
            ...tokenInfo
          },
          price: priceQuote.price
        };
        
        // Then ask for amount to buy
        let message = `💵 <b>Buy ${name} (${symbol})</b>\n\n`;
        message += 'How much ETH would you like to spend? (You can also type "max" to spend all available ETH)';
        
        bot.sendMessage(chatId, message, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Cancel Trade', callback_data: 'cancel_trade' }]
            ]
          }
        });
      } catch (error) {
        console.error('Error processing buy token input:', error);
        bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_buy' }]
            ]
          }
        });
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_BUY_AMOUNT':
      // User entered amount of ETH to spend
      let amountInput = msg.text.trim();
      let amountETH;
      
      try {
        // Check if wallet is still unlocked
        if (!walletManager.isWalletUnlocked(chatId.toString())) {
          bot.sendMessage(chatId, '🔒 <b>Wallet Locked</b>\n\nYour wallet has been locked due to inactivity.', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔓 Unlock Wallet', callback_data: 'wallet_unlock' }]
              ]
            }
          });
          conversationStates.delete(chatId);
          return;
        }
        
        // Get user's ETH balance
        const balanceResult = await getEthBalance(chatId.toString());
        const ethBalance = balanceResult.balance || '0';
        
        if (amountInput.toLowerCase() === 'max') {
          // Use max balance minus gas buffer
          const maxAmount = parseFloat(ethBalance) * 0.95; // 5% buffer for gas
          amountETH = maxAmount.toFixed(6);
        } else {
          // Parse user input
          amountETH = amountInput;
          
          // Validate amount
          const parsedAmount = parseFloat(amountETH);
          if (isNaN(parsedAmount) || parsedAmount <= 0) {
            bot.sendMessage(chatId, '❌ <b>Invalid Amount</b>\n\nPlease enter a valid ETH amount.', {
              parse_mode: 'HTML' as const
            });
            return;
          }
          
          // Check if user has enough ETH
          if (parsedAmount > parseFloat(ethBalance)) {
            bot.sendMessage(chatId, `❌ <b>Insufficient Balance</b>\n\nYou have ${ethBalance} ETH available.`, {
              parse_mode: 'HTML' as const,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💰 Use Max Balance', callback_data: 'use_max_eth' }]
                ]
              }
            });
            return;
          }
        }
        
        // Get token info from user data
        const buyToken = userData.buyToken;
        if (!buyToken || !buyToken.address) {
          throw new Error('Token information not found.');
        }
        
        // Ask for confirmation with slippage options
        const confirmMessage = `🔄 <b>Confirm Trade</b>\n\n` +
          `You are about to buy tokens with ${amountETH} ETH.\n\n` +
          `Token: ${buyToken.info?.name || buyToken.address}\n` +
          `Price: ${buyToken.price} ETH\n\n` +
          `Please select your slippage tolerance:`;
        
        bot.sendMessage(chatId, confirmMessage, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '0.5%', callback_data: `confirm_buy_0.5_${amountETH}_${buyToken.address}` },
                { text: '1%', callback_data: `confirm_buy_1.0_${amountETH}_${buyToken.address}` },
                { text: '2%', callback_data: `confirm_buy_2.0_${amountETH}_${buyToken.address}` }
              ],
              [
                { text: '❌ Cancel', callback_data: 'cancel_trade' }
              ]
            ]
          }
        });
        
        // Update conversation state
        conversationStates.set(chatId, 'AWAITING_BUY_CONFIRM');
        
      } catch (error) {
        console.error('Error processing buy amount input:', error);
        bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_buy' }]
            ]
          }
        });
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_MIRROR_WALLET':
      // User entered wallet address to mirror
      const mirrorWalletAddress = msg.text.trim();
      
      try {
        // Validate the address
        if (!ethers.utils.isAddress(mirrorWalletAddress)) {
          bot.sendMessage(chatId, '❌ <b>Invalid Address</b>\n\nPlease enter a valid Ethereum address.', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: 'add_mirror' }]
              ]
            }
          });
          conversationStates.delete(chatId);
          return;
        }
        
        // Update state and ask for slippage
        conversationStates.set(chatId, 'AWAITING_MIRROR_SLIPPAGE');
        userData.mirrorTarget = mirrorWalletAddress;
        
        bot.sendMessage(chatId, 'Please enter the maximum slippage percentage (1-10):');
      } catch (error) {
        console.error('Error processing mirror wallet:', error);
        bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
          parse_mode: 'HTML' as const
        });
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_MIRROR_SLIPPAGE':
      // User entered slippage percentage
      const slippageInput = msg.text.trim();
      
      try {
        // Validate slippage
        const slippage = parseFloat(slippageInput);
        
        if (isNaN(slippage) || slippage < 0.1 || slippage > 10) {
          bot.sendMessage(chatId, '❌ <b>Invalid Slippage</b>\n\nPlease enter a number between 0.1 and 10.', {
            parse_mode: 'HTML' as const
          });
          return;
        }
        
        // Update state and ask for max ETH per trade
        conversationStates.set(chatId, 'AWAITING_MIRROR_MAX_ETH');
        userData.mirrorSlippage = slippage;
        
        bot.sendMessage(chatId, 'Please enter the maximum ETH per trade:');
      } catch (error) {
        console.error('Error processing mirror slippage:', error);
        bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
          parse_mode: 'HTML' as const
        });
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_MIRROR_MAX_ETH':
      // User entered max ETH per trade
      const maxEthInput = msg.text.trim();
      
      try {
        // Validate max ETH
        const maxEthPerTrade = parseFloat(maxEthInput);
        
        if (isNaN(maxEthPerTrade) || maxEthPerTrade <= 0) {
          bot.sendMessage(chatId, '❌ <b>Invalid Amount</b>\n\nPlease enter a positive number.', {
            parse_mode: 'HTML' as const
          });
          return;
        }
        
        // Ask for sandbox mode
        conversationStates.set(chatId, 'AWAITING_MIRROR_SANDBOX');
        userData.mirrorMaxEth = maxEthPerTrade;
        
        const options = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🧪 Sandbox Mode (Simulated)', callback_data: 'mirror_sandbox_yes' },
                { text: '🔴 Live Mode (Real)', callback_data: 'mirror_sandbox_no' }
              ]
            ]
          },
          parse_mode: 'HTML' as const
        };
        
        bot.sendMessage(chatId, 'Do you want to enable sandbox mode? In sandbox mode, trades will be simulated and no real transactions will be made.', options);
      } catch (error) {
        console.error('Error processing mirror max ETH:', error);
        bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
          parse_mode: 'HTML' as const
        });
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_SELL_AMOUNT':
      // User entered amount of tokens to sell
      let tokenAmountInput = msg.text.trim();
      let tokenAmount;
      
      try {
        // Check if wallet is still unlocked
        if (!walletManager.isWalletUnlocked(chatId.toString())) {
          bot.sendMessage(chatId, '🔒 <b>Wallet Locked</b>\n\nYour wallet has been locked due to inactivity.', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔓 Unlock Wallet', callback_data: 'wallet_unlock' }]
              ]
            }
          });
          conversationStates.delete(chatId);
          return;
        }
        
        // Get token info from user data
        const sellToken = userData.sellToken;
        if (!sellToken || !sellToken.address || !sellToken.balance) {
          throw new Error('Token information not found.');
        }
        
        if (tokenAmountInput.toLowerCase() === 'max') {
          // Use entire token balance
          tokenAmount = sellToken.balance;
        } else {
          // Parse user input
          tokenAmount = tokenAmountInput;
          
          // Validate amount
          const parsedAmount = parseFloat(tokenAmount);
          if (isNaN(parsedAmount) || parsedAmount <= 0) {
            bot.sendMessage(chatId, '❌ <b>Invalid Amount</b>\n\nPlease enter a valid token amount.', {
              parse_mode: 'HTML' as const
            });
            return;
          }
          
          // Check if user has enough tokens
          if (parsedAmount > parseFloat(sellToken.balance)) {
            bot.sendMessage(chatId, `❌ <b>Insufficient Balance</b>\n\nYou have ${sellToken.balance} ${sellToken.info.symbol} available.`, {
              parse_mode: 'HTML' as const,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '💰 Use Max Balance', callback_data: 'sell_max_tokens' }]
                ]
              }
            });
            return;
          }
        }
        
        // Calculate estimated ETH to receive
        const estimatedETH = parseFloat(tokenAmount) * parseFloat(sellToken.price);
        
        // Ask for confirmation with slippage options
        const confirmMessage = `🔄 <b>Confirm Trade</b>\n\n` +
          `You are about to sell ${tokenAmount} ${sellToken.info.symbol}.\n\n` +
          `Estimated to receive: ~${estimatedETH.toFixed(6)} ETH\n\n` +
          `Please select your slippage tolerance:`;
        
        bot.sendMessage(chatId, confirmMessage, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '0.5%', callback_data: `confirm_sell_0.5_${tokenAmount}_${sellToken.address}` },
                { text: '1%', callback_data: `confirm_sell_1.0_${tokenAmount}_${sellToken.address}` },
                { text: '2%', callback_data: `confirm_sell_2.0_${tokenAmount}_${sellToken.address}` }
              ],
              [
                { text: '❌ Cancel', callback_data: 'cancel_trade' }
              ]
            ]
          }
        });
        
        // Update conversation state
        conversationStates.set(chatId, 'AWAITING_SELL_CONFIRM');
        
      } catch (error) {
        console.error('Error processing sell amount input:', error);
        bot.sendMessage(chatId, `❌ <b>Error</b>\n\n${error.message}`, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_sell' }]
            ]
          }
        });
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_SWAP_AMOUNT':
      try {
        // Get the amount input
        const inputAmount = msg.text.trim();
        
        // Import the services we need
        const swapService = require('../services/swaps');
        const walletManager = require('../services/cdpWallet');
        
        // Check if wallet is unlocked
        if (!walletManager.isWalletUnlocked(chatId.toString())) {
          if (userData.pin) {
            // Try to unlock with PIN
            const unlockResult = await walletManager.quickUnlockWallet(chatId.toString(), userData.pin);
            if (!unlockResult.success) {
              bot.sendMessage(chatId, '❌ Your wallet is locked. Please use /wallet to unlock it first.');
              return;
            }
          } else {
            bot.sendMessage(chatId, '❌ Your wallet is locked. Please use /wallet to unlock it first.');
            return;
          }
        }
        
        // Verify the input is a valid number
        const amount = parseFloat(inputAmount);
        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(chatId, '❌ Invalid amount. Please enter a positive number.');
          return;
        }
        
        // Get the tokens from user data
        const fromToken = userData.swapFromToken;
        const toToken = userData.swapToToken;
        
        if (!fromToken || !toToken) {
          throw new Error('Token selection data is missing');
        }
        
        // Show loading message
        const loadingMsg = await bot.sendMessage(chatId, '⏳ Getting price quote...');
        
        // Convert amount to base units for the API (e.g., Wei for ETH)
        // For simplicity, assume 18 decimals (which is standard for most ERC-20 tokens)
        const decimals = fromToken === 'ETH' ? 18 : 18; // Could be enhanced to get actual decimals
        const amountInBaseUnits = ethers.utils.parseUnits(inputAmount, decimals).toString();
        
        // Store amount info for later use
        userData.swapAmount = inputAmount;
        userData.swapFromAmount = amountInBaseUnits;
        
        // Get account name for the API
        const accountName = `zoracle-${chatId.toString()}`;
        
        // Get price quote
        const priceQuote = await swapService.getSwapPrice(
          accountName, 
          fromToken, 
          toToken, 
          amountInBaseUnits,
          'base'
        );
        
        // Delete loading message
        bot.deleteMessage(chatId, loadingMsg.message_id).catch(e => {});
        
        if (!priceQuote.success || !priceQuote.liquidityAvailable) {
          throw new Error(priceQuote.message || 'Failed to get price quote. Liquidity might not be available for this swap.');
        }
        
        // Store price quote for later use
        userData.swapEstimate = priceQuote;
        
        // Build confirmation message
        let confirmMsg = '🔄 <b>Swap Confirmation</b>\n\n';
        confirmMsg += `From: ${inputAmount} ${fromToken}\n`;
        confirmMsg += `To: ~${priceQuote.expectedOutputFormatted} ${toToken} (estimated)\n`;
        confirmMsg += `Minimum received: ${priceQuote.minOutputFormatted} ${toToken}\n`;
        confirmMsg += `Exchange rate: 1 ${fromToken} = ${priceQuote.exchangeRate} ${toToken}\n`;
        confirmMsg += `Fee: ${ethers.utils.formatUnits(priceQuote.feeAmount || '0')} ${toToken} (5%)\n\n`;
        confirmMsg += `Please select slippage tolerance:`;
        
        // Send confirmation message with slippage options
        bot.sendMessage(chatId, confirmMsg, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '0.5%', callback_data: 'confirm_swap_50' },
                { text: '1%', callback_data: 'confirm_swap_100' },
                { text: '2%', callback_data: 'confirm_swap_200' }
              ],
              [
                { text: '❌ Cancel Swap', callback_data: 'cancel_swap' }
              ]
            ]
          }
        });
        
        // Update conversation state
        conversationStates.set(chatId, 'AWAITING_SWAP_CONFIRM');
        
      } catch (error) {
        console.error('Error processing swap amount:', error);
        bot.sendMessage(chatId, `❌ Error: ${error.message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
        
        // Clear conversation state
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_CUSTOM_TOKEN':
      try {
        // Get the custom token address input
        const customTokenAddress = msg.text.trim();
        
        // Import the services we need
        const swapService = require('../services/swaps');
        const walletManager = require('../services/cdpWallet');
        
        // Check if wallet is unlocked
        if (!walletManager.isWalletUnlocked(chatId.toString())) {
          if (userData.pin) {
            // Try to unlock with PIN
            const unlockResult = await walletManager.quickUnlockWallet(chatId.toString(), userData.pin);
            if (!unlockResult.success) {
              bot.sendMessage(chatId, '❌ Your wallet is locked. Please use /wallet to unlock it first.');
              return;
            }
          } else {
            bot.sendMessage(chatId, '❌ Your wallet is locked. Please use /wallet to unlock it first.');
            return;
          }
        }
        
        // Import address validation utility
        const { isValidEthereumAddress } = require('../utils/addressValidation');
        
        // Validate the token address format
        if (!isValidEthereumAddress(customTokenAddress)) {
          bot.sendMessage(chatId, '❌ <b>Invalid Token Address</b>\n\nPlease enter a valid Ethereum contract address.\n\n<i>Example: 0x1234567890123456789012345678901234567890</i>', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: 'swap_to_custom' }],
                [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
              ]
            }
          });
          return;
        }
        
        // Normalize the address to checksum format
        let normalizedAddress;
        try {
          normalizedAddress = ethers.utils.getAddress(customTokenAddress);
        } catch (error) {
          bot.sendMessage(chatId, '❌ <b>Invalid Token Address Format</b>\n\nPlease enter a valid Ethereum contract address.', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: 'swap_to_custom' }],
                [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
              ]
            }
          });
          return;
        }
        
        // Store the custom token address for the session
        userData.swapToToken = normalizedAddress;
        
        // Get the from token
        const fromToken = userData.swapFromToken;
        
        if (!fromToken) {
          throw new Error('Source token not selected');
        }
        
        // Get real-time price for the custom token
        const priceResult = await swapService.getTokenPrice(normalizedAddress, 'base');
        
        let priceInfo = '';
        if (priceResult.success) {
          if (priceResult.priceUsd) {
            // Full price data available
            const price = parseFloat(priceResult.priceUsd).toFixed(6);
            const change24h = priceResult.priceChange24h ? parseFloat(priceResult.priceChange24h).toFixed(2) : 'N/A';
            const volume24h = priceResult.volume24h ? `$${parseFloat(priceResult.volume24h).toLocaleString()}` : 'N/A';
            
            priceInfo = `\n💰 <b>Token Price Info:</b>\n`;
            priceInfo += `Price: $${price}\n`;
            priceInfo += `24h Change: ${change24h}%\n`;
            priceInfo += `24h Volume: ${volume24h}\n`;
          } else if (priceResult.tokenInfo) {
            // Basic token info available
            const { symbol, name, decimals } = priceResult.tokenInfo;
            priceInfo = `\n📋 <b>Token Info:</b>\n`;
            priceInfo += `Symbol: ${symbol}\n`;
            priceInfo += `Name: ${name}\n`;
            priceInfo += `Decimals: ${decimals}\n`;
            priceInfo += `⚠️ <i>Price data not available</i>\n`;
          }
        } else {
          priceInfo = `\n⚠️ <i>Unable to retrieve token information</i>\n`;
        }
        
        // Set the conversation state for amount input
        conversationStates.set(chatId, 'AWAITING_SWAP_AMOUNT');
        
        // Send message asking for amount with price info
        bot.sendMessage(chatId, `🎯 <b>Custom Token Snipe</b>\n\nSwapping from <b>${fromToken}</b> to custom token\n\nToken Address: <code>${normalizedAddress}</code>${priceInfo}\n\nPlease enter the amount of ${fromToken} you want to swap:`, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ Different Token', callback_data: 'swap_to_custom' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
      } catch (error) {
        console.error('Error processing custom token address:', error);
        bot.sendMessage(chatId, `❌ Error processing token address: ${error.message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'swap_to_custom' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_SNIPER_TOKEN':
      try {
        // Get the token address input
        const tokenAddress = msg.text.trim();
        
        // Import address validation utility
        const { isValidEthereumAddress } = require('../utils/addressValidation');
        
        // Validate the token address format
        if (!isValidEthereumAddress(tokenAddress)) {
          bot.sendMessage(chatId, '❌ <b>Invalid Token Address</b>\n\nPlease enter a valid Ethereum contract address.\n\n<i>Example: 0x1234567890123456789012345678901234567890</i>', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: 'sniper_new' }],
                [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
              ]
            }
          });
          return;
        }
        
        // Normalize the address to checksum format
        let normalizedAddress;
        try {
          normalizedAddress = ethers.utils.getAddress(tokenAddress);
        } catch (error) {
          bot.sendMessage(chatId, '❌ <b>Invalid Token Address Format</b>\n\nPlease enter a valid Ethereum contract address.', {
            parse_mode: 'HTML' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Again', callback_data: 'sniper_new' }],
                [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
              ]
            }
          });
          return;
        }
        
        // Get token info using the swap service
        const swapService = require('../services/swaps');
        const tokenInfo = await swapService.getTokenPrice(normalizedAddress, 'base');
        
        // Store the token info for the sniper setup
        if (!users.has(chatId.toString())) {
          users.set(chatId.toString(), {});
        }
        const userData = users.get(chatId.toString());
        userData.sniperSetup = {
          tokenAddress: normalizedAddress,
          tokenInfo: tokenInfo
        };
        
        // Set conversation state for sniper amount
        conversationStates.set(chatId, 'AWAITING_SNIPER_AMOUNT');
        
        let tokenDisplay = '';
        if (tokenInfo.success && tokenInfo.tokenInfo) {
          const { symbol, name } = tokenInfo.tokenInfo;
          tokenDisplay = `\n📋 <b>Token Info:</b>\nSymbol: ${symbol}\nName: ${name}\nAddress: <code>${normalizedAddress}</code>`;
        } else {
          tokenDisplay = `\n📋 <b>Token Address:</b>\n<code>${normalizedAddress}</code>`;
        }
        
        // Send message asking for sniper amount
        bot.sendMessage(chatId, `🎯 <b>Sniper Bot Setup</b>\n\n${tokenDisplay}\n\nPlease enter the amount of ETH you want to use for sniping this token:`, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Different Token', callback_data: 'sniper_new' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
      } catch (error) {
        console.error('Error processing sniper token address:', error);
        bot.sendMessage(chatId, `❌ Error processing token address: ${error.message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'sniper_new' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
        conversationStates.delete(chatId);
      }
      break;
      
    case 'AWAITING_SNIPER_AMOUNT':
      try {
        // Get the amount input
        const inputAmount = msg.text.trim();
        
        // Verify the input is a valid number
        const amount = parseFloat(inputAmount);
        if (isNaN(amount) || amount <= 0) {
          bot.sendMessage(chatId, '❌ Invalid amount. Please enter a positive number.');
          return;
        }
        
        // Get user data and sniper setup
        if (!users.has(chatId.toString())) {
          throw new Error('User session data not found');
        }
        const userData = users.get(chatId.toString());
        const sniperSetup = userData.sniperSetup;
        
        if (!sniperSetup) {
          throw new Error('Sniper setup data not found');
        }
        
        // Create the sniper bot
        const newSniper = {
          tokenAddress: sniperSetup.tokenAddress,
          tokenSymbol: sniperSetup.tokenInfo?.tokenInfo?.symbol || 'UNKNOWN',
          amount: amount,
          active: true,
          createdAt: new Date().toISOString()
        };
        
        // Add to user's snipers
        if (!userData.snipers) {
          userData.snipers = [];
        }
        userData.snipers.push(newSniper);
        
        // Clear setup data
        delete userData.sniperSetup;
        
        // Clear conversation state
        conversationStates.delete(chatId);
        
        // Send confirmation message
        bot.sendMessage(chatId, `✅ <b>Sniper Bot Created!</b>\n\nToken: ${newSniper.tokenSymbol}\nAddress: <code>${newSniper.tokenAddress}</code>\nAmount: ${amount} ETH\nStatus: 🟢 Active\n\nYour sniper bot is now monitoring for opportunities to buy this token.`, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 View My Snipers', callback_data: 'sniper_list' }],
              [{ text: '➕ Create Another Sniper', callback_data: 'sniper_new' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
      } catch (error) {
        console.error('Error processing sniper amount:', error);
        bot.sendMessage(chatId, `❌ Error creating sniper bot: ${error.message}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'sniper_new' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
        conversationStates.delete(chatId);
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
  const result = await ((trading as any).executeSwap)(chatId.toString(), token, amount, true);
  bot.sendMessage(chatId, result.message);
});

bot.onText(/^\/sell (\w+) (\d+%?)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1];
  const amount = match[2];
  const result = await ((trading as any).executeSwap)(chatId.toString(), token, amount, false);
  bot.sendMessage(chatId, result.message);
});

bot.onText(/^\/limit (\w+) (\d+) (\d+) (buy|sell)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const [token, amount, price, type] = match.slice(1);
  const isBuy = type === 'buy';
  const result = await ((trading as any).createLimitOrder)(chatId.toString(), token, amount, price, isBuy);
  bot.sendMessage(chatId, result.message);
});

// Similar for /stoploss and /takeprofit

// Portfolio commands
bot.onText(/^\/portfolio ?(\d+)?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const threshold = match[1] ? parseInt(match[1], 10) : 0;
  
  // Import database operations
  const { UserOps, TransactionOps } = await import('../database/operations');
  
  // Log portfolio access in database
  try {
    await UserOps.updateLastActive(userId);
    console.log(`✅ User ${userId} portfolio access logged to database`);
  } catch (error) {
    console.error(`❌ Failed to log portfolio access for user ${userId}:`, error);
  }
  
  try {
    // Get wallet balances from UseZoracle API
    const balanceResult = await walletManager.getWalletBalances(userId);
    
    if (!balanceResult.success) {
      bot.sendMessage(chatId, `❌ Failed to load portfolio: ${balanceResult.message}`);
      return;
    }
    
    const balances = balanceResult.data.balances || [];
    const totalUsdValue = balanceResult.data.totalUsdValue || 0;
    let portfolioMessage = '💰 <b>Your Portfolio</b>\n\n';
    
    // Add total value header using API response
    portfolioMessage += `Total Value: $${totalUsdValue.toFixed(2)}\n\n`;
    portfolioMessage += 'Holdings:\n';
    
    // Process each token balance
    for (const balance of balances) {
      const token = balance.token;
      const amount = balance.amount;
      const usdValue = balance.usdValue || 0;
      
      // Format balance and USD value
      const formattedBalance = parseFloat(amount.formatted).toFixed(6);
      const formattedUsdValue = usdValue.toFixed(2);
      
      // Add token to portfolio message
      portfolioMessage += `• ${token.symbol}: ${formattedBalance} ($${formattedUsdValue})\n`;
    }
    
    // Send the formatted portfolio message
    bot.sendMessage(chatId, portfolioMessage, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('❌ Error loading portfolio:', error);
    bot.sendMessage(chatId, '❌ Failed to load portfolio. Please try again later.');
  }
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
  const slippage = match[2] ? parseInt(match[2], 10) : 2;
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
  // Convert helpMessage from Markdown to HTML for safe sending
  const htmlHelp = markdownToHtml(helpMessage);
  bot.sendMessage(msg.chat.id, htmlHelp, { parse_mode: 'HTML' });
});

// Debug command to test wallet.ts initialization and see CDP console log
bot.onText(/^\/wallettest$/, async (msg) => {
  const chatId = msg.chat.id;
  // Call a walletManager function to trigger initialization and CDP log
  // We'll use a dummy userId and dummy password/pin (no wallet will be created)
  try {
    await walletManager.createWallet('test_user', 'test_password', '1234');
    bot.sendMessage(chatId, '✅ /wallettest: wallet.ts was called. Check your server logs for the CDP console output.');
  } catch (err) {
    bot.sendMessage(chatId, '❌ /wallettest: Error calling wallet.ts. Check logs.');
  }
});

// Error handling, polling, etc. (existing code)

// Define utility functions
function getEthBalance(userId: string): Promise<any> {
  return walletManager.getWalletBalances(userId);
}

function getTokenBalance(userId: string, tokenAddress: string): Promise<any> {
  return walletManager.getTokenBalance(userId, tokenAddress);
}

function getTokenInfo(tokenAddress: string): Promise<any> {
  return discovery.isZoraCoin(tokenAddress);
}

function decryptData(data: string, password: string): any {
  // Implementation
  return { success: true, data: "" };
}

function encryptData(data: string, password: string): any {
  // Implementation
  return { success: true, encrypted: "" };
}

function formatEth(amount: string): string {
  return `${amount} ETH`;
}

function formatTokenAmount(amount: string, symbol: string): string {
  return `${amount} ${symbol}`;
}

function getWalletAddress(userId: string): string | null {
  return walletManager.getWalletAddress(userId);
}

// Export for external use
export {
  bot,
  users,
  getEthBalance,
  getTokenBalance,
  getTokenInfo,
  decryptData,
  encryptData,
  formatEth,
  formatTokenAmount,
  getWalletAddress
};
