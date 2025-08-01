// Portfolio tracking service for Zoracle Bot
import { ethers  } from 'ethers';
import moment from 'moment';
import { CONFIG, ABIS  } from '../config/index';
import * as walletManager from './wallet';
import { TransactionOps, TokenOps  } from '../database/operations';

// Provider setup
const provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);

// In-memory storage for trade history (use DB in production)
const tradeHistory = new Map(); // userId => array of trades

/**
 * Record a trade in history
 * @param {string} userId - User ID
 * @param {Object} trade - Trade details
 */
function recordTrade(userId, trade): any {
  if (!tradeHistory.has(userId)) {
    tradeHistory.set(userId, []);
  }
  tradeHistory.get(userId).push({
    ...trade,
    timestamp: Date.now()
  });
}

/**
 * Get detailed portfolio with holdings, P&L, etc.
 * @param {string} userId - User ID
 * @param {number} threshold - Minimum USD value to show
 * @returns {Promise<Object>} - Portfolio data
 */
async function getPortfolio(userId, threshold = 0): Promise<any> {
  try {
    const address = walletManager.getWalletAddress(userId);
    if (!address) {
      return { success: false, message: 'No wallet found' };
    }

    // Get ETH balance and USD value (mock price $2000)
    const ethBalance = await provider.getBalance(address);
    const ethUSD = parseFloat(ethers.utils.formatEther(ethBalance)) * 2000;

    const portfolio = {
      ETH: {
        balance: ethers.utils.formatEther(ethBalance),
        costBasis: 0, // Would track average cost
        pnl: 0,
        usdValue: ethUSD
      }
    };

    let totalUSD = ethUSD;

    // Get token holdings (simplified - in real, use API like Alchemy or Covalent for token balances)
    // For demo, assume some tokens
    const tokens = [/* array of token addresses from history or scanning */];
    for (const tokenAddr of tokens) {
      const contract = new ethers.Contract(tokenAddr, ABIS.ERC20_ABI, provider);
      const balance = await contract.balanceOf(address);
      if (balance.eq(0)) continue;

      const decimals = await contract.decimals();
      const symbol = await contract.symbol();
      
      // Mock price $1 per token unit
      const formattedBal = parseFloat(ethers.utils.formatUnits(balance, decimals));
      const usdValue = formattedBal * 1;

      if (usdValue >= threshold) {
        // Calculate P&L from trade history
        const tokenTrades = (tradeHistory.get(userId) || []).filter(t => t.token === tokenAddr);
        const totalCost = tokenTrades.reduce((sum, t) => sum + (t.type === 'buy' ? t.amountUSD : 0), 0);
        const avgCost = totalCost / formattedBal;
        const pnl = (usdValue - totalCost);

        portfolio[tokenAddr] = {
          symbol,
          balance: formattedBal,
          costBasis: avgCost,
          pnl,
          usdValue
        };
        totalUSD += usdValue;
      }
    }

    return {
      success: true,
      holdings: portfolio,
      totalUSD
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Get detailed view for a specific token
 * @param {string} userId - User ID
 * @param {string} tokenAddr - Token address
 * @returns {Promise<Object>} - Token details
 */
async function getTokenDetails(userId, tokenAddr): Promise<any> {
  try {
    const address = walletManager.getWalletAddress(userId);
    if (!address) {
      return { success: false, message: 'No wallet found' };
    }

    const contract = new ethers.Contract(tokenAddr, ABIS.ERC20_ABI, provider);
    const [balance, decimals, symbol] = await Promise.all([
      contract.balanceOf(address),
      contract.decimals(),
      contract.symbol()
    ]);

    const formattedBal = ethers.utils.formatUnits(balance, decimals);

    // Trade history
    const tokenTrades = (tradeHistory.get(userId) || []).filter(t => t.token === tokenAddr);

    // Mock mini-chart data (last 7 days prices)
    const chartData = Array.from({length: 7}, (_, i) => ({
      date: moment().subtract(i, 'days').format('YYYY-MM-DD'),
      price: Math.random() * 10
    }));

    // TXIDs from trades (mock)
    const txids = tokenTrades.map(t => t.txHash || 'mock-txid');

    return {
      success: true,
      symbol,
      balance: formattedBal,
      history: tokenTrades,
      txids,
      chart: chartData
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export { 
  recordTrade,
  getPortfolio,
  getTokenDetails
 };