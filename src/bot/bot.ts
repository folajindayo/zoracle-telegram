// Main Bot File - Zoracle Telegram Bot
import TelegramBot from 'node-telegram-bot-api';
import { ethers } from 'ethers';
import axios from 'axios';
import * as fs from 'fs';

// Import handlers
import * as walletHandlers from './handlers/walletHandlers';
import * as portfolioHandlers from './handlers/portfolioHandlers';
import * as tradeHandlers from './handlers/tradeHandlers';

// Import utilities
import { escapeMarkdownPreserveFormat } from '../utils/telegramUtils';
import { getTranslation, getLanguageName, getAvailableLanguages } from '../utils/translations';

// Environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;

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
const conversationStates = new Map();

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

// Function to show main menu after successful login
async function showMainMenu(chatId: number): Promise<void> {
  try {
    const userId = chatId.toString();
    const menuTitle = await walletHandlers.getTranslatedMessage('main_menu_title', userId);
    const menuSubtitle = await walletHandlers.getTranslatedMessage('main_menu_subtitle', userId);
    
    const mainMenuOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Portfolio', callback_data: 'show_portfolio' }, { text: '🔄 Trade', callback_data: 'show_trade_options' }],
          [{ text: '🎯 Sniper', callback_data: 'sniper_new' }, { text: '💸 Transfer', callback_data: 'transfer' }],
          [{ text: '⏱️ Limit Orders', callback_data: 'limit_new' }, { text: '👥 Copy Trading', callback_data: 'show_copy_trading' }],
          [{ text: '📊 History', callback_data: 'show_transactions' }, { text: '🔔 Alerts', callback_data: 'show_alerts' }],
          [{ text: '🎨 PnL Cards', callback_data: 'show_pnl_cards' }, { text: '🔍 Discover', callback_data: 'show_discover' }],
          [{ text: '⚙️ Settings', callback_data: 'show_settings' }, { text: '🎁 Referrals', callback_data: 'show_referrals' }]
        ]
      },
      parse_mode: 'HTML' as const
    };
    
    bot.sendMessage(chatId, `${menuTitle}\n\n${menuSubtitle}`, mainMenuOptions);
  } catch (error) {
    console.error('Error showing main menu:', error);
    // Fallback to English
    const mainMenuOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Portfolio', callback_data: 'show_portfolio' }, { text: '🔄 Trade', callback_data: 'show_trade_options' }],
          [{ text: '🎯 Sniper', callback_data: 'sniper_new' }, { text: '💸 Transfer', callback_data: 'transfer' }],
          [{ text: '⏱️ Limit Orders', callback_data: 'limit_new' }, { text: '👥 Copy Trading', callback_data: 'show_copy_trading' }],
          [{ text: '📊 History', callback_data: 'show_transactions' }, { text: '🔔 Alerts', callback_data: 'show_alerts' }],
          [{ text: '🎨 PnL Cards', callback_data: 'show_pnl_cards' }, { text: '🔍 Discover', callback_data: 'show_discover' }],
          [{ text: '⚙️ Settings', callback_data: 'show_settings' }, { text: '🎁 Referrals', callback_data: 'show_referrals' }]
        ]
      },
      parse_mode: 'HTML' as const
    };
    
    bot.sendMessage(chatId, '🏠 <b>Main Menu</b>\n\nWhat would you like to do today?', mainMenuOptions);
  }
}

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
      conversationStates.set(chatId, walletHandlers.STATES.WELCOME);
      
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
    const walletManager = await import('../services/cdpWallet');
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
      
      const welcomeMsg = await walletHandlers.getWelcomeMessage(userId);
      bot.sendMessage(
        chatId, 
        welcomeMsg + `<code>${chatId}</code>\n\nYou have an existing wallet. Please unlock it to continue.`, 
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
      
      const welcomeMsg = await walletHandlers.getWelcomeMessage(userId);
      bot.sendMessage(
        chatId, 
        welcomeMsg + `<code>${chatId}</code>\n\nLet's get started by setting up your wallet:`, 
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
    // Wallet handlers
    case 'wallet_create':
      await walletHandlers.handleWalletCreate(bot, chatId, conversationStates, users);
      break;
      
    case 'wallet_import':
      await walletHandlers.handleWalletImport(bot, chatId);
      break;
      
    case 'import_privatekey':
      await walletHandlers.handleImportPrivateKey(bot, chatId, conversationStates);
      break;
      
    case 'import_seed':
      await walletHandlers.handleImportSeed(bot, chatId, conversationStates);
      break;
      
    case 'wallet_unlock':
      await walletHandlers.handleWalletUnlock(bot, chatId, conversationStates);
      break;
      
    case 'wallet_quick_unlock':
      await walletHandlers.handleWalletQuickUnlock(bot, chatId, conversationStates);
      break;
      
    case 'enable_2fa':
      await walletHandlers.handleEnable2FA(bot, chatId, conversationStates);
      break;
      
    case 'skip_2fa':
      await walletHandlers.handleSkip2FA(bot, chatId, conversationStates, showMainMenu);
      break;
      
    case 'back_to_start':
      await walletHandlers.handleBackToStart(bot, chatId);
      break;
      
    case 'show_help':
      bot.sendMessage(chatId, escapeMarkdownPreserveFormat(helpMessage), { parse_mode: 'MarkdownV2' as const });
      break;
      
    // Portfolio handlers
    case 'show_portfolio':
      await portfolioHandlers.handleShowPortfolio(bot, chatId, users);
      break;
      
    case 'show_transactions':
      await portfolioHandlers.handleShowTransactions(bot, chatId, callbackQuery);
      break;
      
    case 'refresh_history':
      await portfolioHandlers.handleRefreshHistory(bot, chatId, callbackQuery);
      break;
      
    // Trade handlers
    case 'show_trade_options':
      await tradeHandlers.handleShowTradeOptions(bot, chatId, callbackQuery);
      break;
      
    case 'trade_buy':
      await tradeHandlers.handleTradeBuy(bot, chatId, conversationStates);
      break;
      
    case 'trade_swap':
      await tradeHandlers.handleTradeSwap(bot, chatId, users);
      break;
      
    case 'trade_sell':
      await tradeHandlers.handleTradeSell(bot, chatId, users);
      break;
      
    case 'cancel_trade':
      await tradeHandlers.handleCancelTrade(bot, chatId, conversationStates);
      break;
      
    // Swap handlers
    case (data.match(/^swap_from_/) ? data : null):
      await tradeHandlers.handleSwapFrom(bot, chatId, data, users);
      break;
      
    case 'swap_to_custom':
      await tradeHandlers.handleSwapToCustom(bot, chatId, users, conversationStates);
      break;
      
    case (data.match(/^swap_to_/) ? data : null):
      await tradeHandlers.handleSwapTo(bot, chatId, data, users, conversationStates);
      break;
      
    // Main menu
    case 'back_to_main':
      await showMainMenu(chatId);
      break;
      
    // Add more cases for other buttons as needed
    default:
      console.log(`Unhandled callback data: ${data}`);
      break;
  }
});

// Handle text messages for conversation states
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text;
  
  if (!text) return;
  
  const state = conversationStates.get(chatId);
  if (!state) return;
  
  // Handle different conversation states
  switch (state) {
    case walletHandlers.STATES.WALLET_SETUP:
      // Handle wallet creation password input
      try {
        const walletManager = await import('../services/cdpWallet');
        const result = await walletManager.createWallet(userId, text, '1234'); // Default PIN
        
        if (result.success) {
          bot.sendMessage(chatId, '✅ <b>Wallet created successfully!</b>\n\nYour wallet has been created and encrypted. You can now use the bot features.', {
            parse_mode: 'HTML' as const
          });
          conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
          await showMainMenu(chatId);
        } else {
          bot.sendMessage(chatId, `❌ Failed to create wallet: ${result.message}`);
        }
      } catch (error) {
        console.error('Error creating wallet:', error);
        bot.sendMessage(chatId, `❌ Error creating wallet: ${error.message}`);
      }
      break;
      
    case 'AWAITING_PRIVATEKEY':
      // Handle private key import
      try {
        const walletManager = await import('../services/cdpWallet');
        const result = await walletManager.importWallet(userId, text, text, '1234'); // Using text as both private key and password
        
        if (result.success) {
          bot.sendMessage(chatId, '✅ <b>Wallet imported successfully!</b>\n\nYour wallet has been imported and is ready to use.', {
            parse_mode: 'HTML' as const
          });
          conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
          await showMainMenu(chatId);
        } else {
          bot.sendMessage(chatId, `❌ Failed to import wallet: ${result.message}`);
        }
      } catch (error) {
        console.error('Error importing wallet:', error);
        bot.sendMessage(chatId, `❌ Error importing wallet: ${error.message}`);
      }
      break;
      
    case 'AWAITING_SEED':
      // Handle seed phrase import
      try {
        const walletManager = await import('../services/cdpWallet');
        const result = await walletManager.importWalletFromMnemonic(userId, text, text, '1234'); // Using text as both mnemonic and password
        
        if (result.success) {
          bot.sendMessage(chatId, '✅ <b>Wallet imported successfully!</b>\n\nYour wallet has been imported and is ready to use.', {
            parse_mode: 'HTML' as const
          });
          conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
          await showMainMenu(chatId);
        } else {
          bot.sendMessage(chatId, `❌ Failed to import wallet: ${result.message}`);
        }
      } catch (error) {
        console.error('Error importing wallet:', error);
        bot.sendMessage(chatId, `❌ Error importing wallet: ${error.message}`);
      }
      break;
      
    case 'AWAITING_PASSWORD':
      // Handle wallet unlock with password
      try {
        const walletManager = await import('../services/cdpWallet');
        const result = await walletManager.loadWallet(userId, text);
        
        if (result.success) {
          bot.sendMessage(chatId, '✅ <b>Wallet unlocked successfully!</b>\n\nYour wallet is now unlocked and ready to use.', {
            parse_mode: 'HTML' as const
          });
          conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
          await showMainMenu(chatId);
        } else {
          bot.sendMessage(chatId, `❌ Failed to unlock wallet: ${result.message}`);
        }
      } catch (error) {
        console.error('Error unlocking wallet:', error);
        bot.sendMessage(chatId, `❌ Error unlocking wallet: ${error.message}`);
      }
      break;
      
    case 'AWAITING_PIN':
      // Handle wallet unlock with PIN
      try {
        const walletManager = await import('../services/cdpWallet');
        const result = await walletManager.quickUnlockWallet(userId, text);
        
        if (result.success) {
          // Store PIN for future use
          const userData = users.get(userId) || {};
          userData.pin = text;
          users.set(userId, userData);
          
          bot.sendMessage(chatId, '✅ <b>Wallet unlocked successfully!</b>\n\nYour wallet is now unlocked and ready to use.', {
            parse_mode: 'HTML' as const
          });
          conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
          await showMainMenu(chatId);
        } else {
          bot.sendMessage(chatId, `❌ Failed to unlock wallet: ${result.message}`);
        }
      } catch (error) {
        console.error('Error unlocking wallet:', error);
        bot.sendMessage(chatId, `❌ Error unlocking wallet: ${error.message}`);
      }
      break;
      
    case 'AWAITING_2FA_TOKEN':
      // Handle 2FA token verification
      try {
        const walletManager = await import('../services/cdpWallet');
        const result = await walletManager.enable2FA(userId, text);
        
        if (result.success) {
          bot.sendMessage(chatId, '✅ <b>2FA verified successfully!</b>\n\nYour wallet is now secured with 2FA.', {
            parse_mode: 'HTML' as const
          });
          conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
          await showMainMenu(chatId);
        } else {
          bot.sendMessage(chatId, `❌ Failed to verify 2FA: ${result.message}`);
        }
      } catch (error) {
        console.error('Error verifying 2FA:', error);
        bot.sendMessage(chatId, `❌ Error verifying 2FA: ${error.message}`);
      }
      break;
      
    // Add more conversation state handlers as needed
    default:
      console.log(`Unhandled conversation state: ${state}`);
      break;
  }
});

// Export the bot instance and helper functions
export { bot, showMainMenu, users, conversationStates };
export default bot; 