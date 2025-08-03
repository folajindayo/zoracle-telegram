/**
 * Wallet Handlers for Zoracle Telegram Bot
 */
import * as walletManager from "../../services/cdpWallet";
import { CONFIG } from "../../config/index";
import TelegramBot from "node-telegram-bot-api";
import { WALLET_STATES } from "../../types/index";
import {
  escapeMarkdown,
  escapeMarkdownPreserveFormat,
  markdownToHtml,
} from "../../utils/telegramUtils";
import { ethers } from "ethers";
import {
  getTranslation,
  getLanguageName,
  getAvailableLanguages,
} from "../../utils/translations";

// Types
export interface UserData {
  walletAddress?: string;
  isCreating?: boolean;
  tempPK?: string;
  [key: string]: any;
}

export interface ConversationStates {
  WELCOME: number;
  WALLET_SETUP: number;
  COMPLETE: number;
}

export const STATES: ConversationStates = {
  WELCOME: 0,
  WALLET_SETUP: 1,
  COMPLETE: 2,
};

// Conversation states
const WALLET_STATE_VALUES = {
  IMPORT_PRIVATE_KEY: 1,
  WALLET_MENU: 2,
};

// In-memory storage for temporary data
const tempPins = new Map<string, any>();

// Helper functions
export async function getUserLanguage(telegramId: string): Promise<string> {
  try {
    const { UserOps } = await import("../../database/operations");
    return await UserOps.getUserLanguage(telegramId);
  } catch (error) {
    console.error("Error getting user language:", error);
    return "en"; // Default to English
  }
}

export async function getTranslatedMessage(
  key: string,
  telegramId: string
): Promise<string> {
  const language = await getUserLanguage(telegramId);
  return getTranslation(key, language);
}

export async function getWelcomeMessage(telegramId: string): Promise<string> {
  const title = await getTranslatedMessage("welcome_title", telegramId);
  const description = await getTranslatedMessage(
    "welcome_description",
    telegramId
  );
  const chatIdLabel = await getTranslatedMessage("chat_id_label", telegramId);

  return `${title}\n\n${description}\n\nTo get started, use /start your_wallet_address\n\n${chatIdLabel}`;
}

// Wallet handlers
export async function handleWalletCreate(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>,
  users: Map<string, UserData>
): Promise<void> {
  const userId = chatId.toString();

  try {
    // Create wallet without password or PIN
    const result = await walletManager.createWallet(userId, "", "");

    if (result.success) {
      // Mark user as setup complete in database
      try {
        const { UserOps } = await import("../../database/operations");
        await UserOps.upsertUser(userId, { setupComplete: true });
        console.log(
          `✅ Marked user ${userId} as setup complete after wallet creation`
        );
      } catch (error) {
        console.error(`❌ Failed to mark user as setup complete: ${error}`);
      }

      bot.sendMessage(
        chatId,
        `✅ <b>Wallet created successfully!</b>\n\nAddress: <code>${result.address}</code>\n\nYour wallet is ready to use!`,
        {
          parse_mode: "HTML" as const,
        }
      );

      // Show mnemonic if created new wallet
      if (result.mnemonic) {
        bot.sendMessage(
          chatId,
          `🔐 <b>IMPORTANT: Save Your Recovery Phrase</b>\n\n<code>${result.mnemonic}</code>\n\n⚠️ <b>NEVER share this with anyone!</b> Write it down and keep it in a safe place.`,
          {
            parse_mode: "HTML" as const,
          }
        );
      }

      // Mark user as setup complete and show main menu
      try {
        const { UserOps } = await import("../../database/operations");
        await UserOps.upsertUser(userId, { setupComplete: true });
        console.log(
          `✅ Marked user ${userId} as setup complete after wallet creation`
        );
      } catch (error) {
        console.error(`❌ Failed to mark user as setup complete: ${error}`);
      }

      conversationStates.set(chatId, STATES.COMPLETE);

      // Show main menu after successful wallet creation
      const { showMainMenu } = await import("../bot");
      await showMainMenu(chatId);
    } else {
      bot.sendMessage(chatId, `❌ Error creating wallet: ${result.message}`);
    }
  } catch (error) {
    console.error("Error creating wallet:", error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while creating your wallet. Please try again later."
    );
  }
}

export async function handleWalletImport(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  bot.sendMessage(
    chatId,
    "📥 <b>Import Wallet</b>\n\nPlease select import method:",
    {
      parse_mode: "HTML" as const,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔑 Private Key", callback_data: "import_privatekey" }],
          [{ text: "🔤 Seed Phrase", callback_data: "import_seed" }],
          [{ text: "↩️ Back", callback_data: "back_to_start" }],
        ],
      },
    }
  );
}

export async function handleImportPrivateKey(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  conversationStates.set(chatId, "AWAITING_PRIVATEKEY");
  bot.sendMessage(
    chatId,
    "🔑 *Import with Private Key*\n\nPlease enter your private key:\n\n⚠️ _Never share your private key with anyone else!_",
    {
      parse_mode: "HTML" as const,
      reply_markup: {
        force_reply: true,
      },
    }
  );
}

export async function handleImportSeed(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  conversationStates.set(chatId, "AWAITING_SEED");
  bot.sendMessage(
    chatId,
    "🔤 *Import with Seed Phrase*\n\nPlease enter your 12 or 24-word seed phrase:\n\n⚠️ _Never share your seed phrase with anyone else!_",
    {
      parse_mode: "HTML" as const,
      reply_markup: {
        force_reply: true,
      },
    }
  );
}

export async function handleWalletUnlock(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  const userId = chatId.toString();

  try {
    // Auto-unlock wallet without password
    const result = await walletManager.loadWallet(userId, "");

    if (result.success) {
      bot.sendMessage(
        chatId,
        "✅ <b>Wallet unlocked successfully!</b>\n\nYour wallet is now ready to use.",
        {
          parse_mode: "HTML" as const,
        }
      );
      conversationStates.set(chatId, STATES.COMPLETE);
    } else {
      bot.sendMessage(chatId, `❌ Failed to unlock wallet: ${result.message}`);
    }
  } catch (error) {
    console.error("Error unlocking wallet:", error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while unlocking your wallet. Please try again later."
    );
  }
}

export async function handleWalletQuickUnlock(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  const userId = chatId.toString();

  try {
    // Auto-unlock wallet without PIN
    const result = await walletManager.quickUnlockWallet(userId, "");

    if (result.success) {
      bot.sendMessage(
        chatId,
        "✅ <b>Wallet unlocked successfully!</b>\n\nYour wallet is now ready to use.",
        {
          parse_mode: "HTML" as const,
        }
      );
      conversationStates.set(chatId, STATES.COMPLETE);
    } else {
      bot.sendMessage(chatId, `❌ Failed to unlock wallet: ${result.message}`);
    }
  } catch (error) {
    console.error("Error unlocking wallet:", error);
    bot.sendMessage(
      chatId,
      "❌ An error occurred while unlocking your wallet. Please try again later."
    );
  }
}

export async function handleEnable2FA(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>
): Promise<void> {
  // Skip 2FA setup - auto-enable without verification
  conversationStates.set(chatId, STATES.COMPLETE);
  bot.sendMessage(
    chatId,
    "✅ <b>2FA setup skipped!</b>\n\nYour wallet is ready to use without 2FA.",
    {
      parse_mode: "HTML" as const,
    }
  );
}

export async function handleSkip2FA(
  bot: TelegramBot,
  chatId: number,
  conversationStates: Map<number, any>,
  showMainMenu: (chatId: number) => Promise<void>
): Promise<void> {
  conversationStates.set(chatId, STATES.COMPLETE);
  await showMainMenu(chatId);
}

export async function handleBackToStart(
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  const setupOptions = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔑 Create New Wallet", callback_data: "wallet_create" }],
        [{ text: "📥 Import Existing Wallet", callback_data: "wallet_import" }],
        [{ text: "❓ Help", callback_data: "show_help" }],
      ],
    },
    parse_mode: "HTML" as const,
  };

  bot.sendMessage(chatId, "What would you like to do?", setupOptions);
}

export default function initWalletHandlers(
  bot: TelegramBot,
  users: Map<string, any>
): void {
  // Wallet command
  bot.onText(/\/wallet/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    // Check if user already has a wallet
    const user = users.get(userId);

    if (user && user.wallet) {
      // User has a wallet, show wallet menu
      const walletAddress = user.wallet.address;

      try {
        const balanceResult = await walletManager.getWalletBalances(userId);
        const ethBalance = balanceResult.success
          ? balanceResult.balances.ETH
          : "0";

        const message = `
🔐 <b>Your Wallet</b>
Address: <code>${walletAddress}</code>
Balance: ${ethBalance} ETH

What would you like to do?
        `;

        const options = {
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "View Balance", callback_data: "wallet_balance" }],
              [{ text: "Lock Wallet", callback_data: "wallet_lock" }],
              [
                {
                  text: "🔑 Export Private Key",
                  callback_data: "wallet_export",
                },
              ],
            ],
          },
        };

        bot.sendMessage(chatId, message, options);
      } catch (error) {
        console.error("Error getting wallet balance:", error);
        bot.sendMessage(
          chatId,
          "❌ Error getting wallet balance. Please try again later."
        );
      }
    } else {
      // User doesn't have a wallet, show options to create or import
      const options = {
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
      };

      bot.sendMessage(
        chatId,
        "You don't have a wallet set up yet. Would you like to create a new wallet or import an existing one?",
        options
      );
    }
  });

  // Wallet button handler
  bot.on("callback_query", async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();

    if (action === "wallet_create") {
      // Create wallet immediately without password
      try {
        const result = await walletManager.createWallet(userId, "", "");

        if (result.success) {
          // Mark user as setup complete in database
          try {
            const { UserOps } = await import("../../database/operations");
            await UserOps.upsertUser(userId, { setupComplete: true });
            console.log(
              `✅ Marked user ${userId} as setup complete after wallet creation`
            );
          } catch (error) {
            console.error(`❌ Failed to mark user as setup complete: ${error}`);
          }

          bot.sendMessage(
            chatId,
            `✅ <b>Wallet created successfully!</b>\n\nAddress: <code>${result.address}</code>\n\nYour wallet is ready to use!`,
            {
              parse_mode: "HTML" as const,
            }
          );

          // Show mnemonic if created new wallet
          if (result.mnemonic) {
            bot.sendMessage(
              chatId,
              `🔐 <b>IMPORTANT: Save Your Recovery Phrase</b>\n\n<code>${result.mnemonic}</code>\n\n⚠️ <b>NEVER share this with anyone!</b> Write it down and keep it in a safe place.`,
              {
                parse_mode: "HTML" as const,
              }
            );
          }

          // Show main menu after successful wallet creation
          const { showMainMenu } = await import("../bot");
          await showMainMenu(chatId);
        } else {
          bot.sendMessage(
            chatId,
            `❌ Error creating wallet: ${result.message}`
          );
        }
      } catch (error) {
        console.error("Error creating wallet:", error);
        bot.sendMessage(
          chatId,
          "❌ An error occurred while creating your wallet. Please try again later."
        );
      }

      bot.answerCallbackQuery(callbackQuery.id);
    } else if (action === "wallet_import") {
      // Ask for private key
      bot.sendMessage(chatId, "Please enter your private key:");
      bot.answerCallbackQuery(callbackQuery.id);
    } else if (action === "wallet_balance") {
      // Show wallet balance
      if (!walletManager.userHasWallet(userId)) {
        bot.sendMessage(
          chatId,
          "You don't have a wallet set up yet. Use /wallet to set up a wallet."
        );
        bot.answerCallbackQuery(callbackQuery.id);
        return;
      }

      // Auto-unlock wallet if needed
      if (!walletManager.isWalletUnlocked(userId)) {
        const unlockResult = await walletManager.loadWallet(userId, "");
        if (!unlockResult.success) {
          bot.sendMessage(
            chatId,
            `❌ Failed to unlock wallet: ${unlockResult.message}`
          );
          bot.answerCallbackQuery(callbackQuery.id);
          return;
        }
      }

      try {
        const walletAddress =
          (await walletManager.getUseZoracleAddress(userId)) ||
          walletManager.getWalletAddress(userId);
        const balanceResult = await walletManager.getWalletBalances(userId);
        const ethBalance = balanceResult.success
          ? balanceResult.balances.ETH
          : "0";

        // Format additional token balances if available
        let additionalBalances = "";
        if (balanceResult.success && balanceResult.balances) {
          Object.entries(balanceResult.balances).forEach(([token, amount]) => {
            if (token !== "ETH") {
              additionalBalances += `\n${token}: ${amount}`;
            }
          });
        }

        bot.sendMessage(
          chatId,
          `💰 <b>Wallet Balance</b>\nETH: ${ethBalance}${additionalBalances}`,
          { parse_mode: "HTML" as const }
        );
        bot.answerCallbackQuery(callbackQuery.id);
      } catch (error) {
        console.error("Error getting wallet balance:", error);
        bot.sendMessage(
          chatId,
          "❌ Error getting wallet balance. Please try again later."
        );
        bot.answerCallbackQuery(callbackQuery.id, {
          text: "Error getting balance",
        });
      }
    } else if (action === "wallet_lock") {
      // Lock wallet
      users.delete(userId);

      bot.sendMessage(
        chatId,
        "🔒 Your wallet has been locked. Use /wallet to unlock it."
      );
      bot.answerCallbackQuery(callbackQuery.id);
    } else if (action === "wallet_export") {
      // Export private key (no PIN required)
      try {
        const walletManager = await import("../../services/cdpWallet");
        const result = await walletManager.getWallet(userId);

        if (result.success && result.privateKey) {
          bot.sendMessage(
            chatId,
            `🔑 <b>Your Private Key</b>\n\n<code>${result.privateKey}</code>\n\n⚠️ <b>Keep this safe and never share it!</b>`,
            {
              parse_mode: "HTML" as const,
            }
          );
        } else {
          bot.sendMessage(
            chatId,
            "❌ Could not retrieve private key. Please try again later."
          );
        }
      } catch (error) {
        console.error("Error exporting private key:", error);
        bot.sendMessage(
          chatId,
          "❌ Error exporting private key. Please try again later."
        );
      }

      bot.answerCallbackQuery(callbackQuery.id);
    }
  });

  // Handle private key import
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text;

    // Check if we're waiting for a private key
    const userState = tempPins.get(userId);

    if (!userState) return;

    if (userState.step === WALLET_STATE_VALUES.IMPORT_PRIVATE_KEY) {
      // Import wallet without password
      try {
        const result = await walletManager.importWallet(userId, text, "", "");

        if (result.success) {
          // Mark user as setup complete in database
          try {
            const { UserOps } = await import("../../database/operations");
            await UserOps.upsertUser(userId, { setupComplete: true });
            console.log(
              `✅ Marked user ${userId} as setup complete after wallet import`
            );
          } catch (error) {
            console.error(`❌ Failed to mark user as setup complete: ${error}`);
          }

          bot.sendMessage(
            chatId,
            `✅ <b>Wallet imported successfully!</b>\n\nAddress: <code>${result.address}</code>\n\nYour wallet is ready to use!`,
            {
              parse_mode: "HTML" as const,
            }
          );

          // Show main menu after successful wallet import
          const { showMainMenu } = await import("../bot");
          await showMainMenu(chatId);
        } else {
          bot.sendMessage(
            chatId,
            `❌ Error importing wallet: ${result.message}`
          );
        }
      } catch (error) {
        console.error("Error importing wallet:", error);
        bot.sendMessage(
          chatId,
          "❌ An error occurred while importing your wallet. Please try again later."
        );
      }

      // Delete the message containing the private key for security
      bot
        .deleteMessage(chatId, msg.message_id)
        .catch((e) => console.log("Could not delete message with private key"));

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
      bot.sendMessage(
        chatId,
        "You don't have a wallet set up yet. Use /wallet to set up a wallet."
      );
      return;
    }

    try {
      const walletAddress = user.wallet.address;
      const balanceResult = await walletManager.getWalletBalances(userId);
      const ethBalance = balanceResult.success
        ? balanceResult.balances.ETH
        : "0";

      // Format additional token balances if available
      let additionalBalances = "";
      if (balanceResult.success && balanceResult.balances) {
        Object.entries(balanceResult.balances).forEach(([token, amount]) => {
          if (token !== "ETH") {
            additionalBalances += `\n${token}: ${amount}`;
          }
        });
      }

      bot.sendMessage(
        chatId,
        `💰 <b>Wallet Balance</b>\nETH: ${ethBalance}${additionalBalances}`,
        { parse_mode: "HTML" as const }
      );
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      bot.sendMessage(
        chatId,
        "❌ Error getting wallet balance. Please try again later."
      );
    }
  });
}
