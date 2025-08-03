/**
 * Trade Handlers for Zoracle Telegram Bot
 */
import TelegramBot from 'node-telegram-bot-api';
import { ethers } from 'ethers';
import { UserData } from './walletHandlers';
import { getTranslatedMessage } from './walletHandlers';

export async function handleShowTradeOptions(
  bot: TelegramBot,
  chatId: number,
  callbackQuery: any
): Promise<void> {
  try {
    const userId = callbackQuery.from.id.toString();
    const tradingTitle = await getTranslatedMessage('trading_title', userId);
    const tradingSubtitle = await getTranslatedMessage('trading_subtitle', userId);
    const buyTokens = await getTranslatedMessage('buy_tokens', userId);
    const sellTokens = await getTranslatedMessage('sell_tokens', userId);
    const swapTokens = await getTranslatedMessage('swap_tokens', userId);
    const backToMain = await getTranslatedMessage('back_to_main', userId);
    
    const tradeOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: buyTokens, callback_data: 'trade_buy' }],
          [{ text: sellTokens, callback_data: 'trade_sell' }],
          [{ text: swapTokens, callback_data: 'trade_swap' }],
          [{ text: backToMain, callback_data: 'back_to_main' }]
        ]
      },
      parse_mode: 'HTML' as const
    };
    
    bot.sendMessage(chatId, `${tradingTitle}\n\n${tradingSubtitle}`, tradeOptions);
  } catch (error) {
    console.error('Error showing trade options:', error);
    // Fallback to English
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
}

export async function handleTradeBuy(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  conversationStates.set(chatId, 'AWAITING_BUY_TOKEN');
  bot.sendMessage(chatId, '💵 <b>Buy Tokens</b>\n\nPlease enter the token address you want to buy:', {
    parse_mode: 'HTML' as const,
    reply_markup: {
      force_reply: true
    }
  });
}

export async function handleTradeSwap(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    // Import the swaps service
    const swapService = await import('../../services/swaps');
    
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

export async function handleSwapFrom(
  bot: TelegramBot,
  chatId: number,
  action: string,
  users: Map<string, UserData>
): Promise<void> {
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

export async function handleSwapToCustom(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>,
  conversationStates: Map<number, any>
): Promise<void> {
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

export async function handleSwapTo(
  bot: TelegramBot,
  chatId: number,
  action: string,
  users: Map<string, UserData>,
  conversationStates: Map<number, any>
): Promise<void> {
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

export async function handleTradeSell(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const portfolio = await import('../../services/portfolio');
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

export async function handleCancelTrade(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
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