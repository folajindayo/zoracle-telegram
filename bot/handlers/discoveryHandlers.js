/**
 * Discovery Handlers for Zoracle Telegram Bot
 */
const { getTokenInfo } = require('../baseBot');
const { CONFIG } = require('../../config');
const axios = require('axios');

// Mock token data (in a real implementation, this would come from an API or blockchain)
const mockTokens = {
  new: [
    { address: '0x1234567890abcdef1234567890abcdef12345678', name: 'Creator Token 1', symbol: 'CT1', creator: 'Famous Artist 1', price: 0.05, liquidity: 2.5, created: Date.now() - 3600000 },
    { address: '0xabcdef1234567890abcdef1234567890abcdef12', name: 'Creator Token 2', symbol: 'CT2', creator: 'Famous Artist 2', price: 0.02, liquidity: 1.2, created: Date.now() - 7200000 },
    { address: '0x7890abcdef1234567890abcdef1234567890abcd', name: 'Creator Token 3', symbol: 'CT3', creator: 'Famous Artist 3', price: 0.08, liquidity: 3.8, created: Date.now() - 10800000 }
  ],
  trending: [
    { address: '0x2345678901abcdef2345678901abcdef23456789', name: 'Popular Token 1', symbol: 'PT1', creator: 'Popular Creator 1', price: 0.15, liquidity: 15.2, volume24h: 25.3 },
    { address: '0xbcdef2345678901abcdef2345678901abcdef234', name: 'Popular Token 2', symbol: 'PT2', creator: 'Popular Creator 2', price: 0.22, liquidity: 18.5, volume24h: 32.1 },
    { address: '0x8901abcdef2345678901abcdef2345678901abcd', name: 'Popular Token 3', symbol: 'PT3', creator: 'Popular Creator 3', price: 0.18, liquidity: 12.8, volume24h: 28.7 }
  ]
};

module.exports = (bot, users) => {
  // New tokens command
  bot.onText(/\/new/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // In a real implementation, we would fetch newly created tokens from the blockchain or API
      const newTokens = mockTokens.new;
      
      if (newTokens.length === 0) {
        bot.sendMessage(chatId, 'No new tokens found.');
        return;
      }
      
      // Build message
      let message = '🆕 *Newly Created Tokens*\n\n';
      
      for (const token of newTokens) {
        const timeAgo = getTimeAgo(token.created);
        message += `*${token.name} (${token.symbol})*\nCreator: ${token.creator}\nPrice: ${token.price} ETH\nLiquidity: ${token.liquidity} ETH\nCreated: ${timeAgo}\n\n`;
      }
      
      // Add inline keyboard buttons for each token
      const inlineKeyboard = newTokens.map(token => [
        { text: `Buy ${token.symbol}`, callback_data: `buy_${token.address}` },
        { text: `Info ${token.symbol}`, callback_data: `info_${token.address}` }
      ]);
      
      const options = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      };
      
      bot.sendMessage(chatId, message, options);
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error fetching new tokens: ${error.message}`);
    }
  });
  
  // Trending tokens command
  bot.onText(/\/trending/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // In a real implementation, we would fetch trending tokens from the blockchain or API
      const trendingTokens = mockTokens.trending;
      
      if (trendingTokens.length === 0) {
        bot.sendMessage(chatId, 'No trending tokens found.');
        return;
      }
      
      // Build message
      let message = '🔥 *Trending Tokens*\n\n';
      
      for (const token of trendingTokens) {
        message += `*${token.name} (${token.symbol})*\nCreator: ${token.creator}\nPrice: ${token.price} ETH\nVolume 24h: ${token.volume24h} ETH\nLiquidity: ${token.liquidity} ETH\n\n`;
      }
      
      // Add inline keyboard buttons for each token
      const inlineKeyboard = trendingTokens.map(token => [
        { text: `Buy ${token.symbol}`, callback_data: `buy_${token.address}` },
        { text: `Info ${token.symbol}`, callback_data: `info_${token.address}` }
      ]);
      
      const options = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      };
      
      bot.sendMessage(chatId, message, options);
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error fetching trending tokens: ${error.message}`);
    }
  });
  
  // Search command
  bot.onText(/\/search (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1].trim().toLowerCase();
    
    try {
      // In a real implementation, we would search for tokens in the blockchain or API
      // For now, we'll just filter our mock data
      const allTokens = [...mockTokens.new, ...mockTokens.trending];
      const searchResults = allTokens.filter(token => 
        token.name.toLowerCase().includes(query) || 
        token.symbol.toLowerCase().includes(query) || 
        token.creator.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
      );
      
      if (searchResults.length === 0) {
        bot.sendMessage(chatId, `No tokens found matching "${query}".`);
        return;
      }
      
      // Build message
      let message = `🔍 *Search Results for "${query}"*\n\n`;
      
      for (const token of searchResults) {
        message += `*${token.name} (${token.symbol})*\nCreator: ${token.creator}\nPrice: ${token.price} ETH\nLiquidity: ${token.liquidity} ETH\n\n`;
      }
      
      // Add inline keyboard buttons for each token
      const inlineKeyboard = searchResults.map(token => [
        { text: `Buy ${token.symbol}`, callback_data: `buy_${token.address}` },
        { text: `Info ${token.symbol}`, callback_data: `info_${token.address}` }
      ]);
      
      const options = {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      };
      
      bot.sendMessage(chatId, message, options);
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error searching for tokens: ${error.message}`);
    }
  });
  
  // Handle token buttons
  bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();
    
    // Check if this is a token action
    if (action.startsWith('buy_') || action.startsWith('info_')) {
      const [actionType, tokenAddress] = action.split('_');
      
      // Find the token in our mock data
      const allTokens = [...mockTokens.new, ...mockTokens.trending];
      const token = allTokens.find(t => t.address === tokenAddress);
      
      if (!token) {
        bot.answerCallbackQuery(callbackQuery.id, { text: 'Token not found.' });
        return;
      }
      
      if (actionType === 'buy') {
        // Redirect to buy command
        bot.sendMessage(chatId, `Use this command to buy ${token.symbol}:\n\n/buy ${token.address}`);
        bot.answerCallbackQuery(callbackQuery.id);
      } else if (actionType === 'info') {
        // Show token info
        const message = `
📊 *Token Information*

*${token.name} (${token.symbol})*
Address: \`${token.address}\`
Creator: ${token.creator}
Price: ${token.price} ETH
Liquidity: ${token.liquidity} ETH
${token.volume24h ? `Volume 24h: ${token.volume24h} ETH` : ''}

[View on Basescan](https://basescan.org/token/${token.address})
        `;
        
        const options = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: `Buy ${token.symbol}`, callback_data: `buy_${token.address}` }],
              [{ text: 'Add to Watchlist', callback_data: `watch_${token.address}` }]
            ]
          }
        };
        
        bot.sendMessage(chatId, message, options);
        bot.answerCallbackQuery(callbackQuery.id);
      }
    } else if (action.startsWith('watch_')) {
      const tokenAddress = action.split('_')[1];
      
      // In a real implementation, we would add the token to the user's watchlist
      // For now, we'll just acknowledge the action
      bot.answerCallbackQuery(callbackQuery.id, { text: 'Token added to watchlist!', show_alert: true });
    }
  });
};

/**
 * Get a human-readable time ago string
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} - Human-readable time ago string
 */
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) {
    return `${seconds} seconds ago`;
  }
  
  const minutes = Math.floor(seconds / 60);
  
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
} 