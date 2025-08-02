// Swap service for Zoracle Bot
import axios from 'axios';
import { ethers } from 'ethers';
import { CONFIG } from '../config/index';

// Base URL for the Swap API
const SWAP_API_BASE_URL = process.env.ZORACLE_API_URL || 'https://usezoracle-telegrambot-production.up.railway.app';

/**
 * Get common token addresses for a network
 * @param {string} network - Network name (base, ethereum, base-sepolia)
 * @returns {Promise<Object>} - Token addresses
 */
async function getTokenAddresses(network: string = 'base'): Promise<any> {
  try {
    const response = await axios.get(`${SWAP_API_BASE_URL}/api/swaps/tokens/${network}`, {
      timeout: 10000,
      validateStatus: status => status < 500 // Don't throw on 4xx errors
    });

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'Failed to get token addresses');
    }

    return {
      success: true,
      tokens: response.data.data,
      message: response.data.message
    };
  } catch (error) {
    console.error('Error getting token addresses:', error);
    // Always provide default tokens even on error
    return {
      success: false,
      tokens: {
        ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        WETH: '0x4200000000000000000000000000000000000006',
        USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        USDT: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'
      },
      message: 'Error: ' + (error.message || 'Unknown error')
    };
  }
}

/**
 * Get swap price estimation
 * @param {string} accountName - Account name
 * @param {string} fromToken - From token address or symbol
 * @param {string} toToken - To token address or symbol
 * @param {string} fromAmount - Amount to swap in base units
 * @param {string} network - Network name
 * @returns {Promise<Object>} - Price estimation
 */
async function getSwapPrice(accountName: string, fromToken: string, toToken: string, fromAmount: string, network: string = 'base'): Promise<any> {
  try {
    // Handle ETH special case
    if (fromToken.toUpperCase() === 'ETH') {
      fromToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    if (toToken.toUpperCase() === 'ETH') {
      toToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }

    const response = await axios.get(`${SWAP_API_BASE_URL}/api/swaps/price`, {
      params: {
        accountName,
        fromToken,
        toToken,
        fromAmount,
        network
      },
      timeout: 15000,
      validateStatus: status => status < 500 // Don't throw on 4xx errors
    });

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'Failed to get swap price');
    }

    return {
      success: true,
      ...response.data.data,
      message: response.data.message
    };
  } catch (error) {
    console.error('Error getting swap price:', error);
    return {
      success: false,
      liquidityAvailable: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Execute a token swap
 * @param {string} accountName - Account name
 * @param {string} fromToken - From token address or symbol
 * @param {string} toToken - To token address or symbol
 * @param {string} fromAmount - Amount to swap in base units
 * @param {number} slippageBps - Slippage tolerance in basis points (1 bps = 0.01%)
 * @param {string} network - Network name
 * @returns {Promise<Object>} - Swap result
 */
async function executeSwap(accountName: string, fromToken: string, toToken: string, fromAmount: string, slippageBps: number = 100, network: string = 'base'): Promise<any> {
  try {
    // Handle ETH special case
    if (fromToken.toUpperCase() === 'ETH') {
      fromToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    if (toToken.toUpperCase() === 'ETH') {
      toToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }

    const response = await axios.post(
      `${SWAP_API_BASE_URL}/api/swaps/execute`, 
      {
        accountName,
        fromToken,
        toToken,
        fromAmount,
        slippageBps,
        network
      },
      {
        timeout: 30000,
        validateStatus: status => status < 500 // Don't throw on 4xx errors
      }
    );

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'Failed to execute swap');
    }

    return {
      success: true,
      ...response.data.data,
      message: response.data.message
    };
  } catch (error) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Get token price using multiple sources with fallback
 * @param {string} tokenAddress - Token contract address
 * @param {string} network - Network name (default: base)
 * @returns {Promise<Object>} - Token price data
 */
async function getTokenPrice(tokenAddress: string, network: string = 'base'): Promise<any> {
  try {
    // Import config for API key
    const { CONFIG } = require('../config/index');
    
    // Try Ankr Advanced API first
    try {
      const ANKR_API = 'https://rpc.ankr.com/multichain';
      
      const response = await axios.post(ANKR_API, {
        jsonrpc: '2.0',
        id: 1,
        method: 'ankr_getTokenPrice',
        params: {
          blockchain: network,
          tokenAddress: tokenAddress
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.ANKR_API_KEY}`
        },
        timeout: 10000
      });

      if (response.data && response.data.result && !response.data.error) {
        const priceData = response.data.result;
        return {
          success: true,
          price: priceData.price,
          priceUsd: priceData.priceUsd,
          marketCap: priceData.marketCap,
          volume24h: priceData.volume24h,
          priceChange24h: priceData.priceChange24h,
          message: 'Token price retrieved from Ankr Advanced API'
        };
      }
    } catch (ankrError) {
      console.log('Ankr Advanced API not available, trying fallback...');
    }
    
    // Fallback: Try to get basic token info from blockchain
    try {
      // Use standard RPC to get token info
      const provider = new ethers.providers.JsonRpcProvider(
        network === 'base' ? 'https://mainnet.base.org' : 'https://eth.llamarpc.com'
      );
      
      // Try to get token symbol and decimals
      const tokenContract = new ethers.Contract(tokenAddress, [
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function name() view returns (string)'
      ], provider);
      
      const [symbol, decimals, name] = await Promise.all([
        tokenContract.symbol().catch(() => 'UNKNOWN'),
        tokenContract.decimals().catch(() => 18),
        tokenContract.name().catch(() => 'Unknown Token')
      ]);
      
      return {
        success: true,
        price: null,
        priceUsd: null,
        marketCap: null,
        volume24h: null,
        priceChange24h: null,
        tokenInfo: {
          symbol,
          decimals,
          name,
          address: tokenAddress
        },
        message: `Token info retrieved: ${symbol} (${name})`
      };
    } catch (fallbackError) {
      console.error('Fallback token info failed:', fallbackError);
      return {
        success: false,
        price: null,
        priceUsd: null,
        message: 'Unable to retrieve token information'
      };
    }
  } catch (error) {
    console.error('Error getting token price:', error);
    return {
      success: false,
      price: null,
      priceUsd: null,
      message: 'Error: ' + (error.message || 'Failed to get token price')
    };
  }
}

/**
 * Format token amount for display
 * @param {string} amount - Amount in base units
 * @param {number} decimals - Token decimals
 * @returns {string} - Formatted amount
 */
function formatTokenAmount(amount: string, decimals: number = 18): string {
  try {
    return ethers.utils.formatUnits(amount, decimals);
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return amount;
  }
}

export {
  getTokenAddresses,
  getSwapPrice,
  executeSwap,
  getTokenPrice,
  formatTokenAmount
};