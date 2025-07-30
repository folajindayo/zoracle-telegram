/**
 * Portfolio Handlers for Zoracle Telegram Bot
 */
const { getEthBalance, getTokenBalance, getTokenInfo } = require('../baseBot');
const { CONFIG } = require('../../config');

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
      // Get ETH balance
      const ethBalance = await getEthBalance(user.wallet.address);
      
      // In a real implementation, we would fetch all tokens owned by the user
      // For now, we'll just show ETH and mock some token balances
      
      // Mock token balances (in a real implementation, these would be fetched from the blockchain)
      const mockTokens = [
        { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', balance: '0.5', price: 3000 },
        { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDC', balance: '100', price: 1 },
        { address: '0x940181a94a35a4569e4529a3cdfb74e38fd98631', symbol: 'ZORA', balance: '25', price: 2.5 }
      ];
      
      // Calculate total portfolio value
      let totalValue = parseFloat(ethBalance) * 3000; // Assuming ETH price is $3000
      
      for (const token of mockTokens) {
        totalValue += parseFloat(token.balance) * token.price;
      }
      
      // Build portfolio message
      let portfolioMessage = `
💼 *Your Portfolio*
Total Value: $${totalValue.toFixed(2)}

*Holdings:*
• ETH: ${ethBalance} ($${(parseFloat(ethBalance) * 3000).toFixed(2)})
`;
      
      for (const token of mockTokens) {
        portfolioMessage += `• ${token.symbol}: ${token.balance} ($${(parseFloat(token.balance) * token.price).toFixed(2)})\n`;
      }
      
      portfolioMessage += `
Use /transactions to view your transaction history.
Use /pnl to calculate your profit/loss.
`;
      
      bot.sendMessage(chatId, portfolioMessage, { parse_mode: 'Markdown' });
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
    
    // Build transactions message
    let txMessage = '📜 *Transaction History*\n\n';
    
    for (const tx of userTransactions) {
      const date = new Date(tx.timestamp).toLocaleDateString();
      txMessage += `${date} - ${tx.type.toUpperCase()} ${tx.amount} ${tx.token} @ $${tx.price}\n`;
      txMessage += `[View on Basescan](https://basescan.org/tx/${tx.txHash})\n\n`;
    }
    
    bot.sendMessage(chatId, txMessage, { parse_mode: 'Markdown' });
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
    
    // Build PnL message
    let pnlMessage = `
📊 *Profit & Loss*

Total Invested: $${pnlData.totalInvested.toFixed(2)}
Current Value: $${pnlData.currentValue.toFixed(2)}
`;
    
    if (pnlData.profitLoss >= 0) {
      pnlMessage += `Profit: $${pnlData.profitLoss.toFixed(2)} (+${pnlData.percentChange.toFixed(2)}%)`;
    } else {
      pnlMessage += `Loss: $${Math.abs(pnlData.profitLoss).toFixed(2)} (-${Math.abs(pnlData.percentChange).toFixed(2)}%)`;
    }
    
    bot.sendMessage(chatId, pnlMessage, { parse_mode: 'Markdown' });
  });
}; 