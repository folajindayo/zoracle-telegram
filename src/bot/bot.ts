// Main Bot File - Zoracle Telegram Bot
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import axios from "axios";
import * as fs from "fs";

// Import handlers
import * as walletHandlers from "./handlers/walletHandlers";
import * as portfolioHandlers from "./handlers/portfolioHandlers";
import * as tradeHandlers from "./handlers/tradeHandlers";
import * as positionHandlers from "./handlers/positionHandlers";
import * as alertHandlers from "./handlers/alertHandlers";

// Import utilities
import { escapeMarkdownPreserveFormat } from "../utils/telegramUtils";
import {
  getTranslation,
  getLanguageName,
  getAvailableLanguages,
} from "../utils/translations";

// Environment variables
const token = process.env.TELEGRAM_BOT_TOKEN;

// Debug log for token
console.log(
  "📝 Telegram Bot Token:",
  token ? `${token.substring(0, 10)}...` : "undefined"
);

// Validate required environment variables
if (!token) {
  console.error("❌ Required environment variables missing!");
  process.exit(1);
}

// Create bot instance with better error handling
const bot = new TelegramBot(token, {
  polling: {
    interval: 300,
    autoStart: false, // Don't start polling yet
    params: {
      timeout: 10,
      allowed_updates: ["message", "callback_query", "inline_query"],
    },
  },
});

// Add error handler
bot.on("polling_error", (error) => {
  console.error("🔴 Telegram Bot polling error:", error.message);
  // Don't crash on polling errors
});

// Clear webhook and start polling when the module is imported
axios
  .get(
    `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`
  )
  .then((response) => {
    console.log(`✅ Webhook deletion status: ${response.status}`);
    bot.startPolling();
    console.log("✅ Telegram Bot initialized successfully");
  })
  .catch((error) => {
    console.error("❌ Failed to delete webhook:", error.message);
    // Continue anyway, let's try to start polling
    bot.startPolling();
  });

// Provider setup
const provider = new ethers.providers.JsonRpcProvider(
  process.env.PROVIDER_URL ||
    "https://rpc.ankr.com/base/b39a19f9ecf66252bf862fe6948021cd1586009ee97874655f46481cfbf3f129"
);

// Set up bot menu commands
bot.setMyCommands([
  { command: "start", description: "🚀 Start the bot" },
  { command: "help", description: "📚 Show help menu" },
  { command: "wallet", description: "🔐 Manage wallet" },
  { command: "portfolio", description: "💰 View portfolio" },
  { command: "trade", description: "🔄 Trading options" },
  { command: "sniper", description: "🎯 Token sniper" },
  { command: "history", description: "📊 Transaction history" },
  { command: "alerts", description: "🔔 Price alerts" },
  { command: "discover", description: "🔍 Discover tokens" },
  { command: "settings", description: "⚙️ Bot settings" },
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
/wallet - Manage your wallet (create, import)
/portfolio - View your portfolio and balances
/history - View transaction history

<b>🔄 Trading Features:</b>
/trade - Trading options (swap, buy, sell)
/sniper - Set up token sniping bots
/limit - Create limit orders
/transfer - Send tokens to other wallets

<b>🪙 Position Management:</b>
/positions - View your trading positions
/fixpositions - Fix position data with actual wallet balances

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
• Use /fixpositions if position data seems incorrect

<b>🎯 Popular Commands:</b>
/trade - Start trading
/sniper - Set up automated buying
/portfolio - Check your holdings
/discover - Find new opportunities
/fixpositions - Fix position data issues
`;

// Function to show main menu after successful login
async function showMainMenu(chatId: number): Promise<void> {
  try {
    const userId = chatId.toString();
    const menuTitle = await walletHandlers.getTranslatedMessage(
      "main_menu_title",
      userId
    );
    const menuSubtitle = await walletHandlers.getTranslatedMessage(
      "main_menu_subtitle",
      userId
    );

    const mainMenuOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "💰 Portfolio", callback_data: "show_portfolio" },
            { text: "🔄 Trade", callback_data: "show_trade_options" },
          ],
          [
            { text: "🪙 Positions", callback_data: "show_positions" },
            { text: "🎯 Sniper", callback_data: "sniper_new" },
          ],
          [
            { text: "💸 Transfer", callback_data: "transfer" },
            { text: "⏱️ Limit Orders", callback_data: "limit_new" },
          ],
          [
            { text: "👥 Copy Trading", callback_data: "show_copy_trading" },
            { text: "📊 History", callback_data: "show_transactions" },
          ],
          [
            { text: "🔔 Alerts", callback_data: "show_alerts" },
            { text: "🎨 PnL Cards", callback_data: "show_pnl_cards" },
          ],
          [
            { text: "🔍 Discover", callback_data: "show_discover" },
            { text: "⚙️ Settings", callback_data: "show_settings" },
          ],
          [
            { text: "🎁 Referrals", callback_data: "show_referrals" },
          ],
        ],
      },
      parse_mode: "HTML" as const,
    };

    bot.sendMessage(chatId, `${menuTitle}\n\n${menuSubtitle}`, mainMenuOptions);
  } catch (error) {
    console.error("Error showing main menu:", error);
    // Fallback to English
    const mainMenuOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "💰 Portfolio", callback_data: "show_portfolio" },
            { text: "🔄 Trade", callback_data: "show_trade_options" },
          ],
          [
            { text: "🎯 Sniper", callback_data: "sniper_new" },
            { text: "💸 Transfer", callback_data: "transfer" },
          ],
          [
            { text: "⏱️ Limit Orders", callback_data: "limit_new" },
            { text: "👥 Copy Trading", callback_data: "show_copy_trading" },
          ],
          [
            { text: "📊 History", callback_data: "show_transactions" },
            { text: "🔔 Alerts", callback_data: "show_alerts" },
          ],
          [
            { text: "🎨 PnL Cards", callback_data: "show_pnl_cards" },
            { text: "🔍 Discover", callback_data: "show_discover" },
          ],
          [
            { text: "⚙️ Settings", callback_data: "show_settings" },
            { text: "🎁 Referrals", callback_data: "show_referrals" },
          ],
        ],
      },
      parse_mode: "HTML" as const,
    };

    bot.sendMessage(
      chatId,
      "🏠 <b>Main Menu</b>\n\nWhat would you like to do today?",
      mainMenuOptions
    );
  }
}

// Handle /start
bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const walletAddress = match && match[1] ? match[1].trim() : null;

  // Import database operations
  const { UserOps } = await import("../database/operations");

  // First, check if user already exists in database
  let existingUser = null;
  try {
    existingUser = await UserOps.getUser(userId);
    console.log(`🔍 Checking for existing user: ${userId}`);
  } catch (error) {
    console.error(`❌ Error checking existing user: ${error}`);
  }

  // Store/update user data in database
  try {
    await UserOps.upsertUser(userId, {
      telegramId: userId,
      username: msg.from.username || msg.from.first_name,
      lastActive: new Date(),
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
            [{ text: "🔑 Create New Wallet", callback_data: "wallet_create" }],
            [
              {
                text: "📥 Import Existing Wallet",
                callback_data: "wallet_import",
              },
            ],
          ],
        },
        parse_mode: "HTML" as const,
      };

      bot.sendMessage(
        chatId,
        "✅ <b>Wallet connected!</b>\n\nWhat would you like to do?",
        walletOptions
      );
    } else {
      bot.sendMessage(chatId, "⚠️ Invalid wallet address.");
    }
  } else {
    // Check if user already exists in database
    if (existingUser) {
      console.log(`👋 Welcome back user ${userId}!`);

      // For existing users, check if they have a wallet
      const walletManager = await import("../services/cdpWallet");
      if (walletManager.userHasWallet(chatId.toString())) {
        console.log(`✅ Returning user ${userId} has a wallet`);

        // Get and display the wallet address
        const walletAddress = walletManager.getWalletAddress(chatId.toString());
        if (walletAddress) {
          bot.sendMessage(
            chatId,
            `👋 <b>Welcome back!</b>\n\nYour wallet address: <code>${walletAddress}</code>\n\nYour wallet is ready to use!`,
            { parse_mode: "HTML" as const }
          );
        }
      } else {
        console.log(`ℹ️ Returning user ${userId} doesn't have a wallet yet`);
        bot.sendMessage(
          chatId,
          "You don't have a wallet set up yet. Let's create one for you!",
          { parse_mode: "HTML" as const }
        );
      }

      // Go straight to main menu for returning users
      conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
      await showMainMenu(chatId);
      return;
    }

    // New user - automatically create wallet silently
    console.log(
      `🆕 New user ${userId} detected. Creating wallet automatically...`
    );

    try {
      const walletManager = await import("../services/cdpWallet");
      const result = await walletManager.createWallet(userId, "", "");

      if (result.success) {
        // Mark user as setup complete in database
        try {
          const { UserOps } = await import("../database/operations");
          await UserOps.upsertUser(userId, { setupComplete: true });
          console.log(
            `✅ Marked user ${userId} as setup complete after automatic wallet creation`
          );
        } catch (error) {
          console.error(`❌ Failed to mark user as setup complete: ${error}`);
        }

        console.log(
          `✅ Wallet created automatically for new user ${userId}: ${result.address}`
        );

        // Show welcome message with wallet info
        const welcomeMsg = await walletHandlers.getWelcomeMessage(userId);
        bot.sendMessage(
          chatId,
          welcomeMsg +
            `\n\n✅ <b>Wallet Created Successfully!</b>\n\nAddress: <code>${result.address}</code>\n\nYour wallet is ready to use!`,
          { parse_mode: "HTML" as const }
        );

        // Show mnemonic if created new wallet
        if (result.mnemonic) {
          bot.sendMessage(
            chatId,
            `🔐 <b>IMPORTANT: Save Your Recovery Phrase</b>\n\n<code>${result.mnemonic}</code>\n\n⚠️ <b>NEVER share this with anyone!</b> Write it down and keep it in a safe place.`,
            { parse_mode: "HTML" as const }
          );
        }

        // Set conversation state and show main menu
        conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
        await showMainMenu(chatId);
      } else {
        console.error(
          `❌ Failed to create wallet for new user ${userId}: ${result.message}`
        );

        // Fallback to manual setup if automatic creation fails
        const setupOptions = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔑 Create New Wallet",
                  callback_data: "wallet_create",
                },
              ],
              [
                {
                  text: "📥 Import Existing Wallet",
                  callback_data: "wallet_import",
                },
              ],
              [{ text: "❓ Help", callback_data: "show_help" }],
            ],
          },
          parse_mode: "HTML" as const,
        };

        const welcomeMsg = await walletHandlers.getWelcomeMessage(userId);
        bot.sendMessage(
          chatId,
          welcomeMsg +
            `<code>${chatId}</code>\n\nLet's get started by setting up your wallet:`,
          setupOptions
        );
      }
    } catch (error) {
      console.error(`❌ Error creating wallet for new user ${userId}:`, error);

      // Fallback to manual setup if automatic creation fails
      const setupOptions = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔑 Create New Wallet",
                callback_data: "wallet_create",
              },
            ],
            [
              {
                text: "📥 Import Existing Wallet",
                callback_data: "wallet_import",
              },
            ],
            [{ text: "❓ Help", callback_data: "show_help" }],
          ],
        },
        parse_mode: "HTML" as const,
      };

      const welcomeMsg = await walletHandlers.getWelcomeMessage(userId);
      bot.sendMessage(
        chatId,
        welcomeMsg +
          `<code>${chatId}</code>\n\nLet's get started by setting up your wallet:`,
        setupOptions
      );
    }
  }
});

// Handle commands
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text;

  console.log(
    `🚀 /start command received from user ${userId} in chat ${chatId}`
  );

  // Check if user already exists in database
  const { UserOps } = await import("../database/operations");
  const existingUser = await UserOps.getUser(userId);

  if (existingUser) {
    console.log(`👋 Welcome back user ${userId}!`);

    // For existing users, check if they have a wallet
    const walletManager = await import("../services/cdpWallet");
    if (walletManager.userHasWallet(chatId.toString())) {
      console.log(`✅ Returning user ${userId} has a wallet`);

      // Get and display the wallet address
      const walletAddress = walletManager.getWalletAddress(chatId.toString());
      if (walletAddress) {
        bot.sendMessage(
          chatId,
          `👋 <b>Welcome back!</b>\n\nYour wallet address: <code>${walletAddress}</code>\n\nYour wallet is ready to use!`,
          { parse_mode: "HTML" as const }
        );
      }
    } else {
      console.log(`ℹ️ Returning user ${userId} doesn't have a wallet yet`);
      bot.sendMessage(
        chatId,
        "You don't have a wallet set up yet. Let's create one for you!",
        { parse_mode: "HTML" as const }
      );
    }

    // Go straight to main menu for returning users
    conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
    await showMainMenu(chatId);
    return;
  }

  // New user - automatically create wallet silently
  console.log(
    `🆕 New user ${userId} detected. Creating wallet automatically...`
  );

  try {
    const walletManager = await import("../services/cdpWallet");
    const result = await walletManager.createWallet(userId, "", "");

    if (result.success) {
      // Mark user as setup complete in database
      try {
        await UserOps.upsertUser(userId, { setupComplete: true });
        console.log(
          `✅ Marked user ${userId} as setup complete after automatic wallet creation`
        );
      } catch (error) {
        console.error(`❌ Failed to mark user as setup complete: ${error}`);
      }

      console.log(
        `✅ Wallet created automatically for new user ${userId}: ${result.address}`
      );

      // Show welcome message with wallet info
      const welcomeMsg = await walletHandlers.getWelcomeMessage(userId);
      bot.sendMessage(
        chatId,
        welcomeMsg +
          `\n\nYour wallet has been created automatically! You can now start trading.`,
        { parse_mode: "HTML" as const }
      );

      // Go to main menu for new users
      conversationStates.set(chatId, walletHandlers.STATES.COMPLETE);
      await showMainMenu(chatId);
    } else {
      console.log(`❌ Failed to create wallet for new user ${userId}`);
      bot.sendMessage(
        chatId,
        "❌ Failed to create wallet. Please try again or contact support.",
        { parse_mode: "HTML" as const }
      );
    }
  } catch (error) {
    console.error(`❌ Error creating wallet for new user ${userId}:`, error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while creating your wallet. Please try again.",
      { parse_mode: "HTML" as const }
    );
  }
});

// Handle /positions command
bot.onText(/\/positions/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  console.log(`🪙 /positions command received from user ${userId} in chat ${chatId}`);

  try {
    // Import position handlers
    const positionHandlers = await import("./handlers/positionHandlers");
    
    // Call the show positions handler
    await positionHandlers.handleShowPositions(bot, chatId, users);
  } catch (error) {
    console.error("Error handling /positions command:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while loading positions: ${error.message}`,
      { parse_mode: "HTML" as const }
    );
  }
});

// Handle /fixpositions command
bot.onText(/\/fixpositions/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();

  console.log(`🔧 /fixpositions command received from user ${userId} in chat ${chatId}`);

  try {
    // Import position handlers
    const positionHandlers = await import("./handlers/positionHandlers");
    
    // Call the fix positions handler
    await positionHandlers.handleFixPositions(bot, chatId, users);
  } catch (error) {
    console.error("Error handling /fixpositions command:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while fixing positions: ${error.message}`,
      { parse_mode: "HTML" as const }
    );
  }
});

// Initialize handlers
walletHandlers.default(bot, users);
positionHandlers.default(bot, users);
portfolioHandlers.default(bot, users);
tradeHandlers.default(bot, users, conversationStates);
alertHandlers.default(bot, users);

// Initialize price monitoring service
(async () => {
  const priceMonitor = await import('../services/priceMonitor');
  priceMonitor.startPriceMonitoring();
})();

// Handle back to main menu callback
bot.on("callback_query", async (callbackQuery) => {
  if (!callbackQuery.data || !callbackQuery.message) return;

  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "back_to_main") {
    await showMainMenu(chatId);
  } else if (data === "show_trade_options") {
    const tradeHandlers = await import('./handlers/tradeHandlers');
    await tradeHandlers.handleShowTradeOptions(bot, chatId, callbackQuery);
  } else if (data === "limit_new") {
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleCreateLimitOrder(bot, chatId, users);
  } else if (data === "limit_orders") {
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleShowLimitOrders(bot, chatId, users);
  } else if (data === "limit_buy") {
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleLimitOrderType(bot, chatId, 'buy', users);
  } else if (data === "limit_sell") {
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleLimitOrderType(bot, chatId, 'sell', users);
  } else if (data === "limit_confirm") {
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleLimitOrderConfirmation(bot, chatId, users);
  } else if (data === "limit_cancel") {
    bot.sendMessage(chatId, "❌ Limit order creation cancelled.", {
      parse_mode: "HTML" as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
        ]
      }
    });
  } else if (data.startsWith("limit_cancel_order_")) {
    const orderId = data.replace("limit_cancel_order_", "");
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleCancelLimitOrder(bot, chatId, orderId, users);
  } else if (data === "execute_swap") {
    // Handle swap execution
    const userId = callbackQuery.from.id.toString();
    const userData = users.get(userId) || {};
    const fromToken = userData.swapFromToken;
    const toToken = userData.swapToToken;
    const amount = userData.swapAmount;
    
    if (!fromToken || !toToken || !amount) {
      bot.sendMessage(chatId, '❌ <b>Error:</b> Missing swap information. Please start over.', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Start Over', callback_data: 'trade_swap' }],
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
      conversationStates.delete(chatId);
      return;
    }
    
    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      '⏳ <b>Executing Swap...</b>\n\nPlease wait while we process your transaction.',
      { parse_mode: 'HTML' as const }
    );
    
    try {
      // Execute swap with position tracking
      const enhancedSwaps = await import('../services/enhancedSwaps');
      const accountName = `zoracle-${userId}`;
      
      const swapResult = await enhancedSwaps.executeSwapWithPositionTracking(
        userId,
        accountName,
        fromToken,
        toToken,
        amount.toString(),
        100, // 1% slippage
        'base'
      );
      
      // Delete loading message
      bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
        console.error('Error deleting loading message:', e)
      );
      
      if (swapResult.success) {
        // Format success message
        const swap = swapResult.swap;
        const position = swapResult.position;
        
        let successMessage = '✅ <b>Swap Executed Successfully!</b>\n\n';
        successMessage += `🔄 <b>Transaction Details:</b>\n`;
        successMessage += `• From: ${fromToken}\n`;
        successMessage += `• To: ${toToken}\n`;
        successMessage += `• Amount: ${amount}\n`;
        successMessage += `• TX Hash: <code>${swap.txHash || 'Pending'}</code>\n\n`;
        
        if (position) {
          successMessage += `📊 <b>Position Created:</b>\n`;
          successMessage += `• Token: ${position.tokenSymbol}\n`;
          successMessage += `• Initial Value: $${position.initialUsdValue.toFixed(2)}\n`;
          successMessage += `• Entry Price: $${position.entryPrice.toFixed(6)}\n\n`;
        }
        
        successMessage += `🎯 <b>Next Steps:</b>\n`;
        successMessage += `• Monitor your position\n`;
        successMessage += `• Set up price alerts\n`;
        successMessage += `• Check portfolio updates`;
        
        bot.sendMessage(chatId, successMessage, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 View Positions', callback_data: 'show_positions' }],
              [{ text: '💰 View Portfolio', callback_data: 'show_portfolio' }],
              [{ text: '🔄 Trade Again', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        });
      } else {
        bot.sendMessage(chatId, `❌ <b>Swap Failed</b>\n\n${swapResult.message}`, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error executing swap:', error);
      bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
        console.error('Error deleting loading message:', e)
      );
      
      bot.sendMessage(chatId, `❌ <b>Error:</b> ${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
    }
    
    // Clear conversation state
    conversationStates.delete(chatId);
  }
});

// Handle text messages for swap execution
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return; // Skip commands
  
  const chatId = msg.chat.id;
  const userId = chatId.toString();
  const text = msg.text.trim();
  
  // Check if user is in swap conversation state
  const conversationState = conversationStates.get(chatId);
  
  if (conversationState === 'AWAITING_SWAP_AMOUNT') {
    try {
      // Get user data
      const userData = users.get(userId) || {};
      const fromToken = userData.swapFromToken;
      const toToken = userData.swapToToken;
      
      if (!fromToken || !toToken) {
        bot.sendMessage(chatId, '❌ <b>Error:</b> Token selection incomplete. Please start over.', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Start Over', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
        conversationStates.delete(chatId);
        return;
      }
      
      // Parse amount
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        bot.sendMessage(chatId, '❌ <b>Invalid Amount</b>\n\nPlease enter a valid positive number.', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
        return;
      }
      
      // Store amount and show summary
      userData.swapAmount = amount;
      users.set(userId, userData);
      
      // Show loading message while fetching token details
      const loadingMessage = await bot.sendMessage(
        chatId,
        '⏳ <b>Fetching Token Details...</b>\n\nPlease wait while we get information about the token.',
        { parse_mode: 'HTML' as const }
      );
      
      try {
        // Get token details from CoinGecko
        const coingecko = await import('../services/coingecko');
        const tokenDetails = await coingecko.getTokenDetails(toToken, 'base');
        
        // Delete loading message
        bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
          console.error('Error deleting loading message:', e)
        );
        
        // Build enhanced swap summary
        let summaryMessage = '📋 <b>Swap Summary</b>\n\n';
        summaryMessage += `🔄 <b>Transaction Details:</b>\n`;
        summaryMessage += `• From: ${fromToken}\n`;
        summaryMessage += `• To: <code>${toToken}</code>\n`;
        summaryMessage += `• Amount: ${amount} ${fromToken}\n`;
        summaryMessage += `• Network: Base\n`;
        summaryMessage += `• Slippage: 1%\n\n`;
        
        // Add token details if available
        if (tokenDetails.success) {
          const token = tokenDetails.token;
          summaryMessage += `🪙 <b>Token Information:</b>\n`;
          summaryMessage += `• Name: ${token.name}\n`;
          summaryMessage += `• Symbol: ${token.symbol}\n`;
          
          if (token.price) {
            summaryMessage += `• Price: $${token.price.toFixed(6)}\n`;
          }
          
          if (token.priceChange24h !== undefined) {
            const changeEmoji = token.priceChange24h >= 0 ? '📈' : '📉';
            summaryMessage += `• 24h Change: ${changeEmoji} ${token.priceChange24h.toFixed(2)}%\n`;
          }
          
          if (token.marketCap) {
            const marketCapFormatted = token.marketCap >= 1000000 
              ? `$${(token.marketCap / 1000000).toFixed(2)}M`
              : `$${(token.marketCap / 1000).toFixed(2)}K`;
            summaryMessage += `• Market Cap: ${marketCapFormatted}\n`;
          }
          
          if (token.volume24h) {
            const volumeFormatted = token.volume24h >= 1000000 
              ? `$${(token.volume24h / 1000000).toFixed(2)}M`
              : `$${(token.volume24h / 1000).toFixed(2)}K`;
            summaryMessage += `• 24h Volume: ${volumeFormatted}\n`;
          }
          
          summaryMessage += `• Decimals: ${token.decimals}\n`;
          summaryMessage += `• Platform: ${token.platform.toUpperCase()}\n\n`;
        } else {
          summaryMessage += `⚠️ <b>Token Information:</b>\n`;
          summaryMessage += `• Status: Not found on CoinGecko\n`;
          summaryMessage += `• Address: <code>${toToken}</code>\n`;
          summaryMessage += `• Please verify this is the correct token\n\n`;
        }
        
        summaryMessage += `⚠️ <b>Please confirm:</b>\n`;
        summaryMessage += `• Verify the token address is correct\n`;
        summaryMessage += `• Check the amount is what you want\n`;
        summaryMessage += `• Ensure you have sufficient balance\n`;
        if (tokenDetails.success) {
          summaryMessage += `• Verify the token details above\n`;
        }
        summaryMessage += `\nReady to execute this swap?`;
        
        bot.sendMessage(chatId, summaryMessage, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Execute Swap', callback_data: 'execute_swap' },
                { text: '❌ Cancel', callback_data: 'trade_swap' }
              ],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
        
        // Set conversation state for confirmation
        conversationStates.set(chatId, 'AWAITING_SWAP_CONFIRMATION');
        
      } catch (error) {
        console.error('Error fetching token details:', error);
        
        // Delete loading message
        bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
          console.error('Error deleting loading message:', e)
        );
        
        // Show basic summary if token details fail
        let summaryMessage = '📋 <b>Swap Summary</b>\n\n';
        summaryMessage += `🔄 <b>Transaction Details:</b>\n`;
        summaryMessage += `• From: ${fromToken}\n`;
        summaryMessage += `• To: <code>${toToken}</code>\n`;
        summaryMessage += `• Amount: ${amount} ${fromToken}\n`;
        summaryMessage += `• Network: Base\n`;
        summaryMessage += `• Slippage: 1%\n\n`;
        summaryMessage += `⚠️ <b>Token Information:</b>\n`;
        summaryMessage += `• Status: Unable to fetch token details\n`;
        summaryMessage += `• Address: <code>${toToken}</code>\n`;
        summaryMessage += `• Please verify this is the correct token\n\n`;
        summaryMessage += `⚠️ <b>Please confirm:</b>\n`;
        summaryMessage += `• Verify the token address is correct\n`;
        summaryMessage += `• Check the amount is what you want\n`;
        summaryMessage += `• Ensure you have sufficient balance\n\n`;
        summaryMessage += `Ready to execute this swap?`;
        
        bot.sendMessage(chatId, summaryMessage, {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Execute Swap', callback_data: 'execute_swap' },
                { text: '❌ Cancel', callback_data: 'trade_swap' }
              ],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
        
        // Set conversation state for confirmation
        conversationStates.set(chatId, 'AWAITING_SWAP_CONFIRMATION');
      }
      
    } catch (error) {
      console.error('Error executing swap:', error);
      bot.sendMessage(chatId, `❌ <b>Error:</b> ${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
      conversationStates.delete(chatId);
    }
  } else if (conversationState === 'AWAITING_TOKEN_ADDRESS') {
    try {
      // Validate token address
      if (!text.startsWith('0x') || text.length !== 42) {
        bot.sendMessage(chatId, '❌ <b>Invalid Token Address</b>\n\nPlease enter a valid Ethereum contract address (0x...).', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
        return;
      }
      
      // Store token address
      const userData = users.get(userId) || {};
      userData.swapToToken = text;
      users.set(userId, userData);
      
      // Set conversation state for amount input
      conversationStates.set(chatId, 'AWAITING_SWAP_AMOUNT');
      
      const fromToken = userData.swapFromToken || 'Unknown';
      
      bot.sendMessage(chatId, `🎯 <b>Token Address Selected</b>\n\nSwapping from <b>${fromToken}</b> to <code>${text}</code>\n\nPlease enter the amount of ${fromToken} you want to swap:`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      
    } catch (error) {
      console.error('Error processing token address:', error);
      bot.sendMessage(chatId, `❌ <b>Error:</b> ${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'trade_swap' }],
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
      conversationStates.delete(chatId);
    }
  } else if (conversationState === 'AWAITING_CUSTOM_TOKEN') {
    try {
      // Validate token address
      if (!text.startsWith('0x') || text.length !== 42) {
        bot.sendMessage(chatId, '❌ <b>Invalid Token Address</b>\n\nPlease enter a valid Ethereum contract address (0x...).', {
          parse_mode: 'HTML' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Try Again', callback_data: 'swap_to_custom' }],
              [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
            ]
          }
        });
        return;
      }
      
      // Store custom token address
      const userData = users.get(userId) || {};
      userData.swapToToken = text;
      users.set(userId, userData);
      
      // Set conversation state for amount input
      conversationStates.set(chatId, 'AWAITING_SWAP_AMOUNT');
      
      const fromToken = userData.swapFromToken || 'Unknown';
      
      bot.sendMessage(chatId, `🎯 <b>Custom Token Selected</b>\n\nSwapping from <b>${fromToken}</b> to custom token\n\nPlease enter the amount of ${fromToken} you want to swap:`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          force_reply: true
        }
      });
      
    } catch (error) {
      console.error('Error processing custom token:', error);
      bot.sendMessage(chatId, `❌ <b>Error:</b> ${error.message}`, {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Try Again', callback_data: 'swap_to_custom' }],
            [{ text: '🏠 Back to Trading', callback_data: 'show_trade_options' }]
          ]
        }
      });
      conversationStates.delete(chatId);
    }
  } else if (conversationState === 'AWAITING_LIMIT_TOKEN_ADDRESS') {
    // Handle limit order token address input
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleLimitOrderTokenAddress(bot, chatId, text, users);
  } else if (conversationState === 'AWAITING_LIMIT_AMOUNT') {
    // Handle limit order amount input
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleLimitOrderAmount(bot, chatId, text, users);
  } else if (conversationState === 'AWAITING_LIMIT_PRICE') {
    // Handle limit order price input
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleLimitOrderPrice(bot, chatId, text, users);
  } else if (conversationState === 'AWAITING_LIMIT_CONFIRMATION') {
    // Handle limit order confirmation
    const limitOrderHandlers = await import('./handlers/limitOrderHandlers');
    await limitOrderHandlers.handleLimitOrderConfirmation(bot, chatId, users);
  }
});

// Export showMainMenu function for use in other modules
export { showMainMenu };