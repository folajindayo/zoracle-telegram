/**
 * Copy-Trade Handlers for Zoracle Telegram Bot
 */
import { ethers  } from 'ethers';
import { getEthBalance, decryptData  } from '../baseBot';
import { CONFIG  } from '../../config';
import * as copyTradeService from '../../services/copytrade';
import { CopyTradeOps, UserOps  } from '../../database/operations';

// Copy-trade states for conversation
const COPYTRADE_STATES = {
  AWAITING_WALLET: 1,
  AWAITING_SLIPPAGE: 2,
  AWAITING_MAX_ETH: 3,
  AWAITING_SANDBOX: 4,
  AWAITING_PIN: 5
};

// In-memory copy-trade state storage
const copyTradeStates = new Map();

module.exports = (bot, users) => {
  // Set up event listeners for copy trade notifications
  const copyTradeEvents = copyTradeService.getEventEmitter();
  
  // Listen for simulated trades
  copyTradeEvents.on('mirror_trade_simulated', async (data) => {
    const { telegramId, type, tokenAddress, ethAmount, tokenAmount, estimatedEth } = data;
    
    // Get user from database
    const user = await UserOps.getUser(telegramId);
    if (!user) return;
    
    // Send notification to user
    if (type === 'buy') {
      bot.sendMessage(telegramId, 
        '🔄 [SANDBOX] Mirrored buy transaction\n\n' +
        `Token: ${tokenAddress}\n` +
        `Amount: ${ethAmount} ETH\n\n` +
        'This is a simulated trade (sandbox mode).'
      );
    } else if (type === 'sell') {
      bot.sendMessage(telegramId, 
        '🔄 [SANDBOX] Mirrored sell transaction\n\n' +
        `Token: ${tokenAddress}\n` +
        `Amount: ${tokenAmount} tokens\n` +
        `Estimated value: ${estimatedEth} ETH\n\n` +
        'This is a simulated trade (sandbox mode).'
      );
    }
  });
  
  // Listen for executed trades
  copyTradeEvents.on('mirror_trade_executed', async (data) => {
    const { telegramId, type, tokenAddress, ethAmount, tokenAmount, txHash } = data;
    
    // Get user from database
    const user = await UserOps.getUser(telegramId);
    if (!user) return;
    
    // Send notification to user
    if (type === 'buy') {
      bot.sendMessage(telegramId, 
        '✅ Mirrored buy transaction\n\n' +
        `Token: ${tokenAddress}\n` +
        `Amount: ${ethAmount} ETH\n` +
        `Tokens received: ${tokenAmount}\n\n` +
        `Transaction: ${txHash}`
      );
    } else if (type === 'sell') {
      bot.sendMessage(telegramId, 
        '✅ Mirrored sell transaction\n\n' +
        `Token: ${tokenAddress}\n` +
        `Amount: ${tokenAmount} tokens\n` +
        `ETH received: ${ethAmount} ETH\n\n` +
        `Transaction: ${txHash}`
      );
    }
  });

  // Mirror command
  bot.onText(/\/mirror/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Start copy-trade setup flow
    copyTradeStates.set(userId, { state: COPYTRADE_STATES.AWAITING_WALLET });
    
    bot.sendMessage(chatId, 'Please enter the wallet address you want to mirror trades from:');
  });
  
  // Mirror with wallet address
  bot.onText(/\/mirror (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const targetWallet = match[1].trim();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Validate wallet address
    if (!ethers.utils.isAddress(targetWallet)) {
      bot.sendMessage(chatId, '❌ Invalid wallet address. Please provide a valid Ethereum address.');
      return;
    }
    
    // Store copy-trade state
    copyTradeStates.set(userId, { 
      state: COPYTRADE_STATES.AWAITING_SLIPPAGE,
      targetWallet
    });
    
    bot.sendMessage(chatId, 'Please enter the maximum slippage percentage (1-10):');
  });
  
  // Mirrors command (list active mirrors)
  bot.onText(/\/mirrors/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    try {
      // Get user's copy-trades from database
      const userCopyTrades = await CopyTradeOps.getUserCopyTrades(userId);
      
      if (userCopyTrades.length === 0) {
        const options = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Add Mirror', callback_data: 'add_mirror' }]
            ]
          }
        };
        
        bot.sendMessage(chatId, 'You don\'t have any active mirrors. Use /mirror to set up a mirror.', options);
        return;
      }
      
      // Create message with all mirrors
      let message = '🔄 Your active mirrors:\n\n';
      
      for (let i = 0; i < userCopyTrades.length; i++) {
        const copyTrade = userCopyTrades[i];
        const status = copyTrade.active ? '✅ Active' : '⏸️ Paused';
        const mode = copyTrade.sandboxMode ? '🧪 Sandbox' : '🔴 Live';
        
        message += `${i + 1}. ${shortenAddress(copyTrade.targetWallet)}\n`;
        message += `   Status: ${status}\n`;
        message += `   Mode: ${mode}\n`;
        message += `   Max ETH per trade: ${copyTrade.maxEthPerTrade} ETH\n`;
        message += `   Slippage: ${copyTrade.slippage}%\n\n`;
      }
      
      // Add inline keyboard for actions
      const options = {
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
              { text: '🧪 Toggle Sandbox', callback_data: 'toggle_sandbox' }
            ]
          ]
        }
      };
      
      bot.sendMessage(chatId, message, options);
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error fetching your mirrors: ${error.message}`);
    }
  });
  
  // Handle copy-trade setup flow
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text;
    
    // Check if we're in a copy-trade setup flow
    const copyTradeState = copyTradeStates.get(userId);
    
    if (!copyTradeState) return;
    
    // Get user
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      copyTradeStates.delete(userId);
      return;
    }
    
    try {
      switch (copyTradeState.state) {
        case COPYTRADE_STATES.AWAITING_WALLET:
          // Validate wallet address
          if (!ethers.utils.isAddress(text)) {
            bot.sendMessage(chatId, '❌ Invalid wallet address. Please provide a valid Ethereum address.');
            return;
          }
          
          // Update state
          copyTradeStates.set(userId, {
            ...copyTradeState,
            state: COPYTRADE_STATES.AWAITING_SLIPPAGE,
            targetWallet: text
          });
          
          bot.sendMessage(chatId, 'Please enter the maximum slippage percentage (1-10):');
          break;
          
        case COPYTRADE_STATES.AWAITING_SLIPPAGE:
          // Validate slippage
          var slippage = parseFloat(text);
          
          if (isNaN(slippage) || slippage < 0.1 || slippage > 10) {
            bot.sendMessage(chatId, '❌ Invalid slippage. Please enter a number between 0.1 and 10.');
            return;
          }
          
          // Update state
          copyTradeStates.set(userId, {
            ...copyTradeState,
            state: COPYTRADE_STATES.AWAITING_MAX_ETH,
            slippage
          });
          
          bot.sendMessage(chatId, 'Please enter the maximum ETH per trade:');
          break;
          
        case COPYTRADE_STATES.AWAITING_MAX_ETH:
          // Validate max ETH
          var maxEthPerTrade = parseFloat(text);
          
          if (isNaN(maxEthPerTrade) || maxEthPerTrade <= 0) {
            bot.sendMessage(chatId, '❌ Invalid amount. Please enter a positive number.');
            return;
          }
          
          // Update state
          copyTradeStates.set(userId, {
            ...copyTradeState,
            state: COPYTRADE_STATES.AWAITING_SANDBOX,
            maxEthPerTrade
          });
          
          // Ask for sandbox mode
          var options = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🧪 Sandbox Mode (Simulated)', callback_data: 'sandbox_yes' },
                  { text: '🔴 Live Mode (Real)', callback_data: 'sandbox_no' }
                ]
              ]
            }
          };
          
          bot.sendMessage(chatId, 'Do you want to enable sandbox mode? In sandbox mode, trades will be simulated and no real transactions will be made.', options);
          break;
          
        case COPYTRADE_STATES.AWAITING_PIN:
          // Verify PIN
          if (text !== user.pin) {
            bot.sendMessage(chatId, '❌ Incorrect PIN. Copy-trade setup cancelled.');
            copyTradeStates.delete(userId);
            return;
          }
          
          // Create copy-trade in database
          try {
            await ((copyTradeService as any).addCopyTrade)(
              userId,
              copyTradeState.targetWallet,
              copyTradeState.maxEthPerTrade.toString(),
              copyTradeState.slippage,
              copyTradeState.sandboxMode
            );
            
            // Success message
            const modeText = copyTradeState.sandboxMode ? '🧪 Sandbox Mode (Simulated)' : '🔴 Live Mode (Real)';
            
            bot.sendMessage(chatId, 
              '✅ Copy-trade set up successfully!\n\n' +
              `Target wallet: ${shortenAddress(copyTradeState.targetWallet)}\n` +
              `Max ETH per trade: ${copyTradeState.maxEthPerTrade} ETH\n` +
              `Slippage: ${copyTradeState.slippage}%\n` +
              `Mode: ${modeText}\n\n` +
              'You will now automatically mirror trades from this wallet.'
            );
            
            // Clear state
            copyTradeStates.delete(userId);
          } catch (error) {
            bot.sendMessage(chatId, `❌ Error setting up copy-trade: ${error.message}`);
            copyTradeStates.delete(userId);
          }
          break;
      }
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      copyTradeStates.delete(userId);
    }
  });
  
  // Handle callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id.toString();
    const data = query.data;
    
    // Handle sandbox mode selection
    if (data === 'sandbox_yes' || data === 'sandbox_no') {
      // Get copy-trade state
      const copyTradeState = copyTradeStates.get(userId);
      
      if (!copyTradeState) {
        bot.answerCallbackQuery(query.id, { text: '❌ Copy-trade setup expired. Please start again.' });
        return;
      }
      
      // Update state
      const sandboxMode = data === 'sandbox_yes';
      
      copyTradeStates.set(userId, {
        ...copyTradeState,
        state: COPYTRADE_STATES.AWAITING_PIN,
        sandboxMode
      });
      
      // Acknowledge callback
      bot.answerCallbackQuery(query.id);
      
      // Ask for PIN confirmation
      bot.sendMessage(chatId, 'Please enter your PIN to confirm:');
      return;
    }
    
    // Handle mirror management actions
    if (data === 'add_mirror') {
      // Start mirror setup flow
      copyTradeStates.set(userId, { state: COPYTRADE_STATES.AWAITING_WALLET });
      
      // Acknowledge callback
      bot.answerCallbackQuery(query.id);
      
      // Ask for wallet address
      bot.sendMessage(chatId, 'Please enter the wallet address you want to mirror trades from:');
      return;
    }
    
    if (data === 'remove_mirror') {
      try {
        // Get user's copy-trades
        const userCopyTrades = await CopyTradeOps.getUserCopyTrades(userId);
        
        if (userCopyTrades.length === 0) {
          bot.answerCallbackQuery(query.id, { text: '❌ You don\'t have any mirrors to remove.' });
          return;
        }
        
        // Create inline keyboard with mirrors
        const inlineKeyboard = userCopyTrades.map((copyTrade, index) => {
          return [{ 
            text: `${index + 1}. ${shortenAddress(copyTrade.targetWallet)}`, 
            callback_data: `remove_mirror_${copyTrade.id}` 
          }];
        });
        
        // Add cancel button
        inlineKeyboard.push([{ text: '❌ Cancel', callback_data: 'cancel_mirror_action' }]);
        
        // Acknowledge callback
        bot.answerCallbackQuery(query.id);
        
        // Send message with mirrors to remove
        bot.sendMessage(chatId, 'Select a mirror to remove:', {
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
      } catch (error) {
        bot.answerCallbackQuery(query.id, { text: `❌ Error: ${error.message}` });
      }
      return;
    }
    
    // Handle remove mirror selection
    if (data.startsWith('remove_mirror_')) {
      try {
        const mirrorId = data.replace('remove_mirror_', '');
        
        // Delete copy-trade
        await ((copyTradeService as any).deleteCopyTrade)(mirrorId);
        
        // Acknowledge callback
        bot.answerCallbackQuery(query.id, { text: '✅ Mirror removed successfully!' });
        
        // Update mirrors message
        const userCopyTrades = await CopyTradeOps.getUserCopyTrades(userId);
        updateMirrorsMessage(bot, chatId, query.message.message_id, userId, userCopyTrades);
      } catch (error) {
        bot.answerCallbackQuery(query.id, { text: `❌ Error: ${error.message}` });
      }
      return;
    }
    
    // Handle pause/resume mirror
    if (data === 'pause_mirror' || data === 'resume_mirror') {
      try {
        const active = data === 'resume_mirror';
        const actionText = active ? 'resume' : 'pause';
        
        // Get user's copy-trades
        const userCopyTrades = await CopyTradeOps.getUserCopyTrades(userId);
        
        // Filter by current state
        const relevantCopyTrades = userCopyTrades.filter(ct => ct.active !== active);
        
        if (relevantCopyTrades.length === 0) {
          bot.answerCallbackQuery(query.id, { text: `❌ You don't have any mirrors to ${actionText}.` });
          return;
        }
        
        // Create inline keyboard with mirrors
        const inlineKeyboard = relevantCopyTrades.map((copyTrade, index) => {
          return [{ 
            text: `${index + 1}. ${shortenAddress(copyTrade.targetWallet)}`, 
            callback_data: `${actionText}_mirror_${copyTrade.id}` 
          }];
        });
        
        // Add cancel button
        inlineKeyboard.push([{ text: '❌ Cancel', callback_data: 'cancel_mirror_action' }]);
        
        // Acknowledge callback
        bot.answerCallbackQuery(query.id);
        
        // Send message with mirrors to pause/resume
        bot.sendMessage(chatId, `Select a mirror to ${actionText}:`, {
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
      } catch (error) {
        bot.answerCallbackQuery(query.id, { text: `❌ Error: ${error.message}` });
      }
      return;
    }
    
    // Handle pause/resume mirror selection
    if (data.startsWith('pause_mirror_') || data.startsWith('resume_mirror_')) {
      try {
        const active = data.startsWith('resume_mirror_');
        const actionText = active ? 'resumed' : 'paused';
        const mirrorId = data.replace(`${active ? 'resume' : 'pause'}_mirror_`, '');
        
        // Update copy-trade
        await ((copyTradeService as any).toggleCopyTradeActive)(mirrorId, active);
        
        // Acknowledge callback
        bot.answerCallbackQuery(query.id, { text: `✅ Mirror ${actionText} successfully!` });
        
        // Update mirrors message
        const userCopyTrades = await CopyTradeOps.getUserCopyTrades(userId);
        updateMirrorsMessage(bot, chatId, query.message.message_id, userId, userCopyTrades);
      } catch (error) {
        bot.answerCallbackQuery(query.id, { text: `❌ Error: ${error.message}` });
      }
      return;
    }
    
    // Handle toggle sandbox mode
    if (data === 'toggle_sandbox') {
      try {
        // Get user's copy-trades
        const userCopyTrades = await CopyTradeOps.getUserCopyTrades(userId);
        
        if (userCopyTrades.length === 0) {
          bot.answerCallbackQuery(query.id, { text: '❌ You don\'t have any mirrors to modify.' });
          return;
        }
        
        // Create inline keyboard with mirrors
        const inlineKeyboard = userCopyTrades.map((copyTrade, index) => {
          const mode = copyTrade.sandboxMode ? '🧪 Sandbox' : '🔴 Live';
          return [{ 
            text: `${index + 1}. ${shortenAddress(copyTrade.targetWallet)} (${mode})`, 
            callback_data: `toggle_sandbox_${copyTrade.id}` 
          }];
        });
        
        // Add cancel button
        inlineKeyboard.push([{ text: '❌ Cancel', callback_data: 'cancel_mirror_action' }]);
        
        // Acknowledge callback
        bot.answerCallbackQuery(query.id);
        
        // Send message with mirrors to toggle
        bot.sendMessage(chatId, 'Select a mirror to toggle sandbox mode:', {
          reply_markup: {
            inline_keyboard: inlineKeyboard
          }
        });
      } catch (error) {
        bot.answerCallbackQuery(query.id, { text: `❌ Error: ${error.message}` });
      }
      return;
    }
    
    // Handle toggle sandbox selection
    if (data.startsWith('toggle_sandbox_')) {
      try {
        const mirrorId = data.replace('toggle_sandbox_', '');
        
        // Get current copy-trade
        const copyTrade = await CopyTradeOps.getCopyTrade(mirrorId);
        
        if (!copyTrade) {
          bot.answerCallbackQuery(query.id, { text: '❌ Mirror not found.' });
          return;
        }
        
        // Toggle sandbox mode
        const newSandboxMode = !copyTrade.sandboxMode;
        await ((copyTradeService as any).updateCopyTrade)(mirrorId, { sandboxMode: newSandboxMode });
        
        // Acknowledge callback
        const modeText = newSandboxMode ? '🧪 Sandbox' : '🔴 Live';
        bot.answerCallbackQuery(query.id, { text: `✅ Mirror set to ${modeText} mode!` });
        
        // Update mirrors message
        const userCopyTrades = await CopyTradeOps.getUserCopyTrades(userId);
        updateMirrorsMessage(bot, chatId, query.message.message_id, userId, userCopyTrades);
      } catch (error) {
        bot.answerCallbackQuery(query.id, { text: `❌ Error: ${error.message}` });
      }
      return;
    }
    
    // Handle cancel action
    if (data === 'cancel_mirror_action') {
      // Acknowledge callback
      bot.answerCallbackQuery(query.id, { text: '❌ Action cancelled.' });
      
      // Delete the message
      bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      return;
    }
  });
};

/**
 * Helper function to shorten an Ethereum address
 * @param {string} address - Ethereum address
 * @returns {string} - Shortened address
 */
function shortenAddress(address): any {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Update mirrors message
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID
 * @param {string} userId - User ID
 * @param {Array} userCopyTrades - User's copy-trades
 */
async function updateMirrorsMessage(bot, chatId, messageId, userId, userCopyTrades): Promise<any> {
  try {
    if (userCopyTrades.length === 0) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add Mirror', callback_data: 'add_mirror' }]
          ]
        }
      };
      
      await bot.editMessageText('You don\'t have any active mirrors. Use /mirror to set up a mirror.', {
        chat_id: chatId,
        message_id: messageId,
        ...options
      });
      return;
    }
    
    // Create message with all mirrors
    let message = '🔄 Your active mirrors:\n\n';
    
    for (let i = 0; i < userCopyTrades.length; i++) {
      const copyTrade = userCopyTrades[i];
      const status = copyTrade.active ? '✅ Active' : '⏸️ Paused';
      const mode = copyTrade.sandboxMode ? '🧪 Sandbox' : '🔴 Live';
      
      message += `${i + 1}. ${shortenAddress(copyTrade.targetWallet)}\n`;
      message += `   Status: ${status}\n`;
      message += `   Mode: ${mode}\n`;
      message += `   Max ETH per trade: ${copyTrade.maxEthPerTrade} ETH\n`;
      message += `   Slippage: ${copyTrade.slippage}%\n\n`;
    }
    
    // Add inline keyboard for actions
    const options = {
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
            { text: '🧪 Toggle Sandbox', callback_data: 'toggle_sandbox' }
          ]
        ]
      }
    };
    
    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      ...options
    });
  } catch (error) {
    console.error(`Error updating mirrors message: ${error.message}`);
  }
} 