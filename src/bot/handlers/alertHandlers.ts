/**
 * Alert Handlers for Zoracle Telegram Bot
 */
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import { CONFIG } from "../../config";
import {
  escapeMarkdown,
  escapeMarkdownPreserveFormat,
  markdownToHtml,
} from "../../utils/telegramUtils";

// In-memory alert storage (in a real implementation, this would be stored in a database)
const alerts = new Map();

// Alert states for conversation
const ALERT_STATES = {
  AWAITING_TOKEN: 1,
  AWAITING_PRICE_HIGH: 2,
  AWAITING_PRICE_LOW: 3,
};

// In-memory alert state storage
const alertStates = new Map();

// Handler functions
export async function handleShowAlerts(
  bot: TelegramBot,
  chatId: number,
  callbackQuery: any
): Promise<void> {
  const userId = callbackQuery.from.id.toString();
  
  // Get user's alerts
  const userAlerts = alerts.get(userId) || [];

  if (userAlerts.length === 0) {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Add Alert", callback_data: "add_alert" }],
        ],
      },
    };

    bot.sendMessage(chatId, "You don't have any alerts set up yet.", options);
    return;
  }

  // Build alerts message
  let message = "🔔 <b>Your Alerts</b>\n\n";

  for (let i = 0; i < userAlerts.length; i++) {
    const alert = userAlerts[i];
    message += `<b>${i + 1}. ${alert.tokenInfo.name} (${
      alert.tokenInfo.symbol
    })</b>\n`;

    if (alert.priceHigh) {
      message += `Price Above: ${alert.priceHigh} ETH\n`;
    }

    if (alert.priceLow) {
      message += `Price Below: ${alert.priceLow} ETH\n`;
    }

    message += "\n";
  }

  // Add inline keyboard buttons for managing alerts
  const inlineKeyboard = [
    [{ text: "➕ Add Alert", callback_data: "add_alert" }],
  ];

  // Add a remove button for each alert
  for (let i = 0; i < userAlerts.length; i++) {
    inlineKeyboard.push([
      {
        text: `❌ Remove Alert ${i + 1}`,
        callback_data: `remove_alert_${i}`,
      },
    ]);
  }

  const options = {
    parse_mode: "HTML" as const,
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  };

  bot.sendMessage(chatId, message, options);
}

export async function handleAddAlert(
  bot: TelegramBot,
  chatId: number,
  callbackQuery: any
): Promise<void> {
  const userId = callbackQuery.from.id.toString();
  
  // Start alert creation flow
  alertStates.set(userId, { state: ALERT_STATES.AWAITING_TOKEN });

  bot.sendMessage(
    chatId,
    "Please enter the token address you want to set an alert for:"
  );
}

export async function handleRemoveAlert(
  bot: TelegramBot,
  chatId: number,
  callbackQuery: any,
  alertIndex: number
): Promise<void> {
  const userId = callbackQuery.from.id.toString();
  
  // Get user's alerts
  const userAlerts = alerts.get(userId) || [];

  if (alertIndex >= 0 && alertIndex < userAlerts.length) {
    // Remove the alert
    const removedAlert = userAlerts.splice(alertIndex, 1)[0];

    // Update alerts
    alerts.set(userId, userAlerts);

    bot.answerCallbackQuery(callbackQuery.id, {
      text: `Alert for ${removedAlert.tokenInfo.symbol} removed!`,
      show_alert: true,
    });

    // Update the message
    if (userAlerts.length === 0) {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Add Alert", callback_data: "add_alert" }],
          ],
        },
      };

      bot.editMessageText("You don't have any alerts set up yet.", {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...options,
      });
    } else {
      // Rebuild alerts message
      let message = "🔔 <b>Your Alerts</b>\n\n";

      for (let i = 0; i < userAlerts.length; i++) {
        const alert = userAlerts[i];
        message += `<b>${i + 1}. ${alert.tokenInfo.name} (${
          alert.tokenInfo.symbol
        })</b>\n`;

        if (alert.priceHigh) {
          message += `Price Above: ${alert.priceHigh} ETH\n`;
        }

        if (alert.priceLow) {
          message += `Price Below: ${alert.priceLow} ETH\n`;
        }

        message += "\n";
      }

      // Add inline keyboard buttons for managing alerts
      const inlineKeyboard = [
        [{ text: "➕ Add Alert", callback_data: "add_alert" }],
      ];

      // Add a remove button for each alert
      for (let i = 0; i < userAlerts.length; i++) {
        inlineKeyboard.push([
          {
            text: `❌ Remove Alert ${i + 1}`,
            callback_data: `remove_alert_${i}`,
          },
        ]);
      }

      const options = {
        parse_mode: "HTML" as const,
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      };

      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        ...options,
      });
    }
  } else {
    bot.answerCallbackQuery(callbackQuery.id, { text: "Alert not found." });
  }
}

// Initialize alert handlers
export default function initAlertHandlers(
  bot: TelegramBot,
  users: Map<string, any>
): void {
  // Handle callback queries for alert-related actions
  bot.on("callback_query", async (callbackQuery) => {
    if (!callbackQuery.data || !callbackQuery.message) return;

    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    try {
      switch (data) {
        case "show_alerts":
          await handleShowAlerts(bot, chatId, callbackQuery);
          break;
        case "add_alert":
          await handleAddAlert(bot, chatId, callbackQuery);
          break;
        default:
          // Handle dynamic alert actions
          if (data.startsWith("remove_alert_")) {
            const alertIndex = parseInt(data.replace("remove_alert_", ""));
            await handleRemoveAlert(bot, chatId, callbackQuery, alertIndex);
          }
          break;
      }
    } catch (error) {
      console.error("Error handling alert callback:", error);
      bot.sendMessage(
        chatId,
        "❌ An error occurred while processing your request. Please try again.",
        { parse_mode: "HTML" as const }
      );
    }
  });
}
