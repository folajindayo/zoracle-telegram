/**
 * Wallet Handlers for Zoracle Telegram Bot
 */
const { createWallet, importWallet, getEthBalance, getTokenBalance, encryptData, decryptData } = require('../baseBot');
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
      const ethBalance = await getEthBalance(walletAddress);
      
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
      // Create a new wallet
      const wallet = createWallet();
      
      // Store temporarily and ask for PIN
      tempPins.set(userId, { wallet, step: WALLET_STATES.CREATE_PIN });
      
      bot.sendMessage(chatId, 'Please create a PIN to secure your wallet (6 digits):');
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
      const ethBalance = await getEthBalance(walletAddress);
      
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
      // Try to import the wallet
      try {
        const wallet = importWallet(text);
        
        // Store temporarily and ask for PIN
        tempPins.set(userId, { wallet, step: WALLET_STATES.CREATE_PIN });
        
        bot.sendMessage(chatId, 'Please create a PIN to secure your wallet (6 digits):');
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error importing wallet: ${error.message}`);
        tempPins.delete(userId);
      }
    } else if (userState.step === WALLET_STATES.CREATE_PIN) {
      // Validate PIN format (6 digits)
      if (!/^\d{6}$/.test(text)) {
        bot.sendMessage(chatId, '❌ PIN must be 6 digits. Please try again:');
        return;
      }
      
      // Store PIN and ask for confirmation
      tempPins.set(userId, { ...userState, pin: text, step: WALLET_STATES.CONFIRM_PIN });
      bot.sendMessage(chatId, 'Please confirm your PIN:');
    } else if (userState.step === WALLET_STATES.CONFIRM_PIN) {
      // Check if PINs match
      if (text !== userState.pin) {
        bot.sendMessage(chatId, '❌ PINs do not match. Please start over with /wallet');
        tempPins.delete(userId);
        return;
      }
      
      // Encrypt private key with PIN
      const encryptedKey = encryptData(userState.wallet.privateKey);
      
      // Store wallet in users map
      users.set(userId, {
        wallet: {
          address: userState.wallet.address,
          encryptedKey
        },
        pin: userState.pin
      });
      
      bot.sendMessage(chatId, `✅ Wallet setup complete!\n\nAddress: \`${userState.wallet.address}\`\n\nMake sure to keep your PIN safe. You'll need it for transactions.`, { parse_mode: 'Markdown' });
      tempPins.delete(userId);
    } else if (userState.step === 'export_key') {
      // Verify PIN
      const user = users.get(userId);
      
      if (!user || text !== user.pin) {
        bot.sendMessage(chatId, '❌ Incorrect PIN. Please try again with /wallet');
        tempPins.delete(userId);
        return;
      }
      
      // Decrypt private key
      const privateKey = decryptData(user.wallet.encryptedKey);
      
      // Send private key as a private message
      bot.sendMessage(chatId, `🔑 *Your Private Key*\n\n\`${privateKey}\`\n\n⚠️ *NEVER share this with anyone!*`, { parse_mode: 'Markdown' });
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
    const ethBalance = await getEthBalance(walletAddress);
    
    bot.sendMessage(chatId, `💰 *Wallet Balance*\nETH: ${ethBalance}`, { parse_mode: 'Markdown' });
  });
}; 