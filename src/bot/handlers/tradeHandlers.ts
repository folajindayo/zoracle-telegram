/**
 * Trade Handlers for Zoracle Telegram Bot
 */
import TelegramBot from 'node-telegram-bot-api';
import { ethers } from 'ethers';
import { UserData } from './walletHandlers';
import { getTranslatedMessage } from './walletHandlers';
import axios from 'axios';

export async function handleShowTradeOptions(
  bot: TelegramBot,
  chatId: number,
  callbackQuery: any
): Promise<void> {
  try {
    const userId = callbackQuery.from.id.toString();
    const tradingTitle = await getTranslatedMessage('trading_title', userId);
    const tradingSubtitle = await getTranslatedMessage('trading_subtitle', userId);
    const swapTokens = await getTranslatedMessage('swap_tokens', userId);
    const backToMain = await getTranslatedMessage('back_to_main', userId);
    
    const tradeOptions = {
      reply_markup: {
        inline_keyboard: [
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
          [{ text: '🔄 Swap Tokens', callback_data: 'trade_swap' }],
          [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
        ]
      },
      parse_mode: 'HTML' as const
    };
    
    bot.sendMessage(chatId, '🔄 <b>Trading</b>\n\nWhat would you like to do?', tradeOptions);
  }
}

export async function handleTradeSwap(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();
    
    // Show a loading message
    const loadingMessage = await bot.sendMessage(chatId, '⏳ Loading your portfolio tokens...');
    
    // Get user's wallet address first
    const walletManager = await import('../../services/cdpWallet');
    
    // Check if user has a wallet
    if (!walletManager.userHasWallet(userId)) {
      bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
        console.error('Error deleting loading message:', e)
      );
      bot.sendMessage(
        chatId,
        "❌ <b>No Wallet Found</b>\n\nYou need to create a wallet first to swap tokens.",
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "💼 Create Wallet", callback_data: "wallet_create" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    // Get user's portfolio data using the same API call as portfolio handlers
    const userName = `zoracle-${userId}`;
    const baseURL = process.env.ZORACLE_API_URL || 'https://usezoracle-telegrambot-production.up.railway.app';
    
    const response = await axios.get(`${baseURL}/api/balances/${userName}`, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    // Delete the loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (!response.data || !response.data.success) {
      bot.sendMessage(
        chatId,
        `❌ Failed to load portfolio: ${response.data?.message || "Unknown error"}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        }
      );
      return;
    }

    // Process the balance data from API response
    const balanceData = response.data.data;
    const balances = balanceData?.balances || [];

    if (balances.length > 0) {
      // Create buttons for user's actual tokens
      const tokenButtons = [];
      
      // Add each token from user's portfolio
      for (const balance of balances) {
        const token = balance.token;
        const amount = balance.amount;
        const usdValue = balance.usdValue || 0;
        const balanceNum = parseFloat(amount.formatted);
        
        // Format balance with smart decimal places
        let formattedBalance;
        if (balanceNum === 0) {
          formattedBalance = "0";
        } else if (balanceNum < 0.000001) {
          formattedBalance = balanceNum.toExponential(2);
        } else if (balanceNum < 0.01) {
          formattedBalance = balanceNum.toFixed(8);
        } else if (balanceNum < 1) {
          formattedBalance = balanceNum.toFixed(6);
        } else if (balanceNum < 1000) {
          formattedBalance = balanceNum.toFixed(4);
        } else {
          formattedBalance = balanceNum.toFixed(2);
        }
        
        // Format USD value
        const formattedUsdValue = usdValue < 0.01 ? usdValue.toFixed(4) : usdValue.toFixed(2);
        
        const displayText = `${token.symbol} (${formattedBalance}) - $${formattedUsdValue}`;
        
        tokenButtons.push([{ 
          text: displayText, 
          callback_data: `swap_from_${token.symbol}` 
        }]);
      }
      
      // Add back button
      tokenButtons.push([{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]);
      
      // Store user's tokens for the session
      if (!users.has(userId)) {
        users.set(userId, {});
      }
      const userData = users.get(userId);
      userData.availableTokens = balances;
      
      bot.sendMessage(
        chatId, 
        '🔄 <b>Swap Tokens</b>\n\nSelect a token from your portfolio to swap <b>from</b>:', 
        {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: tokenButtons
          }
        }
      );
    } else {
      // No tokens found in portfolio
      bot.sendMessage(
        chatId, 
        '❌ <b>No Tokens Found</b>\n\nYour portfolio is empty. You need to have tokens to swap.',
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Refresh Portfolio', callback_data: 'show_portfolio' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error('Error loading user tokens for swap:', error);
    bot.sendMessage(
      chatId, 
      `❌ Error loading your tokens: ${error.message}`, 
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      }
    );
  }
}

export async function handleSwapFrom(
  bot: TelegramBot,
  chatId: number,
  action: string,
  users: Map<string, UserData>,
  conversationStates: Map<number, any>
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
    
    // Set the conversation state for token address input
    conversationStates.set(chatId, 'AWAITING_TOKEN_ADDRESS');
    
    // Send message asking for token address
    bot.sendMessage(chatId, `🎯 <b>Token Swap</b>\n\nSwapping from <b>${fromToken}</b>\n\nPlease enter the contract address of the token you want to swap to:\n\n<i>Example: 0x1234567890123456789012345678901234567890</i>`, {
      parse_mode: 'HTML' as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Different Source', callback_data: 'trade_swap' }],
          [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
        ]
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

// Initialize trade handlers
export default function initTradeHandlers(
  bot: TelegramBot,
  users: Map<string, any>,
  conversationStates: Map<number, any>
): void {
  // Handle callback queries for trade-related actions
  bot.on("callback_query", async (callbackQuery) => {
    if (!callbackQuery.data || !callbackQuery.message) return;

    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    try {
      switch (data) {
        case "show_trade_options":
          await handleShowTradeOptions(bot, chatId, callbackQuery);
          break;
        case "trade_swap":
          await handleTradeSwap(bot, chatId, users);
          break;
        case "trade_cancel":
          await handleCancelTrade(bot, chatId, conversationStates);
          break;
        default:
          // Handle dynamic swap actions
          if (data.startsWith("swap_from_")) {
            await handleSwapFrom(bot, chatId, data, users, conversationStates);
          } else if (data.startsWith("swap_to_")) {
            await handleSwapTo(bot, chatId, data, users, conversationStates);
          } else if (data === "swap_to_custom") {
            await handleSwapToCustom(bot, chatId, users, conversationStates);
          }
          break;
      }
    } catch (error) {
      console.error("Error handling trade callback:", error);
      bot.sendMessage(
        chatId,
        "❌ An error occurred while processing your request. Please try again.",
        { parse_mode: "HTML" as const }
      );
    }
  });
} 