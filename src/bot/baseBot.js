// Base Chain Telegram Bot - Enhanced with all features
const TelegramBot = require('node-telegram-bot-api');
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
let bot = new TelegramBot(token, {
  polling: {
    interval: 300,
    autoStart: false, // Don't start polling yet
    params: {
      timeout: 10,
      allowed_updates: ["message", "callback_query", "inline_query"]
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
      
      // Show wallet options with buttons
      const walletOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔑 Create New Wallet', callback_data: 'wallet_create' }],
            [{ text: '📥 Import Existing Wallet', callback_data: 'wallet_import' }]
          ]
        },
        parse_mode: 'Markdown'
      };
      
      bot.sendMessage(
        chatId, 
        '✅ *Wallet connected!*\n\nWhat would you like to do?', 
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
        parse_mode: 'Markdown'
      };
      
      bot.sendMessage(
        chatId, 
        welcomeMessage + `\`${chatId}\`\n\nYou have an existing wallet. Please unlock it to continue.`, 
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
        parse_mode: 'Markdown'
      };
      
      bot.sendMessage(
        chatId, 
        welcomeMessage + `\`${chatId}\`\n\nLet's get started by setting up your wallet:`, 
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
      
      bot.sendMessage(chatId, '🔐 *Create a New Wallet*\n\nPlease enter a strong password for your new wallet:', {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'wallet_import':
      // Show import options
      bot.sendMessage(chatId, '📥 *Import Wallet*\n\nPlease select import method:', {
        parse_mode: 'Markdown',
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
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'import_seed':
      conversationStates.set(chatId, 'AWAITING_SEED');
      bot.sendMessage(chatId, '🔤 *Import with Seed Phrase*\n\nPlease enter your 12 or 24-word seed phrase:\n\n⚠️ _Never share your seed phrase with anyone else!_', {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'wallet_unlock':
      conversationStates.set(chatId, 'AWAITING_PASSWORD');
      bot.sendMessage(chatId, '🔓 *Unlock Wallet*\n\nPlease enter your wallet password:', {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'wallet_quick_unlock':
      conversationStates.set(chatId, 'AWAITING_PIN');
      bot.sendMessage(chatId, '🔐 *Quick Unlock*\n\nPlease enter your PIN:', {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true
        }
      });
      break;
      
    case 'show_help':
      bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
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
        parse_mode: 'Markdown'
      };
      
      bot.sendMessage(chatId, 'What would you like to do?', setupOptions);
      break;
      
    case 'enable_2fa':
      var qr = await walletManager.get2FAQRCode(chatId.toString());
      if (qr.success) {
        bot.sendPhoto(chatId, Buffer.from(qr.qrCode.split(',')[1], 'base64'), {
          caption: '📱 *2FA Setup*\n\nScan this QR code with your authenticator app (Google Authenticator, Authy, etc.).\n\nThen enter the 6-digit code to verify:',
          parse_mode: 'Markdown'
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
function showMainMenu(chatId) {
  const mainMenuOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 Portfolio', callback_data: 'show_portfolio' }, { text: '🔄 Trade', callback_data: 'show_trade_options' }],
        [{ text: '🔍 Discover', callback_data: 'show_discover' }, { text: '⚙️ Settings', callback_data: 'show_settings' }],
        [{ text: '🔔 Alerts', callback_data: 'show_alerts' }, { text: '👥 Copy Trading', callback_data: 'show_copy_trading' }]
      ]
    },
    parse_mode: 'Markdown'
  };
  
  bot.sendMessage(chatId, '🏠 *Main Menu*\n\nWhat would you like to do today?', mainMenuOptions);
}

// Add handlers for main menu buttons
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  
  // Handle portfolio and trading actions
  if (action === 'show_portfolio') {
    try {
      const portfolioData = await portfolio.getPortfolio(chatId.toString());
      
      if (portfolioData.success) {
        let portfolioText = '💰 *Your Portfolio*\n\n';
        portfolioText += `Total Value: ${portfolioData.totalUSD ? '$' + portfolioData.totalUSD.toFixed(2) : 'N/A'}\n\n`;
        
        if (portfolioData.balances && portfolioData.balances.ETH) {
          portfolioText += `ETH: ${portfolioData.balances.ETH}\n`;
        }
        
        if (portfolioData.tokens && portfolioData.tokens.length > 0) {
          portfolioText += '\n*Tokens:*\n';
          portfolioData.tokens.forEach(token => {
            portfolioText += `${token.symbol}: ${token.balance} ($${token.valueUSD ? token.valueUSD.toFixed(2) : 'N/A'})\n`;
          });
        } else {
          portfolioText += '\nNo tokens found in your portfolio.';
        }
        
        const portfolioOptions = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Transaction History', callback_data: 'show_transactions' }],
              [{ text: '🔄 Refresh Portfolio', callback_data: 'refresh_portfolio' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          },
          parse_mode: 'Markdown'
        };
        
        bot.sendMessage(chatId, portfolioText, portfolioOptions);
      } else {
        bot.sendMessage(chatId, '❌ Failed to load portfolio: ' + portfolioData.message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error displaying portfolio:', error);
      bot.sendMessage(chatId, '❌ An error occurred while loading your portfolio.');
    }
  } 
  else if (action === 'show_trade_options') {
    const tradeOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💵 Buy Tokens', callback_data: 'trade_buy' }],
          [{ text: '💸 Sell Tokens', callback_data: 'trade_sell' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      },
      parse_mode: 'Markdown'
    };
    
    bot.sendMessage(chatId, '🔄 *Trading*\n\nWhat would you like to do?', tradeOptions);
  }
  else if (action === 'trade_buy') {
    conversationStates.set(chatId, 'AWAITING_BUY_TOKEN');
    bot.sendMessage(chatId, '💵 *Buy Tokens*\n\nPlease enter the token address you want to buy:', {
      parse_mode: 'Markdown',
      reply_markup: {
        force_reply: true
      }
    });
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
          parse_mode: 'Markdown',
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
      parse_mode: 'Markdown'
    };
    
    bot.sendMessage(chatId, '🔍 *Discover*\n\nExplore Zora content coins:', discoverOptions);
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
          parse_mode: 'Markdown',
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
  else if (action === 'back_to_main') {
    showMainMenu(chatId);
  }
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
  var pin, result, password, unlockResult, quickPin, quickUnlockResult, 
      setupToken, enable2FAResult, unlockToken, twoFAUnlockResult;
  
  // Handle different states
  switch (state) {
    case STATES.WALLET_SETUP:
      // Password entered
      userData.tempPassword = msg.text.trim();
      conversationStates.set(chatId, STATES.PIN_SETUP);
      
      bot.sendMessage(chatId, '🔢 *Create PIN*\n\nEnter a 4-6 digit PIN for quick access:', {
        parse_mode: 'Markdown',
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
        bot.sendMessage(chatId, '🔐 *Wallet Setup Complete!*\n\nWould you like to enable Two-Factor Authentication (2FA) for extra security?', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Yes, Enable 2FA', callback_data: 'enable_2fa' }],
              [{ text: '⏭️ Skip for now', callback_data: 'skip_2fa' }]
            ]
          }
        });
        
        // Show wallet address
        if (result.address) {
          bot.sendMessage(chatId, `🏦 *Your Wallet Address:*\n\`${result.address}\``, {
            parse_mode: 'Markdown'
          });
        }
        
        // Show mnemonic if created new wallet
        if (result.mnemonic) {
          bot.sendMessage(chatId, '🔐 *IMPORTANT: Save Your Recovery Phrase*\n\n`' + result.mnemonic + '`\n\n⚠️ *Never share this with anyone!* Write it down and keep it in a safe place. You will need it to recover your wallet if you lose access.', {
            parse_mode: 'Markdown'
          });
        }
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + result.message, {
          parse_mode: 'Markdown',
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
      
      bot.sendMessage(chatId, '🔐 *Import Wallet*\n\nPlease enter a password to encrypt your wallet:', {
        parse_mode: 'Markdown',
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
      
      bot.sendMessage(chatId, '🔐 *Import Wallet*\n\nPlease enter a password to encrypt your wallet:', {
        parse_mode: 'Markdown',
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
        bot.sendMessage(chatId, '✅ *Wallet Unlocked Successfully!*', {
          parse_mode: 'Markdown'
        });
        
        // Show main menu
        showMainMenu(chatId);
      } else if (unlockResult.requireTwoFactor) {
        conversationStates.set(chatId, 'AWAITING_2FA_UNLOCK');
        userData.tempPassword = password;
        
        bot.sendMessage(chatId, '🔐 *2FA Required*\n\nPlease enter your 6-digit authentication code:', {
          parse_mode: 'Markdown',
          reply_markup: {
            force_reply: true
          }
        });
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + unlockResult.message, {
          parse_mode: 'Markdown',
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
        bot.sendMessage(chatId, '✅ *Wallet Unlocked Successfully!*', {
          parse_mode: 'Markdown'
        });
        
        // Show main menu
        showMainMenu(chatId);
      } else if (quickUnlockResult.requireTwoFactor) {
        conversationStates.set(chatId, 'AWAITING_2FA_QUICK_UNLOCK');
        userData.tempPin = quickPin;
        
        bot.sendMessage(chatId, '🔐 *2FA Required*\n\nPlease enter your 6-digit authentication code:', {
          parse_mode: 'Markdown',
          reply_markup: {
            force_reply: true
          }
        });
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + quickUnlockResult.message, {
          parse_mode: 'Markdown',
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
        bot.sendMessage(chatId, '✅ *2FA Enabled Successfully!*\n\n🔐 *Backup Codes:*\n' + 
          enable2FAResult.backupCodes.join('\n') + 
          '\n\n⚠️ Save these backup codes in a safe place. You can use them if you lose access to your authenticator app.', {
          parse_mode: 'Markdown'
        });
        
        // Show main menu
        conversationStates.set(chatId, STATES.COMPLETE);
        showMainMenu(chatId);
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + enable2FAResult.message, {
          parse_mode: 'Markdown',
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
        bot.sendMessage(chatId, '✅ *Wallet Unlocked Successfully!*', {
          parse_mode: 'Markdown'
        });
        
        // Show main menu
        showMainMenu(chatId);
      } else {
        bot.sendMessage(chatId, '❌ *Error:* ' + twoFAUnlockResult.message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'wallet_unlock' }]
            ]
          }
        });
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