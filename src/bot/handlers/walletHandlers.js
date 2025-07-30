/**
 * Wallet Handlers for Zoracle Telegram Bot
 */
const walletManager = require('../../services/wallet');
const { CONFIG } = require('../../config');

// Conversation states
const WALLET_STATES = {
  IMPORT_PRIVATE_KEY: 1,
  CREATE_PIN: 2,
  CONFIRM_PIN: 3,
  WALLET_MENU: 4
};

// In-memory PIN storage (should be temporary)
const tempPins = new Map();

module.exports = (bot, users) => {
  // Wallet command
  bot.onText(/\/wallet/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user already has a wallet
    const user = users.get(userId);
    
    if (user && user.wallet) {
      // User has a wallet, show wallet menu
      const walletAddress = user.wallet.address;
      const balanceResult = await walletManager.getWalletBalances(userId);
      const ethBalance = balanceResult.success ? balanceResult.balances.ETH : '0';
      
      const message = `
🔐 *Your Wallet*
Address: \`${walletAddress}\`
Balance: ${ethBalance} ETH

What would you like to do?
      `;
      
      const options = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'View Balance', callback_data: 'wallet_balance' }],
            [{ text: 'Lock Wallet', callback_data: 'wallet_lock' }],
            [{ text: '🔑 Export Private Key', callback_data: 'wallet_export' }]
          ]
        }
      };
      
      bot.sendMessage(chatId, message, options);
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
      bot.sendMessage(chatId, '🔐 *Create a New Wallet*\n\nPlease enter a strong password for your wallet:', {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true }
      });
      
      // Set state for password input
      tempPins.set(userId, { step: WALLET_STATES.CREATE_PIN });
      
      bot.answerCallbackQuery(callbackQuery.id);
    } else if (action === 'wallet_import') {
      // Ask for private key
      tempPins.set(userId, { step: WALLET_STATES.IMPORT_PRIVATE_KEY });
      
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
      
      const walletAddress = user.wallet.address;
      const balanceResult = await walletManager.getWalletBalances(userId);
      const ethBalance = balanceResult.success ? balanceResult.balances.ETH : '0';
      
      bot.sendMessage(chatId, `💰 *Wallet Balance*\nETH: ${ethBalance}`, { parse_mode: 'Markdown' });
      bot.answerCallbackQuery(callbackQuery.id);
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
    
    if (userState.step === WALLET_STATES.IMPORT_PRIVATE_KEY) {
      // Store private key and ask for password
      tempPins.set(userId, { privateKey: text, step: WALLET_STATES.CREATE_PIN });
      
      // Delete the message containing the private key for security
      bot.deleteMessage(chatId, msg.message_id).catch(e => console.log('Could not delete message with private key'));
      
      bot.sendMessage(chatId, '🔐 *Import Wallet*\n\nPlease enter a password to encrypt your wallet:', {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true }
      });
    
    } else if (userState.step === WALLET_STATES.CREATE_PIN) {
      // Store password and ask for PIN
      tempPins.set(userId, { ...userState, password: text, step: WALLET_STATES.CONFIRM_PIN });
      
      // Delete the message containing the password for security
      bot.deleteMessage(chatId, msg.message_id).catch(e => console.log('Could not delete message with password'));
      
      bot.sendMessage(chatId, '🔢 *Create PIN*\n\nEnter a 4-6 digit PIN for quick access:', {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true }
      });
    } else if (userState.step === WALLET_STATES.CONFIRM_PIN) {
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
      if (userState.privateKey) {
        // Import wallet
        result = await walletManager.importWallet(userId, userState.privateKey, userState.password, text);
      } else {
        // Create new wallet
        result = await walletManager.createWallet(userId, userState.password, text);
      }
      
      if (result.success) {
        bot.sendMessage(chatId, `✅ Wallet setup complete!\n\nAddress: \`${result.address}\`\n\nMake sure to keep your PIN and password safe. You'll need them for transactions.`, { parse_mode: 'Markdown' });
        
        // Show mnemonic if created new wallet
        if (result.mnemonic) {
          bot.sendMessage(chatId, '🔐 *IMPORTANT: Save Your Recovery Phrase*\n\n`' + result.mnemonic + '`\n\n⚠️ *NEVER share this with anyone!* Write it down and keep it in a safe place.', {
            parse_mode: 'Markdown'
          });
        }
      } else {
        bot.sendMessage(chatId, `❌ Error setting up wallet: ${result.message}`);
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
    
    const walletAddress = user.wallet.address;
    const balanceResult = await walletManager.getWalletBalances(userId);
    const ethBalance = balanceResult.success ? balanceResult.balances.ETH : '0';
    
    bot.sendMessage(chatId, `💰 *Wallet Balance*\nETH: ${ethBalance}`, { parse_mode: 'Markdown' });
  });
}; 