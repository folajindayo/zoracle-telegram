/**
 * Limit Order Handlers for Zoracle Telegram Bot
 */
import TelegramBot from "node-telegram-bot-api";
import { UserData } from "./walletHandlers";
import { 
  createLimitOrder, 
  getUserLimitOrders, 
  cancelLimitOrder, 
  getLimitOrder,
  updateLimitOrder,
  LimitOrderData 
} from "../../services/limitOrders";
import * as geckoTerminal from "../../services/geckoTerminal";

// Conversation states for limit orders
export const LIMIT_ORDER_STATES = {
  AWAITING_ORDER_TYPE: 'AWAITING_ORDER_TYPE',
  AWAITING_TOKEN_ADDRESS: 'AWAITING_TOKEN_ADDRESS',
  AWAITING_AMOUNT: 'AWAITING_AMOUNT',
  AWAITING_LIMIT_PRICE: 'AWAITING_LIMIT_PRICE',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION'
};

export async function handleShowLimitOrders(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Loading your limit orders...",
      { parse_mode: "HTML" as const }
    );

    // Get user's limit orders
    const ordersResult = await getUserLimitOrders(userId, 'all');

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (!ordersResult.success) {
      bot.sendMessage(
        chatId,
        `❌ Error loading limit orders: ${ordersResult.message}`,
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "limit_orders" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    const { orders, summary } = ordersResult;

    // Build orders message
    let ordersText = "⏱️ <b>Limit Orders Summary</b>\n\n";

    // Add summary statistics
    ordersText += `📊 <b>Summary:</b>\n`;
    ordersText += `• Total Orders: ${summary.totalOrders}\n`;
    ordersText += `• Pending: ${summary.pendingOrders}\n`;
    ordersText += `• Filled: ${summary.filledOrders}\n`;
    ordersText += `• Cancelled: ${summary.cancelledOrders}\n`;
    ordersText += `• Expired: ${summary.expiredOrders}\n\n`;

    if (summary.totalPendingValue > 0) {
      ordersText += `💰 Pending Value: $${summary.totalPendingValue.toFixed(2)}\n`;
    }
    if (summary.totalFilledValue > 0) {
      ordersText += `✅ Filled Value: $${summary.totalFilledValue.toFixed(2)}\n`;
    }

    if (orders.length === 0) {
      ordersText += "\n📍 <b>No limit orders found</b>\n\n";
      ordersText += "You don't have any limit orders yet. Create one to get started!";
    } else {
      ordersText += "\n📍 <b>Your Limit Orders:</b>\n\n";

      // Group orders by status
      const pendingOrders = orders.filter(o => o.status === 'pending');
      const filledOrders = orders.filter(o => o.status === 'filled');
      const cancelledOrders = orders.filter(o => o.status === 'cancelled');
      const expiredOrders = orders.filter(o => o.status === 'expired');

      // Show pending orders first
      if (pendingOrders.length > 0) {
        ordersText += "🟡 <b>Pending Orders:</b>\n\n";
        for (let i = 0; i < pendingOrders.length; i++) {
          const order = pendingOrders[i];
          ordersText += await formatLimitOrder(order, i + 1, true);
        }
      }

      // Show filled orders
      if (filledOrders.length > 0) {
        if (pendingOrders.length > 0) ordersText += "\n";
        ordersText += "🟢 <b>Filled Orders:</b>\n\n";
        for (let i = 0; i < filledOrders.length; i++) {
          const order = filledOrders[i];
          ordersText += await formatLimitOrder(order, i + 1, false);
        }
      }

      // Show cancelled orders
      if (cancelledOrders.length > 0) {
        if (pendingOrders.length > 0 || filledOrders.length > 0) ordersText += "\n";
        ordersText += "🔴 <b>Cancelled Orders:</b>\n\n";
        for (let i = 0; i < cancelledOrders.length; i++) {
          const order = cancelledOrders[i];
          ordersText += await formatLimitOrder(order, i + 1, false);
        }
      }

      // Show expired orders
      if (expiredOrders.length > 0) {
        if (pendingOrders.length > 0 || filledOrders.length > 0 || cancelledOrders.length > 0) ordersText += "\n";
        ordersText += "⚫ <b>Expired Orders:</b>\n\n";
        for (let i = 0; i < expiredOrders.length; i++) {
          const order = expiredOrders[i];
          ordersText += await formatLimitOrder(order, i + 1, false);
        }
      }
    }

    const ordersOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🟡 Pending", callback_data: "limit_orders_pending" },
            { text: "🟢 Filled", callback_data: "limit_orders_filled" }
          ],
          [
            { text: "🔴 Cancelled", callback_data: "limit_orders_cancelled" },
            { text: "⚫ Expired", callback_data: "limit_orders_expired" }
          ],
          [
            { text: "➕ New Order", callback_data: "limit_new" },
            { text: "🔄 Refresh", callback_data: "limit_orders" }
          ],
          [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
        ]
      },
      parse_mode: "HTML" as const
    };

    bot.sendMessage(chatId, ordersText, ordersOptions);
  } catch (error) {
    console.error("Error displaying limit orders:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while loading limit orders: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

export async function handleCreateLimitOrder(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();
    
    // Check if user has a wallet
    const walletManager = await import("../../services/cdpWallet");
    if (!walletManager.userHasWallet(userId)) {
      bot.sendMessage(
        chatId,
        "❌ You don't have a wallet set up yet. Please set up your wallet first.",
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔐 Setup Wallet", callback_data: "wallet_create" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    // Show order type selection
    bot.sendMessage(
      chatId,
      "⏱️ <b>Create Limit Order</b>\n\nSelect the type of limit order you want to create:",
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🟢 Buy Limit", callback_data: "limit_buy" },
              { text: "🔴 Sell Limit", callback_data: "limit_sell" }
            ],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error creating limit order:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

export async function handleLimitOrderType(
  bot: TelegramBot,
  chatId: number,
  orderType: 'buy' | 'sell',
  users: Map<string, UserData>,
  conversationStates: Map<number, string>
): Promise<void> {
  try {
    const userId = chatId.toString();
    
    // Store order type in user data
    const userData = users.get(userId) || {};
    userData.limitOrderType = orderType;
    users.set(userId, userData);

    const orderTypeText = orderType === 'buy' ? 'Buy' : 'Sell';
    
    bot.sendMessage(
      chatId,
      `⏱️ <b>${orderTypeText} Limit Order</b>\n\nPlease enter the token address you want to ${orderType === 'buy' ? 'buy' : 'sell'}:`,
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );

    // Set conversation state
    conversationStates.set(chatId, 'AWAITING_LIMIT_TOKEN_ADDRESS');
  } catch (error) {
    console.error("Error handling limit order type:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

export async function handleLimitOrderTokenAddress(
  bot: TelegramBot,
  chatId: number,
  tokenAddress: string,
  users: Map<string, UserData>,
  conversationStates: Map<number, string>
): Promise<void> {
  try {
    const userId = chatId.toString();
    
    console.log(`🔍 Processing token address: ${tokenAddress} for user ${userId}`);
    
    // Validate token address
    if (!tokenAddress || tokenAddress.length < 10) {
      bot.sendMessage(
        chatId,
        "❌ <b>Invalid Token Address</b>\n\nPlease enter a valid token address:",
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    // Get token info from GeckoTerminal
    console.log(`🔍 Fetching token data for address: ${tokenAddress}`);
    const tokenData = await geckoTerminal.getTokenData('base', tokenAddress);
    
    console.log(`🔍 Token data result:`, tokenData.success ? 'Success' : 'Failed');
    
    if (!tokenData.success) {
      bot.sendMessage(
        chatId,
        "❌ <b>Token Not Found</b>\n\nCould not find token information. Please check the address and try again:",
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    // Store token info in user data
    const userData = users.get(userId) || {};
    userData.limitOrderTokenAddress = tokenAddress;
    userData.limitOrderTokenSymbol = tokenData.token.symbol;
    userData.limitOrderTokenName = tokenData.token.name;
    users.set(userId, userData);

    const orderType = userData.limitOrderType;
    const orderTypeText = orderType === 'buy' ? 'Buy' : 'Sell';
    const currentPrice = tokenData.token.priceUsd;

    bot.sendMessage(
      chatId,
      `⏱️ <b>${orderTypeText} Limit Order</b>\n\n` +
      `Token: <b>${tokenData.token.symbol}</b> (${tokenData.token.name})\n` +
      `Current Price: <b>$${currentPrice.toFixed(6)}</b>\n\n` +
      `Enter the amount you want to ${orderType === 'buy' ? 'buy' : 'sell'} (in ${orderType === 'buy' ? 'ETH' : tokenData.token.symbol}):`,
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );

    // Set conversation state
    conversationStates.set(chatId, 'AWAITING_LIMIT_AMOUNT');
  } catch (error) {
    console.error("Error handling token address:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

export async function handleLimitOrderAmount(
  bot: TelegramBot,
  chatId: number,
  amount: string,
  users: Map<string, UserData>,
  conversationStates: Map<number, string>
): Promise<void> {
  try {
    const userId = chatId.toString();
    const userData = users.get(userId) || {};
    
    // Parse amount
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      bot.sendMessage(
        chatId,
        "❌ <b>Invalid Amount</b>\n\nPlease enter a valid positive number:",
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    // Store amount in user data
    userData.limitOrderAmount = parsedAmount;
    users.set(userId, userData);

    const orderType = userData.limitOrderType;
    const orderTypeText = orderType === 'buy' ? 'Buy' : 'Sell';
    const tokenSymbol = userData.limitOrderTokenSymbol;

    bot.sendMessage(
      chatId,
      `⏱️ <b>${orderTypeText} Limit Order</b>\n\n` +
      `Amount: <b>${parsedAmount} ${orderType === 'buy' ? 'ETH' : tokenSymbol}</b>\n\n` +
      `Enter the limit price (in USD) at which you want to ${orderType === 'buy' ? 'buy' : 'sell'}:`,
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );

    // Set conversation state
    conversationStates.set(chatId, 'AWAITING_LIMIT_PRICE');
  } catch (error) {
    console.error("Error handling amount:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

export async function handleLimitOrderPrice(
  bot: TelegramBot,
  chatId: number,
  price: string,
  users: Map<string, UserData>,
  conversationStates: Map<number, string>
): Promise<void> {
  try {
    const userId = chatId.toString();
    const userData = users.get(userId) || {};
    
    // Parse price
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      bot.sendMessage(
        chatId,
        "❌ <b>Invalid Price</b>\n\nPlease enter a valid positive price:",
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    // Store price in user data
    userData.limitOrderPrice = parsedPrice;
    users.set(userId, userData);

    // Get current token price for comparison
    const tokenData = await geckoTerminal.getTokenData('base', userData.limitOrderTokenAddress);
    const currentPrice = tokenData.success ? tokenData.token.priceUsd : 0;

    const orderType = userData.limitOrderType;
    const orderTypeText = orderType === 'buy' ? 'Buy' : 'Sell';
    const tokenSymbol = userData.limitOrderTokenSymbol;
    const amount = userData.limitOrderAmount;
    const limitPrice = parsedPrice;
    const totalValue = amount * limitPrice;

    let confirmationText = `⏱️ <b>${orderTypeText} Limit Order - Confirmation</b>\n\n`;
    confirmationText += `Token: <b>${tokenSymbol}</b>\n`;
    confirmationText += `Amount: <b>${amount} ${orderType === 'buy' ? 'ETH' : tokenSymbol}</b>\n`;
    confirmationText += `Limit Price: <b>$${limitPrice.toFixed(6)}</b>\n`;
    confirmationText += `Total Value: <b>$${totalValue.toFixed(2)}</b>\n\n`;

    if (currentPrice > 0) {
      confirmationText += `Current Price: <b>$${currentPrice.toFixed(6)}</b>\n`;
      
      if (orderType === 'buy') {
        if (currentPrice <= limitPrice) {
          confirmationText += `⚠️ <b>Warning:</b> Current price is at or below your limit price. Order may execute immediately.\n\n`;
        } else {
          confirmationText += `✅ Order will execute when price drops to $${limitPrice.toFixed(6)} or below.\n\n`;
        }
      } else {
        if (currentPrice >= limitPrice) {
          confirmationText += `⚠️ <b>Warning:</b> Current price is at or above your limit price. Order may execute immediately.\n\n`;
        } else {
          confirmationText += `✅ Order will execute when price rises to $${limitPrice.toFixed(6)} or above.\n\n`;
        }
      }
    }

    confirmationText += `Do you want to create this limit order?`;

    bot.sendMessage(
      chatId,
      confirmationText,
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Confirm", callback_data: "limit_confirm" },
              { text: "❌ Cancel", callback_data: "limit_cancel" }
            ],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );

    // Set conversation state
    conversationStates.set(chatId, 'AWAITING_LIMIT_CONFIRMATION');
  } catch (error) {
    console.error("Error handling price:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

export async function handleLimitOrderConfirmation(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>,
  conversationStates: Map<number, string>
): Promise<void> {
  try {
    const userId = chatId.toString();
    const userData = users.get(userId) || {};

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Creating your limit order...",
      { parse_mode: "HTML" as const }
    );

    // Create limit order
    const orderData: LimitOrderData = {
      telegramId: userId,
      orderType: userData.limitOrderType,
      tokenAddress: userData.limitOrderTokenAddress,
      tokenSymbol: userData.limitOrderTokenSymbol,
      tokenName: userData.limitOrderTokenName,
      amount: userData.limitOrderAmount,
      limitPrice: userData.limitOrderPrice,
      network: 'base',
      slippage: 1.0
    };

    const result = await createLimitOrder(orderData);

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (result.success) {
      const order = result.order;
      const orderTypeText = order.orderType === 'buy' ? 'Buy' : 'Sell';

      let successMessage = `✅ <b>Limit Order Created Successfully!</b>\n\n`;
      successMessage += `📋 <b>Order Details:</b>\n`;
      successMessage += `• Type: ${orderTypeText} Limit\n`;
      successMessage += `• Token: ${order.tokenSymbol}\n`;
      successMessage += `• Amount: ${order.amount} ${order.orderType === 'buy' ? 'ETH' : order.tokenSymbol}\n`;
      successMessage += `• Limit Price: $${order.limitPrice.toFixed(6)}\n`;
      successMessage += `• Total Value: $${order.totalValue.toFixed(2)}\n`;
      successMessage += `• Status: Pending\n\n`;
      successMessage += `🎯 <b>Next Steps:</b>\n`;
      successMessage += `• Monitor your orders\n`;
      successMessage += `• Check order status\n`;
      successMessage += `• Cancel if needed`;

      bot.sendMessage(chatId, successMessage, {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 View Orders", callback_data: "limit_orders" }],
            [{ text: "➕ New Order", callback_data: "limit_new" }],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      });
    } else {
      bot.sendMessage(chatId, `❌ <b>Failed to Create Order</b>\n\n${result.message}`, {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Try Again", callback_data: "limit_new" }],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      });
    }

    // Clear user data and conversation state
    users.delete(userId);
    conversationStates.delete(chatId);
  } catch (error) {
    console.error("Error confirming limit order:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

export async function handleCancelLimitOrder(
  bot: TelegramBot,
  chatId: number,
  orderId: string,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Cancelling your limit order...",
      { parse_mode: "HTML" as const }
    );

    // Cancel the order
    const result = await cancelLimitOrder(userId, orderId);

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (result.success) {
      bot.sendMessage(chatId, "✅ <b>Limit Order Cancelled Successfully!</b>", {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 View Orders", callback_data: "limit_orders" }],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      });
    } else {
      bot.sendMessage(chatId, `❌ <b>Failed to Cancel Order</b>\n\n${result.message}`, {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📋 View Orders", callback_data: "limit_orders" }],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      });
    }
  } catch (error) {
    console.error("Error cancelling limit order:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

async function formatLimitOrder(order: any, index: number, isActive: boolean): Promise<string> {
  const orderTypeEmoji = order.orderType === 'buy' ? '🟢' : '🔴';
  const orderTypeText = order.orderType === 'buy' ? 'Buy' : 'Sell';
  const statusEmoji = order.status === 'pending' ? '🟡' : 
                     order.status === 'filled' ? '🟢' : 
                     order.status === 'cancelled' ? '🔴' : '⚫';
  
  // Format price with appropriate precision
  const formatPrice = (price: number) => {
    if (price < 0.000001) return `$${price.toFixed(8)}`;
    if (price < 0.001) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  // Format USD value
  const formatUsdValue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  let orderText = `${index}. ${orderTypeEmoji} <b>${orderTypeText} ${order.tokenSymbol}</b> ${statusEmoji}\n`;
  orderText += `  ├ 💰 Amount: ${order.amount} ${order.orderType === 'buy' ? 'ETH' : order.tokenSymbol}\n`;
  orderText += `  ├ 💵 Limit Price: ${formatPrice(order.limitPrice)}\n`;
  orderText += `  ├ 💸 Total Value: ${formatUsdValue(order.totalValue)}\n`;
  
  if (order.notes) {
    orderText += `  ├ 📝 Notes: ${order.notes}\n`;
  }
  
  if (order.expiresAt) {
    const expiresAt = new Date(order.expiresAt);
    orderText += `  ├ ⏰ Expires: ${expiresAt.toLocaleDateString()}\n`;
  }
  
  if (order.filledAt) {
    const filledAt = new Date(order.filledAt);
    orderText += `  ├ ✅ Filled: ${filledAt.toLocaleDateString()}\n`;
  }
  
  if (order.txHash) {
    orderText += `  └ 🔗 TX: <code>${order.txHash}</code>\n`;
  }
  
  orderText += "\n";
  
  return orderText;
}

export default function initLimitOrderHandlers(
  bot: TelegramBot,
  users: Map<string, any>
): void {
  // Handler initialization will be done in the main bot file
  console.log("✅ Limit order handlers initialized");
} 