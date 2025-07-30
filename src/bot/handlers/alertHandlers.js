/**
 * Alert Handlers for Zoracle Telegram Bot
 */
const { ethers } = require('ethers');
const { getTokenInfo } = require('../baseBot');
const { CONFIG } = require('../../config');

// In-memory alert storage (in a real implementation, this would be stored in a database)
const alerts = new Map();

// Alert states for conversation
const ALERT_STATES = {
  AWAITING_TOKEN: 1,
  AWAITING_PRICE_HIGH: 2,
  AWAITING_PRICE_LOW: 3
};

// In-memory alert state storage
const alertStates = new Map();

module.exports = (bot, users) => {
  // Alerts command
  bot.onText(/\/alerts/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Get user's alerts
    const userAlerts = alerts.get(userId) || [];
    
    if (userAlerts.length === 0) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Add Alert', callback_data: 'add_alert' }]
          ]
        }
      };
      
      bot.sendMessage(chatId, 'You don\'t have any alerts set up yet.', options);
      return;
    }
    
    // Build alerts message
    let message = '🔔 *Your Alerts*\n\n';
    
    for (let i = 0; i < userAlerts.length; i++) {
      const alert = userAlerts[i];
      message += `*${i + 1}. ${alert.tokenInfo.name} (${alert.tokenInfo.symbol})*\n`;
      
      if (alert.priceHigh) {
        message += `Price Above: ${alert.priceHigh} ETH\n`;
      }
      
      if (alert.priceLow) {
        message += `Price Below: ${alert.priceLow} ETH\n`;
      }
      
      message += '\n';
    }
    
    // Add inline keyboard buttons for managing alerts
    const inlineKeyboard = [
      [{ text: '➕ Add Alert', callback_data: 'add_alert' }]
    ];
    
    // Add a remove button for each alert
    for (let i = 0; i < userAlerts.length; i++) {
      inlineKeyboard.push([{ text: `❌ Remove Alert ${i + 1}`, callback_data: `remove_alert_${i}` }]);
    }
    
    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    };
    
    bot.sendMessage(chatId, message, options);
  });
  
  // Add alert command
  bot.onText(/\/addalert/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Start alert creation flow
    alertStates.set(userId, { state: ALERT_STATES.AWAITING_TOKEN });
    
    bot.sendMessage(chatId, 'Please enter the token address you want to set an alert for:');
  });
  
  // Add alert with token address
  bot.onText(/\/addalert (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const tokenAddress = match[1].trim();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Validate token address
    if (!ethers.utils.isAddress(tokenAddress)) {
      bot.sendMessage(chatId, '❌ Invalid token address. Please provide a valid Ethereum address.');
      return;
    }
    
    try {
      // Get token info
      const tokenInfo = await getTokenInfo(tokenAddress);
      
      // Store alert state
      alertStates.set(userId, { 
        state: ALERT_STATES.AWAITING_PRICE_HIGH,
        tokenAddress,
        tokenInfo
      });
      
      bot.sendMessage(chatId, `Setting up alert for ${tokenInfo.name} (${tokenInfo.symbol})\n\nPlease enter the price (in ETH) to alert when the token goes ABOVE this value (or type "skip" to skip):`);
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });
  
  // Handle alert button
  bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();
    
    if (action === 'add_alert') {
      // Start alert creation flow
      alertStates.set(userId, { state: ALERT_STATES.AWAITING_TOKEN });
      
      bot.sendMessage(chatId, 'Please enter the token address you want to set an alert for:');
      bot.answerCallbackQuery(callbackQuery.id);
    } else if (action.startsWith('remove_alert_')) {
      const alertIndex = parseInt(action.split('_')[2]);
      
      // Get user's alerts
      const userAlerts = alerts.get(userId) || [];
      
      if (alertIndex >= 0 && alertIndex < userAlerts.length) {
        // Remove the alert
        const removedAlert = userAlerts.splice(alertIndex, 1)[0];
        
        // Update alerts
        alerts.set(userId, userAlerts);
        
        bot.answerCallbackQuery(callbackQuery.id, { 
          text: `Alert for ${removedAlert.tokenInfo.symbol} removed!`,
          show_alert: true
        });
        
        // Update the message
        if (userAlerts.length === 0) {
          const options = {
            reply_markup: {
              inline_keyboard: [
                [{ text: '➕ Add Alert', callback_data: 'add_alert' }]
              ]
            }
          };
          
          bot.editMessageText('You don\'t have any alerts set up yet.', {
            chat_id: chatId,
            message_id: msg.message_id,
            ...options
          });
        } else {
          // Rebuild alerts message
          let message = '🔔 *Your Alerts*\n\n';
          
          for (let i = 0; i < userAlerts.length; i++) {
            const alert = userAlerts[i];
            message += `*${i + 1}. ${alert.tokenInfo.name} (${alert.tokenInfo.symbol})*\n`;
            
            if (alert.priceHigh) {
              message += `Price Above: ${alert.priceHigh} ETH\n`;
            }
            
            if (alert.priceLow) {
              message += `Price Below: ${alert.priceLow} ETH\n`;
            }
            
            message += '\n';
          }
          
          // Add inline keyboard buttons for managing alerts
          const inlineKeyboard = [
            [{ text: '➕ Add Alert', callback_data: 'add_alert' }]
          ];
          
          // Add a remove button for each alert
          for (let i = 0; i < userAlerts.length; i++) {
            inlineKeyboard.push([{ text: `❌ Remove Alert ${i + 1}`, callback_data: `remove_alert_${i}` }]);
          }
          
          const options = {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: inlineKeyboard
            }
          };
          
          bot.editMessageText(message, {
            chat_id: chatId,
            message_id: msg.message_id,
            ...options
          });
        }
      } else {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Alert not found.' });
      }
    }
  });
  
  // Handle alert creation flow
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text;
    
    // Check if we're in an alert creation flow
    const alertState = alertStates.get(userId);
    
    if (!alertState) return;
    
    if (alertState.state === ALERT_STATES.AWAITING_TOKEN) {
      // Validate token address
      if (!ethers.utils.isAddress(text)) {
        bot.sendMessage(chatId, '❌ Invalid token address. Please provide a valid Ethereum address.');
        return;
      }
      
      try {
        // Get token info
        const tokenInfo = await getTokenInfo(text);
        
        // Update alert state
        alertStates.set(userId, { 
          ...alertState,
          state: ALERT_STATES.AWAITING_PRICE_HIGH,
          tokenAddress: text,
          tokenInfo
        });
        
        bot.sendMessage(chatId, `Setting up alert for ${tokenInfo.name} (${tokenInfo.symbol})\n\nPlease enter the price (in ETH) to alert when the token goes ABOVE this value (or type "skip" to skip):`);
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
    } else if (alertState.state === ALERT_STATES.AWAITING_PRICE_HIGH) {
      let priceHigh = null;
      
      if (text.toLowerCase() !== 'skip') {
        // Parse price
        priceHigh = parseFloat(text);
        
        // Validate price
        if (isNaN(priceHigh) || priceHigh <= 0) {
          bot.sendMessage(chatId, '❌ Please enter a valid price or "skip".');
          return;
        }
      }
      
      // Update alert state
      alertStates.set(userId, { 
        ...alertState,
        state: ALERT_STATES.AWAITING_PRICE_LOW,
        priceHigh
      });
      
      bot.sendMessage(chatId, 'Please enter the price (in ETH) to alert when the token goes BELOW this value (or type "skip" to skip):');
    } else if (alertState.state === ALERT_STATES.AWAITING_PRICE_LOW) {
      let priceLow = null;
      
      if (text.toLowerCase() !== 'skip') {
        // Parse price
        priceLow = parseFloat(text);
        
        // Validate price
        if (isNaN(priceLow) || priceLow <= 0) {
          bot.sendMessage(chatId, '❌ Please enter a valid price or "skip".');
          return;
        }
      }
      
      // Validate that at least one price is set
      if (alertState.priceHigh === null && priceLow === null) {
        bot.sendMessage(chatId, '❌ You must set at least one price alert (high or low).');
        
        // Go back to price high
        alertStates.set(userId, { 
          ...alertState,
          state: ALERT_STATES.AWAITING_PRICE_HIGH
        });
        
        bot.sendMessage(chatId, 'Please enter the price (in ETH) to alert when the token goes ABOVE this value (or type "skip" to skip):');
        return;
      }
      
      // Create alert
      const alert = {
        tokenAddress: alertState.tokenAddress,
        tokenInfo: alertState.tokenInfo,
        priceHigh: alertState.priceHigh,
        priceLow,
        createdAt: Date.now()
      };
      
      // Get user's alerts
      const userAlerts = alerts.get(userId) || [];
      
      // Add alert
      userAlerts.push(alert);
      alerts.set(userId, userAlerts);
      
      // Clear alert state
      alertStates.delete(userId);
      
      // Build confirmation message
      let message = `✅ Alert created for ${alert.tokenInfo.name} (${alert.tokenInfo.symbol})!\n\n`;
      
      if (alert.priceHigh !== null) {
        message += `You will be notified when the price goes above ${alert.priceHigh} ETH.\n`;
      }
      
      if (alert.priceLow !== null) {
        message += `You will be notified when the price goes below ${alert.priceLow} ETH.\n`;
      }
      
      bot.sendMessage(chatId, message);
    }
  });
  
  // Simulate alert checking (in a real implementation, this would run on a schedule)
  setInterval(() => {
    // Check all alerts
    for (const [userId, userAlerts] of alerts.entries()) {
      for (const alert of userAlerts) {
        // Simulate price check (in a real implementation, we would fetch the actual price)
        const currentPrice = Math.random() * 0.5; // Random price between 0 and 0.5 ETH
        
        // Check if price triggers alert
        if (alert.priceHigh !== null && currentPrice > alert.priceHigh) {
          // Price went above threshold
          const message = `🔔 *Price Alert*\n\n${alert.tokenInfo.name} (${alert.tokenInfo.symbol}) price is now ${currentPrice.toFixed(6)} ETH, which is above your alert threshold of ${alert.priceHigh} ETH.`;
          
          bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
        } else if (alert.priceLow !== null && currentPrice < alert.priceLow) {
          // Price went below threshold
          const message = `🔔 *Price Alert*\n\n${alert.tokenInfo.name} (${alert.tokenInfo.symbol}) price is now ${currentPrice.toFixed(6)} ETH, which is below your alert threshold of ${alert.priceLow} ETH.`;
          
          bot.sendMessage(userId, message, { parse_mode: 'Markdown' });
        }
      }
    }
  }, 60000); // Check every minute (in a real implementation, this would be more sophisticated)
}; 