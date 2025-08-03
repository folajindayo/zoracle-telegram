/**
 * Wallet Handlers for Zoracle Telegram Bot
 */
import * as walletManager from '../../services/cdpWallet';
import { CONFIG } from '../../config/index';
import TelegramBot from 'node-telegram-bot-api';
import { WALLET_STATES } from '../../types/index';
import { escapeMarkdown, escapeMarkdownPreserveFormat, markdownToHtml } from '../../utils/telegramUtils';
import { ethers } from 'ethers';
import { getTranslation, getLanguageName, getAvailableLanguages } from '../../utils/translations';

// Types
export interface UserData {
  walletAddress?: string;
  isCreating?: boolean;
  tempPK?: string;
  pin?: string;
  [key: string]: any;
}

export interface ConversationStates {
  WELCOME: number;
  WALLET_SETUP: number;
  PIN_SETUP: number;
  TWOFA_SETUP: number;
  COMPLETE: number;
}

export const STATES: ConversationStates = {
  WELCOME: 0,
  WALLET_SETUP: 1,
  PIN_SETUP: 2,
  TWOFA_SETUP: 3,
  COMPLETE: 4
};

// Conversation states
const WALLET_STATE_VALUES = {
  IMPORT_PRIVATE_KEY: 1,
  CREATE_PIN: 2,
  CONFIRM_PIN: 3,
  WALLET_MENU: 4
};

// In-memory PIN storage (should be temporary)
const tempPins = new Map<string, any>();

// Helper functions
export async function getUserLanguage(telegramId: string): Promise<string> {
  try {
    const { UserOps } = await import('../../database/operations');
    return await UserOps.getUserLanguage(telegramId);
  } catch (error) {
    console.error('Error getting user language:', error);
    return 'en'; // Default to English
  }
}

export async function getTranslatedMessage(key: string, telegramId: string): Promise<string> {
  const language = await getUserLanguage(telegramId);
  return getTranslation(key, language);
}

export async function getWelcomeMessage(telegramId: string): Promise<string> {
  const title = await getTranslatedMessage('welcome_title', telegramId);
  const description = await getTranslatedMessage('welcome_description', telegramId);
  const chatIdLabel = await getTranslatedMessage('chat_id_label', telegramId);
  
  return `${title}\n\n${description}\n\nTo get started, use /start your_wallet_address\n\n${chatIdLabel}`;
}

// Wallet handlers
export async function handleWalletCreate(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>,
  users: Map<string, UserData>
): Promise<void> {
  conversationStates.set(chatId, STATES.WALLET_SETUP);
  const userData = users.get(chatId.toString()) || {};
  userData.isCreating = true;
  delete userData.tempPK; // Clear any previous import data
  users.set(chatId.toString(), userData);
  
  bot.sendMessage(chatId, '🔐 <b>Create a New Wallet</b>\n\nPlease enter a strong password for your new wallet:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      force_reply: true
    }
  });
}

export async function handleWalletImport(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
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
}

export async function handleImportPrivateKey(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  conversationStates.set(chatId, 'AWAITING_PRIVATEKEY');
  bot.sendMessage(chatId, '🔑 *Import with Private Key*\n\nPlease enter your private key:\n\n⚠️ _Never share your private key with anyone else!_', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      force_reply: true
    }
  });
}

export async function handleImportSeed(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  conversationStates.set(chatId, 'AWAITING_SEED');
  bot.sendMessage(chatId, '🔤 *Import with Seed Phrase*\n\nPlease enter your 12 or 24-word seed phrase:\n\n⚠️ _Never share your seed phrase with anyone else!_', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      force_reply: true
    }
  });
}

export async function handleWalletUnlock(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  conversationStates.set(chatId, 'AWAITING_PASSWORD');
  bot.sendMessage(chatId, '🔓 *Unlock Wallet*\n\nPlease enter your wallet password:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      force_reply: true
    }
  });
}

export async function handleWalletQuickUnlock(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  conversationStates.set(chatId, 'AWAITING_PIN');
  bot.sendMessage(chatId, '🔐 *Quick Unlock*\n\nPlease enter your PIN:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      force_reply: true
    }
  });
}

export async function handleEnable2FA(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  try {
    const walletManager = await import('../../services/cdpWallet');
    const qr = await walletManager.get2FAQRCode(chatId.toString());
    
    if (qr.success) {
      bot.sendMessage(chatId, `📱 *2FA Setup*\n\nScan this QR code with your authenticator app:\n\n${qr.qrCode}\n\nThen enter the 6-digit code to verify:`, {
        parse_mode: 'Markdown' as const
      });
      conversationStates.set(chatId, 'AWAITING_2FA_TOKEN');
    } else {
      bot.sendMessage(chatId, '❌ Failed to generate 2FA QR code: ' + qr.message);
    }
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    bot.sendMessage(chatId, '❌ Error setting up 2FA. Please try again.');
  }
}

export async function handleSkip2FA(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>,
  showMainMenu: (chatId: number) => Promise<void>
): Promise<void> {
  conversationStates.set(chatId, STATES.COMPLETE);
  await showMainMenu(chatId);
}

export async function handleBackToStart(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
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
  
  bot.sendMessage(chatId, 'What would you like to do?', setupOptions);
}

export default function initWalletHandlers(bot: TelegramBot, users: Map<string, any>): void {
  // Wallet command
  bot.onText(/\/wallet/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user already has a wallet
    const user = users.get(userId);
    
    if (user && user.wallet) {
      // User has a wallet, show wallet menu
      const walletAddress = user.wallet.address;
      
      try {
        const balanceResult = await walletManager.getWalletBalances(userId);
        const ethBalance = balanceResult.success ? balanceResult.balances.ETH : '0';
        
        const message = `
🔐 <b>Your Wallet</b>
Address: <code>${walletAddress}</code>
Balance: ${ethBalance} ETH

What would you like to do?
        `;
        
        const options = {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'View Balance', callback_data: 'wallet_balance' }],
              [{ text: 'Lock Wallet', callback_data: 'wallet_lock' }],
              [{ text: '🔑 Export Private Key', callback_data: 'wallet_export' }]
            ]
          }
        };
        
        bot.sendMessage(chatId, message, options);
      } catch (error) {
        console.error('Error getting wallet balance:', error);
        bot.sendMessage(chatId, '❌ Error getting wallet balance. Please try again later.');
      }
    } else {
      // User doesn't have a wallet, show options to create or import
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔑 Create New Wallet', callback_data: 'wallet_create' }],
            [{ text: '📥 Import Existing Wallet', callback_data: 'wallet_import' }]
          ]
        }
      };
      
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Would you like to create a new wallet or import an existing one?', options);
    }
  });
  
  // Wallet button handler
  bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();
    
    if (action === 'wallet_create') {
      // Prompt for password first
      bot.sendMessage(chatId, '🔐 <b>Create a New Wallet</b>\n\nPlease enter a strong password for your wallet:', {
        parse_mode: 'HTML' as const,
        reply_markup: { force_reply: true }
      });
      
      // Set state for password input
      tempPins.set(userId, { step: WALLET_STATE_VALUES.CREATE_PIN });
      
      bot.answerCallbackQuery(callbackQuery.id);
    } else if (action === 'wallet_import') {
      // Ask for private key
      tempPins.set(userId, { step: WALLET_STATE_VALUES.IMPORT_PRIVATE_KEY });
      
      bot.sendMessage(chatId, 'Please enter your private key:');
      bot.answerCallbackQuery(callbackQuery.id);
    } else if (action === 'wallet_balance') {
      // Show wallet balance
      const user = users.get(userId);
      
      if (!user || !user.wallet) {
        bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
        bot.answerCallbackQuery(callbackQuery.id);
        return;
      }
      
      try {
        const walletAddress = user.wallet.address;
        const balanceResult = await walletManager.getWalletBalances(userId);
        const ethBalance = balanceResult.success ? balanceResult.balances.ETH : '0';
        
        // Format additional token balances if available
        let additionalBalances = '';
        if (balanceResult.success && balanceResult.balances) {
          Object.entries(balanceResult.balances).forEach(([token, amount]) => {
            if (token !== 'ETH') {
              additionalBalances += `\n${token}: ${amount}`;
            }
          });
        }
        
        bot.sendMessage(chatId, `💰 <b>Wallet Balance</b>\nETH: ${ethBalance}${additionalBalances}`, { parse_mode: 'HTML' as const });
        bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        console.error('Error getting wallet balance:', error);
        bot.sendMessage(chatId, '❌ Error getting wallet balance. Please try again later.');
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Error getting balance' });
      }
    } else if (action === 'wallet_lock') {
      // Lock wallet
      users.delete(userId);
      
      bot.sendMessage(chatId, '🔒 Your wallet has been locked. Use /wallet to unlock it.');
      bot.answerCallbackQuery(callbackQuery.id);
    } else if (action === 'wallet_export') {
      // Export private key (ask for PIN first)
      bot.sendMessage(chatId, 'Please enter your PIN to export your private key:');
      tempPins.set(userId, { step: 'export_key' });
      bot.answerCallbackQuery(callbackQuery.id);
    }
  });
  
  // Handle private key import
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text;
    
    // Check if we're waiting for a private key
    const userState = tempPins.get(userId);
    
    if (!userState) return;
    
    if (userState.step === WALLET_STATE_VALUES.IMPORT_PRIVATE_KEY) {
      // Store private key and ask for password
      tempPins.set(userId, { privateKey: text, step: WALLET_STATE_VALUES.CREATE_PIN });
      
      // Delete the message containing the private key for security
      bot.deleteMessage(chatId, msg.message_id).catch(e => console.log('Could not delete message with private key'));
      
      bot.sendMessage(chatId, '🔐 <b>Import Wallet</b>\n\nPlease enter a password to encrypt your wallet:', {
        parse_mode: 'HTML' as const,
        reply_markup: { force_reply: true }
      });
    
    } else if (userState.step === WALLET_STATE_VALUES.CREATE_PIN) {
      // Store password and ask for PIN
      tempPins.set(userId, { ...userState, password: text, step: WALLET_STATE_VALUES.CONFIRM_PIN });
      
      // Delete the message containing the password for security
      bot.deleteMessage(chatId, msg.message_id).catch(e => console.log('Could not delete message with password'));
      
      bot.sendMessage(chatId, '🔢 <b>Create PIN</b>\n\nEnter a 4-6 digit PIN for quick access:', {
        parse_mode: 'HTML' as const,
        reply_markup: { force_reply: true }
      });
    } else if (userState.step === WALLET_STATE_VALUES.CONFIRM_PIN) {
      // Validate PIN format (4-6 digits)
      if (!/^\d{4,6}$/.test(text)) {
        bot.sendMessage(chatId, '❌ PIN must be 4-6 digits. Please try again:', {
          reply_markup: { force_reply: true }
        });
        return;
      }
      
      // Store PIN
      tempPins.set(userId, { ...userState, pin: text });
      
      // Create or import wallet using wallet manager
      let result;
      try {
        if (userState.privateKey) {
          // Import wallet
          result = await walletManager.importWallet(userId, userState.privateKey, userState.password, text);
        } else {
          // Create new wallet
          result = await walletManager.createWallet(userId, userState.password, text);
        }
        
        if (result.success) {
          bot.sendMessage(chatId, `✅ Wallet setup complete!\n\nAddress: <code>${result.address}</code>\n\nMake sure to keep your PIN and password safe. You'll need them for transactions.`, { parse_mode: 'HTML' as const });
          
          // Show mnemonic if created new wallet
          if (result.mnemonic) {
            bot.sendMessage(chatId, `🔐 <b>IMPORTANT: Save Your Recovery Phrase</b>\n\n<code>${result.mnemonic}</code>\n\n⚠️ <b>NEVER share this with anyone!</b> Write it down and keep it in a safe place.`, {
              parse_mode: 'HTML' as const
            });
          }
        } else {
          bot.sendMessage(chatId, `❌ Error setting up wallet: ${result.message}`);
        }
      } catch (error) {
        console.error('Error in wallet creation:', error);
        bot.sendMessage(chatId, '❌ An error occurred while setting up your wallet. Please try again later.');
      }
      
      tempPins.delete(userId);
    } else if (userState.step === 'export_key') {
      // We need to implement a secure way to export private keys
      // For security reasons, we should require password verification
      
      bot.sendMessage(chatId, '⚠️ For security reasons, private key export is only available through a secure channel. Please use the wallet manager directly.');
      tempPins.delete(userId);
    }
  });
  
  // Balance command
  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    try {
      const walletAddress = user.wallet.address;
      const balanceResult = await walletManager.getWalletBalances(userId);
      const ethBalance = balanceResult.success ? balanceResult.balances.ETH : '0';
      
      // Format additional token balances if available
      let additionalBalances = '';
      if (balanceResult.success && balanceResult.balances) {
        Object.entries(balanceResult.balances).forEach(([token, amount]) => {
          if (token !== 'ETH') {
            additionalBalances += `\n${token}: ${amount}`;
          }
        });
      }
      
      bot.sendMessage(chatId, `💰 <b>Wallet Balance</b>\nETH: ${ethBalance}${additionalBalances}`, { parse_mode: 'HTML' as const });
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      bot.sendMessage(chatId, '❌ Error getting wallet balance. Please try again later.');
    }
  });
} 