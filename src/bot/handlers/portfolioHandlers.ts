/**
 * Portfolio Handlers for Zoracle Telegram Bot
 */
import { getEthBalance, getTokenBalance, getTokenInfo, getWalletAddress  } from '../baseBot';
import { CONFIG  } from '../../config';
import { escapeMarkdown, escapeMarkdownPreserveFormat, markdownToHtml } from '../../utils/telegramUtils';

// Mock transaction history (in a real implementation, this would be stored in a database)
const mockTransactions = new Map();

module.exports = (bot, users) => {
  // Portfolio command
  bot.onText(/\/portfolio/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    try {
      // Import the walletManager directly to access real wallet balances
      const walletManager = require('../../services/cdpWallet');

      // Check if the wallet is unlocked
      const isUnlocked = walletManager.isWalletUnlocked(userId);
      if (!isUnlocked) {
        // Try to unlock the wallet
        if (user.pin) {
          await walletManager.quickUnlockWallet(userId, user.pin);
        } else {
          bot.sendMessage(chatId, 'Your wallet is locked. Please use /wallet to unlock it first.');
          return;
        }
      }

      // Get real wallet balances from UseZoracle API
      const balanceResult = await walletManager.getWalletBalances(userId);
      
      if (!balanceResult.success) {
        bot.sendMessage(chatId, `❌ Error: ${balanceResult.message}`);
        return;
      }

      const balances = balanceResult.balances || {};
      const tokens = Object.keys(balances);
      const address = balanceResult.address; // Get the wallet address
      
      // Simple price mapping for estimation
      const priceMapping = {
        'ETH': 3000,
        'WETH': 3000,
        'USDC': 1,
        'USDT': 1,
        'ZORA': 2.5,
        'DEFAULT': 1 // Default price for unknown tokens
      };

      // Calculate total portfolio value
      let totalValue = 0;
      
        // Build portfolio message
  let portfolioMessage = `
💼 <b>Your Portfolio</b>
📝 <b>Wallet Address:</b> ${address}
`;

      if (tokens.length === 0) {
        portfolioMessage += `\nTotal Value: N/A\n\n\nNo tokens found in your portfolio.`;
      } else {
        // Calculate total value and prepare the holdings display
        let holdingsText = `\n<b>Holdings:</b>\n`;
        
        for (const symbol of tokens) {
          const balance = parseFloat(balances[symbol]);
          const price = priceMapping[symbol] || priceMapping.DEFAULT;
          const value = balance * price;
          
          totalValue += value;
          holdingsText += `• ${symbol}: ${balances[symbol]} ($${value.toFixed(2)})\n`;
        }
        
        portfolioMessage += `Total Value: $${totalValue.toFixed(2)}\n${holdingsText}`;
      }
      
      portfolioMessage += `
Use /transactions to view your transaction history.
Use /pnl to calculate your profit/loss.
`;
      
      bot.sendMessage(chatId, portfolioMessage, { parse_mode: 'HTML' as const });
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error fetching portfolio: ${error.message}`);
    }
  });
  
  // Transactions command
  bot.onText(/\/transactions/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Get user's transactions (mock data)
    const userTransactions = mockTransactions.get(userId) || [];
    
    if (userTransactions.length === 0) {
      // If no transactions, add some mock data
      const mockTxs = [
        { 
          type: 'buy', 
          token: 'WETH', 
          amount: '0.5', 
          price: '3000', 
          timestamp: Date.now() - 86400000 * 3, // 3 days ago
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        },
        { 
          type: 'buy', 
          token: 'USDC', 
          amount: '100', 
          price: '1', 
          timestamp: Date.now() - 86400000 * 2, // 2 days ago
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        },
        { 
          type: 'buy', 
          token: 'ZORA', 
          amount: '25', 
          price: '2.5', 
          timestamp: Date.now() - 86400000, // 1 day ago
          txHash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456'
        }
      ];
      
      mockTransactions.set(userId, mockTxs);
      userTransactions.push(...mockTxs);
    }
    
    // Get wallet address
    const address = getWalletAddress(userId);
    
    // Build transactions message
    let txMessage = '📜 <b>Transaction History</b>\n';
    txMessage += `📝 <b>Wallet Address:</b> ${address}\n\n`;
    
    for (const tx of userTransactions) {
      const date = new Date(tx.timestamp).toLocaleDateString();
      txMessage += `${date} - ${tx.type.toUpperCase()} ${tx.amount} ${tx.token} @ $${tx.price}\n`;
      txMessage += `<a href="https://basescan.org/tx/${tx.txHash}">View on Basescan</a>\n\n`;
    }
    
          bot.sendMessage(chatId, txMessage, { parse_mode: 'HTML' as const });
  });
  
  // PnL (Profit and Loss) command
  bot.onText(/\/pnl/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Get user's transactions (mock data)
    const userTransactions = mockTransactions.get(userId) || [];
    
    if (userTransactions.length === 0) {
      bot.sendMessage(chatId, 'You don\'t have any transactions yet.');
      return;
    }
    
    // Calculate P&L (mock data)
    const pnlData = {
      totalInvested: 350, // $350 total invested
      currentValue: 425, // $425 current value
      profitLoss: 75, // $75 profit
      percentChange: 21.43 // 21.43% increase
    };
    
    // Get wallet address
    const address = getWalletAddress(userId);
    
    // Build PnL message
    let pnlMessage = `
📊 <b>Profit & Loss</b>
📝 <b>Wallet Address:</b> ${address}

Total Invested: $${pnlData.totalInvested.toFixed(2)}
Current Value: $${pnlData.currentValue.toFixed(2)}
`;
    
    if (pnlData.profitLoss >= 0) {
      pnlMessage += `Profit: $${pnlData.profitLoss.toFixed(2)} (+${pnlData.percentChange.toFixed(2)}%)`;
    } else {
      pnlMessage += `Loss: $${Math.abs(pnlData.profitLoss).toFixed(2)} (-${Math.abs(pnlData.percentChange).toFixed(2)}%)`;
    }
    
          bot.sendMessage(chatId, pnlMessage, { parse_mode: 'HTML' as const });
  });
}; 