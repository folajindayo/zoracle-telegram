/**
 * Portfolio Handlers for Zoracle Telegram Bot
 */
import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import axios from "axios";
import { UserData } from "./walletHandlers";
import { CONFIG } from "../../config/index";

export async function handleShowPortfolio(
  bot: TelegramBot,
  chatId: number,
  users: Map<string, UserData>
): Promise<void> {
  try {
    const userId = chatId.toString();

    // Get user data
    if (!users.has(userId)) {
      users.set(userId, {});
    }

    // Make direct API call to get balances
    const userName = `zoracle-${userId}`;
    const baseURL = CONFIG.ZORACLE_API_URL;
    const response = await axios.get(`${baseURL}/api/balances/${userName}`, {
      timeout: 10000,
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    if (!response.data || !response.data.success) {
      bot.sendMessage(
        chatId,
        `❌ Failed to load portfolio: ${
          response.data?.message || "Unknown error"
        }`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
            ],
          },
        }
      );
      return;
    }

    // Process the balance data from API response
    const balanceData = response.data.data;
    const balances = balanceData?.balances || [];
    const totalUsdValue = balanceData?.totalUsdValue || 0;

    // Debug logging
    console.log("Debug - balanceData:", JSON.stringify(balanceData, null, 2));
    console.log("Debug - balances array:", balances);
    console.log("Debug - balances.length:", balances.length);
    console.log("Debug - totalUsdValue:", totalUsdValue);

    let portfolioText = "💰 <b>Your Portfolio</b>\n\n";

    // Add total value header using API response
    const formattedTotalValue =
      totalUsdValue < 0.01
        ? totalUsdValue.toFixed(6)
        : totalUsdValue.toFixed(2);
    portfolioText += `Total Value: $${formattedTotalValue}\n\n`;

    if (balances.length === 0) {
      portfolioText += "No tokens found in your portfolio.\n";
    } else {
      portfolioText += "Holdings:\n";

      // Process each token balance
      for (const balance of balances) {
        const token = balance.token;
        const amount = balance.amount;
        const usdValue = balance.usdValue || 0;

        // Format balance with smart decimal places
        const balanceNum = parseFloat(amount.formatted);
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
        const formattedUsdValue =
          usdValue < 0.01 ? usdValue.toFixed(4) : usdValue.toFixed(2);

        // Add token to portfolio message
        portfolioText += `• ${token.symbol}: ${formattedBalance} ($${formattedUsdValue})\n`;
      }
    }

    const portfolioOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📊 Transaction History",
              callback_data: "show_transactions",
            },
          ],
          [{ text: "🔄 Refresh Portfolio", callback_data: "show_portfolio" }],
          [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
        ],
      },
      parse_mode: "HTML" as const,
    };

    bot.sendMessage(chatId, portfolioText, portfolioOptions);
  } catch (error) {
    console.error("Error displaying portfolio:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while loading your portfolio: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
          ],
        },
      }
    );
  }
}

export async function handleShowTransactions(
  bot: TelegramBot,
  chatId: number,
  callbackQuery: any
): Promise<void> {
  try {
    const userId = callbackQuery.from.id.toString();

    // Check if user has a wallet
    const walletManager = await import("../../services/cdpWallet");

    if (!walletManager.userHasWallet(userId)) {
      bot.sendMessage(
        chatId,
        "❌ You don't have a wallet set up yet. Please use /wallet to create one."
      );
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
        return;
      }
    }

    // Get UseZoracle API wallet address
    const address = await walletManager.getUseZoracleAddress(userId);

    if (!address) {
      bot.sendMessage(
        chatId,
        "❌ Unable to get wallet address. Please make sure your wallet is unlocked."
      );
      return;
    }

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      `🔍 <b>Loading Transaction History</b>\n📝 <b>Wallet:</b> ${address}\n\nFetching your transactions from the blockchain...`,
      { parse_mode: "HTML" as const }
    );

    // Import blockchain explorer service
    const { getTransactions } = await import("../../services/blockExplorer");

    // Get real transaction data
    const txResult = await getTransactions(address, 5);

    // Check if we got data successfully
    if (!txResult.success || !txResult.data || txResult.data.length === 0) {
      bot.editMessageText(
        `📜 <b>Transaction History</b>\n📝 <b>Wallet Address:</b> ${address}\n\nNo transactions found for this wallet address. This could be a new wallet or our explorer API might be experiencing issues.`,
        {
          chat_id: chatId,
          message_id: loadingMessage.message_id,
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Refresh", callback_data: "refresh_history" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
            ],
          },
        }
      );
      return;
    }

    // Build transactions message
    let txMessage = `📜 <b>Transaction History</b>\n`;
    txMessage += `📝 <b>Wallet Address:</b> ${address}\n\n`;

    // Parse and display transactions
    for (const tx of txResult.data) {
      // Format the date
      const date = new Date(tx.timestamp).toLocaleDateString();
      const time = new Date(tx.timestamp).toLocaleTimeString();

      // Format transaction type
      let typeIcon = "↔️";
      let typeText = "INTERACTION";

      if (tx.from && tx.to && tx.from.toLowerCase() === address.toLowerCase()) {
        typeIcon = "📤";
        typeText = "SENT";
      } else if (tx.to && tx.to.toLowerCase() === address.toLowerCase()) {
        typeIcon = "📥";
        typeText = "RECEIVED";
      }

      // Format the value
      const valueText = tx.value ? `${tx.value.toFixed(6)} ETH` : "";

      // Transaction status
      const statusIcon = tx.status === "success" ? "✅" : "❌";

      // Build transaction line
      txMessage += `${typeIcon} <b>${typeText}</b> ${statusIcon} - ${date} ${time}\n`;
      if (valueText) {
        txMessage += `Amount: ${valueText}\n`;
      }
      txMessage += `<a href="https://basescan.org/tx/${tx.txHash}">View on Basescan</a>\n\n`;
    }

    // Add options to return to portfolio or main menu
    const options = {
      parse_mode: "HTML" as const,
      chat_id: chatId,
      message_id: loadingMessage.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Refresh", callback_data: "refresh_history" }],
          [{ text: "⬅️ Back to Portfolio", callback_data: "show_portfolio" }],
          [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
        ],
      },
    };

    bot.editMessageText(txMessage, options);
  } catch (error) {
    console.error("Error displaying transaction history:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while loading your transaction history: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
          ],
        },
      }
    );
  }
}

export async function handleRefreshHistory(
  bot: TelegramBot,
  chatId: number,
  callbackQuery: any
): Promise<void> {
  try {
    const userId = callbackQuery.from.id.toString();

    // Check if user has a wallet
    const walletManager = await import("../../services/cdpWallet");

    if (!walletManager.userHasWallet(userId)) {
      bot.sendMessage(
        chatId,
        "❌ You don't have a wallet set up yet. Please use /wallet to create one."
      );
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
        return;
      }
    }

    // Clear address cache to force fresh API call
    walletManager.clearAddressCache(userId);

    // Get UseZoracle API wallet address
    const address = await walletManager.getUseZoracleAddress(userId);

    if (!address) {
      bot.sendMessage(
        chatId,
        "❌ Unable to get wallet address. Please make sure your wallet is unlocked."
      );
      return;
    }

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      chatId,
      `🔍 <b>Refreshing Transaction History</b>\n📝 <b>Wallet:</b> ${address}\n\nFetching your latest transactions from the blockchain...`,
      { parse_mode: "HTML" as const }
    );

    // Import blockchain explorer service
    const { getTransactions } = await import("../../services/blockExplorer");

    // Get real transaction data (force refresh to bypass cache)
    const txResult = await getTransactions(address, 5, true);

    // Check if we got data successfully
    if (!txResult.success || !txResult.data || txResult.data.length === 0) {
      bot.editMessageText(
        `📜 <b>Transaction History</b>\n📝 <b>Wallet Address:</b> ${address}\n\nNo transactions found for this wallet address. This could be a new wallet or our explorer API might be experiencing issues.`,
        {
          chat_id: chatId,
          message_id: loadingMessage.message_id,
          parse_mode: "HTML" as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Refresh", callback_data: "refresh_history" }],
              [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
            ],
          },
        }
      );
      return;
    }

    // Build transactions message
    let txMessage = `📜 <b>Transaction History</b>\n`;
    txMessage += `📝 <b>Wallet Address:</b> ${address}\n\n`;

    // Parse and display transactions
    for (const tx of txResult.data) {
      // Format the date
      const date = new Date(tx.timestamp).toLocaleDateString();
      const time = new Date(tx.timestamp).toLocaleTimeString();

      // Format transaction type
      let typeIcon = "↔️";
      let typeText = "INTERACTION";

      if (tx.from && tx.to && tx.from.toLowerCase() === address.toLowerCase()) {
        typeIcon = "📤";
        typeText = "SENT";
      } else if (tx.to && tx.to.toLowerCase() === address.toLowerCase()) {
        typeIcon = "📥";
        typeText = "RECEIVED";
      }

      // Format the value
      const valueText = tx.value ? `${tx.value.toFixed(6)} ETH` : "";

      // Transaction status
      const statusIcon = tx.status === "success" ? "✅" : "❌";

      // Build transaction line
      txMessage += `${typeIcon} <b>${typeText}</b> ${statusIcon} - ${date} ${time}\n`;
      if (valueText) {
        txMessage += `Amount: ${valueText}\n`;
      }
      txMessage += `<a href="https://basescan.org/tx/${tx.txHash}">View on Basescan</a>\n\n`;
    }

    // Add options to return to portfolio or main menu
    const options = {
      parse_mode: "HTML" as const,
      chat_id: chatId,
      message_id: loadingMessage.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Refresh", callback_data: "refresh_history" }],
          [{ text: "⬅️ Back to Portfolio", callback_data: "show_portfolio" }],
          [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
        ],
      },
    };

    bot.editMessageText(txMessage, options);
  } catch (error) {
    console.error("Error refreshing transaction history:", error);
    bot.sendMessage(
      chatId,
      `❌ An error occurred while refreshing your transaction history: ${error.message}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Back to Main Menu", callback_data: "back_to_main" }],
          ],
        },
      }
    );
  }
}
