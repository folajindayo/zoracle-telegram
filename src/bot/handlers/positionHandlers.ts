/**
 * Position Handlers for Zoracle Telegram Bot
 */
import TelegramBot from "node-telegram-bot-api";
import { UserData } from "./walletHandlers";
import { 
  getUserPositions, 
  updatePositionWithMarketData, 
  closePosition, 
  updateAllOpenPositions, 
  getPositionStatistics,
  getUserPositionsWithRealTimeWorth,
  Position 
} from "../../services/positions";
import * as enhancedSwaps from "../../services/enhancedSwaps";

export async function handleShowPositions(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Loading your positions...",
      { parse_mode: "HTML" as const }
    );

    // Get user's positions
    const positionsResult = await getUserPositionsWithRealTimeWorth(userId, 'all');

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (!positionsResult.success) {
      bot.sendMessage(
        chatId,
        `❌ Error loading positions: ${positionsResult.message}`,
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "show_positions" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    const { positions, summary } = positionsResult;

    // Build positions message
    let positionsText = "🪙 <b>Summary of Positions</b>\n\n";

    // Add summary with emoji based on performance
    const pnlEmoji = summary.totalPnlPercentage >= 0 ? "🚀" : "📉";
    const pnlSign = summary.totalPnlPercentage >= 0 ? "+" : "";
    
    // Format USD values
    const formatUsdValue = (value: number) => {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
      return `$${value.toFixed(2)}`;
    };
    
    positionsText += `${pnlEmoji} <b>${pnlSign}${summary.totalPnlPercentage.toFixed(2)}%</b>\n`;
    positionsText += `  ├ 💰 Initial: ${formatUsdValue(summary.totalInitialValue)}\n`;
    positionsText += `  └ 💰 Worth: ${formatUsdValue(summary.totalCurrentValue)}\n\n`;

    if (positions.length === 0) {
      positionsText += "📍 <b>No positions found</b>\n\n";
      positionsText += "You don't have any positions yet. Start trading to see your positions here!";
    } else {
      positionsText += "📍 <b>List of your positions:</b>\n\n";

      // Group positions by status
      const openPositions = positions.filter(p => p.status === 'open');
      const closedPositions = positions.filter(p => p.status === 'closed');

      // Show open positions first
      if (openPositions.length > 0) {
        positionsText += "🟢 <b>Open Positions:</b>\n\n";
        for (let i = 0; i < openPositions.length; i++) {
          const position = openPositions[i];
          positionsText += await formatPosition(position, i + 1, true);
        }
      }

      // Show closed positions
      if (closedPositions.length > 0) {
        if (openPositions.length > 0) positionsText += "\n";
        positionsText += "🔴 <b>Closed Positions:</b>\n\n";
        for (let i = 0; i < closedPositions.length; i++) {
          const position = closedPositions[i];
          positionsText += await formatPosition(position, i + 1, false);
        }
      }
    }

    // Add warning about scam tokens
    positionsText += "\n\n⚠ <b>Note:</b> Scam tokens and tokens with low liquidity are automatically hidden from positions!";

    const positionsOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🟢 Open Positions", callback_data: "positions_open" },
            { text: "🔴 Closed Positions", callback_data: "positions_closed" }
          ],
          [
            { text: "🔄 Refresh Positions", callback_data: "show_positions" },
            { text: "➕ Add Position", callback_data: "add_position" }
          ],
          [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
        ]
      },
      parse_mode: "HTML" as const
    };

    bot.sendMessage(chatId, positionsText, positionsOptions);
  } catch (error) {
    console.error("Error displaying positions:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while loading your positions: ${error.message}`,
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

export async function handleShowOpenPositions(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Loading open positions...",
      { parse_mode: "HTML" as const }
    );

    // Get user's open positions
    const positionsResult = await getUserPositionsWithRealTimeWorth(userId, 'open');

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (!positionsResult.success) {
      bot.sendMessage(
        chatId,
        `❌ Error loading open positions: ${positionsResult.message}`,
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "positions_open" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    const { positions, summary } = positionsResult;

    // Build open positions message
    let positionsText = "🟢 <b>Open Positions</b>\n\n";

    if (positions.length === 0) {
      positionsText += "You don't have any open positions.\n\n";
      positionsText += "Start trading to see your open positions here!";
    } else {
      // Add summary
      const pnlEmoji = summary.totalPnlPercentage >= 0 ? "🚀" : "📉";
      const pnlSign = summary.totalPnlPercentage >= 0 ? "+" : "";
      
      positionsText += `${pnlEmoji} <b>${pnlSign}${summary.totalPnlPercentage.toFixed(2)}%</b>\n`;
      positionsText += `  ├ 💰 Initial: $${summary.totalInitialValue.toFixed(2)}\n`;
      positionsText += `  └ 💰 Worth: $${summary.totalCurrentValue.toFixed(2)}\n\n`;

      positionsText += "📍 <b>Your open positions:</b>\n\n";

      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        positionsText += await formatPosition(position, i + 1, true);
      }
    }

    const positionsOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Refresh", callback_data: "positions_open" },
            { text: "➕ Add Position", callback_data: "add_position" }
          ],
          [
            { text: "🔧 Fix Positions", callback_data: "fix_positions" },
            { text: "📊 All Positions", callback_data: "show_positions" }
          ],
          [
            { text: "🔴 Closed Positions", callback_data: "positions_closed" },
            { text: "📈 Trading Stats", callback_data: "trading_stats" }
          ],
          [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
        ]
      },
      parse_mode: "HTML" as const
    };

    bot.sendMessage(chatId, positionsText, positionsOptions);
  } catch (error) {
    console.error("Error displaying open positions:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while loading your open positions: ${error.message}`,
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

export async function handleShowClosedPositions(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Loading closed positions...",
      { parse_mode: "HTML" as const }
    );

    // Get user's closed positions
    const positionsResult = await getUserPositionsWithRealTimeWorth(userId, 'closed');

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (!positionsResult.success) {
      bot.sendMessage(
        chatId,
        `❌ Error loading closed positions: ${positionsResult.message}`,
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "positions_closed" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    const { positions, summary } = positionsResult;

    // Build closed positions message
    let positionsText = "🔴 <b>Closed Positions</b>\n\n";

    if (positions.length === 0) {
      positionsText += "You don't have any closed positions.\n\n";
      positionsText += "Close some positions to see your trading history here!";
    } else {
      positionsText += "📍 <b>Your closed positions:</b>\n\n";

      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        positionsText += await formatPosition(position, i + 1, false);
      }
    }

    const positionsOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Refresh", callback_data: "positions_closed" },
            { text: "🟢 Open Positions", callback_data: "positions_open" }
          ],
          [
            { text: "📊 All Positions", callback_data: "show_positions" },
            { text: "➕ Add Position", callback_data: "add_position" }
          ],
          [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
        ]
      },
      parse_mode: "HTML" as const
    };

    bot.sendMessage(chatId, positionsText, positionsOptions);
  } catch (error) {
    console.error("Error displaying closed positions:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while loading your closed positions: ${error.message}`,
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

/**
 * Format a position for display (TON-style format)
 * @param {Position} position - Position data
 * @param {number} index - Position index
 * @param {boolean} isOpen - Whether position is open
 * @returns {string} - Formatted position text
 */
async function formatPosition(position: Position, index: number, isOpen: boolean): Promise<string> {
  const pnlEmoji = position.pnlPercentage >= 0 ? "🚀" : "📉";
  const pnlSign = position.pnlPercentage >= 0 ? "+" : "";
  
  // Format token amount with appropriate decimals
  const formatTokenAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(2)}K`;
    return amount.toFixed(2);
  };

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
  
  let positionText = ` ${index}. ${pnlEmoji} <b>${position.tokenSymbol}</b>`;
  
  // Add token address link if available
  if (position.tonviewerUrl) {
    positionText += ` (<a href="${position.tonviewerUrl}">${position.tokenAddress}</a>)`;
  } else {
    positionText += ` (${position.tokenAddress})`;
  }
  
  positionText += ` | 📈 ${pnlEmoji} ${pnlSign}${position.pnlPercentage.toFixed(2)}%\n`;
  
  // Add position details in TON-style format
  positionText += `  ├ 💰 Initial: ${formatTokenAmount(position.initialAmount)} 🪙 (${formatUsdValue(position.initialUsdValue)})\n`;
  positionText += `  ├ 💰 Worth: ${formatTokenAmount(position.currentAmount)} 🪙 (${formatUsdValue(position.currentUsdValue)})\n`;
  positionText += `  ├ 💵 Price: ${formatPrice(position.currentPrice)}\n`;
  
  // Add FDV and LP info (placeholder for now)
  positionText += `  ├ 🔎 FDV: $0 • LP: $0\n`;
  
  // Add duration
  if (position.duration) {
    positionText += `  ├ 🕒 Duration: ${position.duration}\n`;
  }
  
  // Add links in TON-style format
  const links = [];
  if (position.dexToolsUrl) {
    links.push(`🔹DexTools (<a href="${position.dexToolsUrl}">link</a>)`);
  }
  if (position.swapUrl) {
    links.push(`🚀 Swap (<a href="${position.swapUrl}">link</a>)`);
  }
  
  if (links.length > 0) {
    positionText += `  └ ${links.join(" • ")}\n`;
  }
  
  positionText += "\n";
  
  return positionText;
}

export async function handleAddPosition(
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

    // Show swap options for creating a new position
    bot.sendMessage(
      chatId,
      "➕ <b>Add New Position</b>\n\nTo create a new position, you need to execute a swap. Choose your trading option:",
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Quick Swap", callback_data: "trade_swap" },
              { text: "🎯 Token Sniper", callback_data: "sniper_new" }
            ],
            [
              { text: "⏱️ Limit Order", callback_data: "limit_new" },
              { text: "👥 Copy Trade", callback_data: "show_copy_trading" }
            ],
            [
              { text: "📊 View Positions", callback_data: "show_positions" },
              { text: "🏠 Back to Main Menu", callback_data: "back_to_main" }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error handling add position:", error);
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

/**
 * Update all user positions with current market data
 */
export async function handleUpdatePositions(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Updating positions with current market data...",
      { parse_mode: "HTML" as const }
    );

    // Update all positions
    const result = await enhancedSwaps.updateAllUserPositions(userId);

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (!result.success) {
      bot.sendMessage(
        chatId,
        `❌ Error updating positions: ${result.message}`,
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "update_positions" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    bot.sendMessage(
      chatId,
      `✅ <b>Positions Updated Successfully!</b>\n\n📊 <b>Update Summary:</b>\n• Updated: ${result.updatedCount} positions\n• Errors: ${result.errorCount} positions\n\n🔄 <b>Next Steps:</b>\n• View your updated positions\n• Check PnL changes\n• Monitor market movements`,
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📊 View Positions", callback_data: "show_positions" }],
            [{ text: "📈 Trading Stats", callback_data: "trading_stats" }],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error updating positions:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while updating positions: ${error.message}`,
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

/**
 * Show user's trading statistics
 */
export async function handleShowTradingStats(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Loading trading statistics...",
      { parse_mode: "HTML" as const }
    );

    // Get trading statistics
    const statsResult = await enhancedSwaps.getUserTradingStats(userId);

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (!statsResult.success) {
      bot.sendMessage(
        chatId,
        `❌ Error loading trading statistics: ${statsResult.message}`,
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "trading_stats" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    const { statistics } = statsResult;

    // Build statistics message
    let statsText = "📊 <b>Trading Statistics</b>\n\n";

    // Overall performance
    const totalPnLEmoji = statistics.totalPnL >= 0 ? "🚀" : "📉";
    const totalPnLSign = statistics.totalPnL >= 0 ? "+" : "";
    
    statsText += `${totalPnLEmoji} <b>Total PnL: ${totalPnLSign}$${statistics.totalPnL.toFixed(2)}</b>\n`;
    statsText += `📈 <b>Average PnL per Trade: ${totalPnLSign}$${statistics.averagePnL.toFixed(2)}</b>\n\n`;

    // Trade counts
    statsText += "📋 <b>Trade Summary:</b>\n";
    statsText += `• Total Trades: ${statistics.totalTrades}\n`;
    statsText += `• Open Positions: ${statistics.openPositions}\n`;
    statsText += `• Closed Positions: ${statistics.closedPositions}\n`;
    statsText += `• Winning Trades: ${statistics.winningTrades}\n`;
    statsText += `• Losing Trades: ${statistics.losingTrades}\n`;
    statsText += `• Break-even Trades: ${statistics.breakEvenTrades}\n\n`;

    // Win rate
    const winRateEmoji = statistics.winRate >= 50 ? "🎯" : "📊";
    statsText += `${winRateEmoji} <b>Win Rate: ${statistics.winRate.toFixed(1)}%</b>\n\n`;

    // Best and worst trades
    if (statistics.largestWin > 0) {
      statsText += `🏆 <b>Best Trade: +$${statistics.largestWin.toFixed(2)}</b>\n`;
    }
    if (statistics.largestLoss < 0) {
      statsText += `📉 <b>Worst Trade: $${statistics.largestLoss.toFixed(2)}</b>\n`;
    }

    bot.sendMessage(
      chatId,
      statsText,
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📊 View Positions", callback_data: "show_positions" }],
            [{ text: "🔄 Update Positions", callback_data: "update_positions" }],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error showing trading stats:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while loading trading statistics: ${error.message}`,
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

/**
 * Update a specific position with current market data
 */
export async function handleUpdatePosition(
  bot: TelegramBot,
  chatId: number,
  positionId: string,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "⏳ Updating position with current market data...",
      { parse_mode: "HTML" as const }
    );

    // Update position
    const result = await updatePositionWithMarketData(userId, positionId);

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (!result.success) {
      bot.sendMessage(
        chatId,
        `❌ Error updating position: ${result.message}`,
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: `update_position_${positionId}` }],
              [{ text: "📊 View All Positions", callback_data: "show_positions" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
      return;
    }

    const position = result.position;
    const pnlEmoji = position.pnlPercentage >= 0 ? "🚀" : "📉";
    const pnlSign = position.pnlPercentage >= 0 ? "+" : "";

    // Format values for display
    const formatPrice = (price: number) => {
      if (price < 0.000001) return `$${price.toFixed(8)}`;
      if (price < 0.001) return `$${price.toFixed(6)}`;
      if (price < 1) return `$${price.toFixed(4)}`;
      return `$${price.toFixed(2)}`;
    };

    const formatUsdValue = (value: number) => {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
      return `$${value.toFixed(2)}`;
    };

    bot.sendMessage(
      chatId,
      `✅ <b>Position Updated Successfully!</b>\n\n📊 <b>${position.tokenSymbol}</b>\n• Current Price: ${formatPrice(position.currentPrice)}\n• PnL: ${pnlEmoji} ${pnlSign}${position.pnlPercentage.toFixed(2)}%\n• PnL USD: ${pnlSign}${formatUsdValue(position.pnlUsd)}\n• Duration: ${position.duration || 'N/A'}`,
      {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📊 View All Positions", callback_data: "show_positions" }],
            [{ text: "🔄 Update All Positions", callback_data: "update_positions" }],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  } catch (error) {
    console.error("Error updating position:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while updating position: ${error.message}`,
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

export async function handleFixPositions(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      "🔧 <b>Fixing Positions</b>\n\n⏳ Updating positions with actual wallet balances...",
      { parse_mode: "HTML" as const }
    );

    // Import positions service
    const positions = await import("../../services/positions");
    
    // Fix existing positions
    const result = await positions.fixExistingPositions(userId);

    // Delete loading message
    bot.deleteMessage(chatId, loadingMessage.message_id).catch(e => 
      console.error('Error deleting loading message:', e)
    );

    if (result.success) {
      let message = "✅ <b>Positions Fixed Successfully!</b>\n\n";
      message += `🔧 <b>Results:</b>\n`;
      message += `• Fixed: ${result.fixedCount} positions\n`;
      message += `• Errors: ${result.errorCount}\n\n`;
      
      if (result.fixedCount > 0) {
        message += "📊 <b>What was fixed:</b>\n";
        message += "• Updated token amounts to match actual wallet balances\n";
        message += "• Recalculated USD values and PnL\n";
        message += "• Corrected inflated values from swap data\n\n";
      }
      
      message += "🎯 <b>Next Steps:</b>\n";
      message += "• Check your open positions\n";
      message += "• Verify the corrected values\n";
      message += "• Continue trading with accurate data";

      bot.sendMessage(chatId, message, {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: [
            [{ text: "📊 View Open Positions", callback_data: "positions_open" }],
            [{ text: "📊 View All Positions", callback_data: "show_positions" }],
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      });
    } else {
      bot.sendMessage(
        chatId,
        `❌ Error fixing positions: ${result.message}`,
        {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Try Again", callback_data: "fix_positions" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }]
            ]
          }
        }
      );
    }
  } catch (error) {
    console.error("Error fixing positions:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while fixing positions: ${error.message}`,
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

// Initialize position handlers
export default function initPositionHandlers(
  bot: TelegramBot,
  users: Map<string, any>
): void {
  // Handle callback queries for position-related actions
  bot.on("callback_query", async (callbackQuery) => {
    if (!callbackQuery.data || !callbackQuery.message) return;

    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    try {
      switch (data) {
        case "show_positions":
          await handleShowPositions(bot, chatId, users);
          break;
        case "positions_open":
          await handleShowOpenPositions(bot, chatId, users);
          break;
        case "positions_closed":
          await handleShowClosedPositions(bot, chatId, users);
          break;
        case "add_position":
          await handleAddPosition(bot, chatId, users);
          break;
        case "update_positions":
          await handleUpdatePositions(bot, chatId, users);
          break;
        case "trading_stats":
          await handleShowTradingStats(bot, chatId, users);
          break;
        case "fix_positions":
          await handleFixPositions(bot, chatId, users);
          break;
        default:
          // Check if it's a position update callback
          if (data.startsWith("update_position_")) {
            const positionId = data.replace("update_position_", "");
            await handleUpdatePosition(bot, chatId, positionId, users);
          }
          break;
      }
    } catch (error) {
      console.error("Error handling position callback:", error);
      bot.sendMessage(
        chatId,
        "❌ An error occurred while processing your request. Please try again.",
        { parse_mode: "HTML" as const }
      );
    }
  });
} 