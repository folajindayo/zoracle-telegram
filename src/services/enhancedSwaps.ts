// Enhanced Swap service with position tracking for Zoracle Bot
import axios from 'axios';
import { ethers } from 'ethers';
import { CONFIG } from '../config/index';
import * as positions from './positions';
import * as geckoTerminal from './geckoTerminal';

// Base URL for the Swap API
const SWAP_API_BASE_URL = process.env.ZORACLE_API_URL;

/**
 * Execute a swap and create/update position tracking
 * @param {string} telegramId - Telegram user ID
 * @param {string} accountName - Account name
 * @param {string} fromToken - From token address or symbol
 * @param {string} toToken - To token address or symbol
 * @param {string} fromAmount - Amount to swap in base units
 * @param {number} slippageBps - Slippage in basis points
 * @param {string} network - Network name
 * @returns {Promise<Object>} - Swap execution result with position data
 */
async function executeSwapWithPositionTracking(
  telegramId: string,
  accountName: string,
  fromToken: string,
  toToken: string,
  fromAmount: string,
  slippageBps: number = 100,
  network: string = 'base'
): Promise<any> {
  try {
    // Handle ETH special case
    if (fromToken.toUpperCase() === 'ETH') {
      fromToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    if (toToken.toUpperCase() === 'ETH') {
      toToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }

    // Execute the swap
    const swapResponse = await axios.post(
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
        validateStatus: status => status < 500
      }
    );

    if (!swapResponse.data || !swapResponse.data.success) {
      throw new Error(swapResponse.data?.message || 'Failed to execute swap');
    }

    const swapData = swapResponse.data.data;
    
    // Determine swap type and token details
    const swapType: 'buy' | 'sell' = fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 'buy' : 'sell';
    const targetToken = swapType === 'buy' ? toToken : fromToken;
    
    // Get token info from GeckoTerminal
    const tokenInfo = await getTokenInfo(targetToken, network);
    
    // Create position tracking
    const positionData = {
      tokenAddress: targetToken,
      tokenSymbol: tokenInfo.symbol || 'UNKNOWN',
      tokenName: tokenInfo.name || tokenInfo.symbol || 'Unknown Token',
      swapType,
      fromToken,
      toToken,
      fromAmount,
      toAmount: swapData.toAmount || fromAmount, // Fallback if not provided
      txHash: swapData.txHash || '',
      network,
      slippage: slippageBps / 100, // Convert to percentage
      gasUsed: swapData.gasUsed,
      gasPrice: swapData.gasPrice,
    };

    const positionResult = await positions.createPositionFromSwap(telegramId, positionData);

    return {
      success: true,
      swap: swapData,
      position: positionResult.success ? positionResult.position : null,
      positionMessage: positionResult.message,
      message: 'Swap executed successfully with position tracking'
    };
  } catch (error) {
    console.error('Error executing swap with position tracking:', error);
    return {
      success: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Get token information from GeckoTerminal
 * @param {string} tokenAddress - Token contract address
 * @param {string} network - Network name
 * @returns {Promise<Object>} - Token information
 */
async function getTokenInfo(tokenAddress: string, network: string = 'base'): Promise<any> {
  try {
    // Try to get token info from GeckoTerminal pools
    const poolsResult = await geckoTerminal.getTokenPools(network, tokenAddress);
    
    if (poolsResult.success && poolsResult.pools.length > 0) {
      const topPool = poolsResult.pools[0];
      const baseToken = topPool.relationships?.base_token?.data;
      
      if (baseToken) {
        // Find base token info in included data
        const baseTokenInfo = poolsResult.included?.find((item: any) => 
          item.type === 'token' && item.id === baseToken.id
        );
        
        if (baseTokenInfo) {
          return {
            symbol: baseTokenInfo.attributes.symbol,
            name: baseTokenInfo.attributes.name,
            decimals: baseTokenInfo.attributes.decimals,
            address: tokenAddress
          };
        }
      }
    }

    // Fallback: Try to get basic token info from blockchain
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        network === 'base' ? 'https://mainnet.base.org' : 'https://eth.llamarpc.com'
      );
      
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
        symbol,
        decimals,
        name,
        address: tokenAddress
      };
    } catch (fallbackError) {
      console.error('Fallback token info failed:', fallbackError);
      return {
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        decimals: 18,
        address: tokenAddress
      };
    }
  } catch (error) {
    console.error('Error getting token info:', error);
    return {
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 18,
      address: tokenAddress
    };
  }
}

/**
 * Get swap price estimation with position preview
 * @param {string} telegramId - Telegram user ID
 * @param {string} accountName - Account name
 * @param {string} fromToken - From token address or symbol
 * @param {string} toToken - To token address or symbol
 * @param {string} fromAmount - Amount to swap in base units
 * @param {string} network - Network name
 * @returns {Promise<Object>} - Price estimation with position preview
 */
async function getSwapPriceWithPositionPreview(
  telegramId: string,
  accountName: string,
  fromToken: string,
  toToken: string,
  fromAmount: string,
  network: string = 'base'
): Promise<any> {
  try {
    // Handle ETH special case
    if (fromToken.toUpperCase() === 'ETH') {
      fromToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    if (toToken.toUpperCase() === 'ETH') {
      toToken = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }

    // Get swap price estimation
    const response = await axios.get(`${SWAP_API_BASE_URL}/api/swaps/price`, {
      params: {
        accountName,
        fromToken,
        toToken,
        fromAmount,
        network
      },
      timeout: 18000,
      validateStatus: status => status < 500
    });

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || 'Failed to get swap price');
    }

    const priceData = response.data.data;
    
    // Determine swap type and target token
    const swapType = fromToken.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 'buy' : 'sell';
    const targetToken = swapType === 'buy' ? toToken : fromToken;
    
    // Get token info and current price
    const tokenInfo = await getTokenInfo(targetToken, network);
    const priceResult = await geckoTerminal.getTokenPrice(network, targetToken);
    
    // Calculate position preview
    const currentPrice = priceResult.success ? priceResult.price : 0;
    const estimatedAmount = parseFloat(priceData.toAmount || fromAmount);
    const estimatedUsdValue = estimatedAmount * currentPrice;
    const initialUsdValue = parseFloat(fromAmount) * (swapType === 'buy' ? 1 : currentPrice); // Simplified for preview
    
    const previewPnL = estimatedUsdValue - initialUsdValue;
    const previewPnLPercentage = initialUsdValue > 0 ? (previewPnL / initialUsdValue) * 100 : 0;

    return {
      success: true,
      ...priceData,
      positionPreview: {
        tokenAddress: targetToken,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        swapType,
        estimatedAmount,
        estimatedUsdValue,
        currentPrice,
        previewPnL,
        previewPnLPercentage
      },
      message: response.data.message
    };
  } catch (error) {
    console.error('Error getting swap price with position preview:', error);
    return {
      success: false,
      liquidityAvailable: false,
      message: 'Error: ' + error.message
    };
  }
}

/**
 * Update all user positions with current market data
 * @param {string} telegramId - Telegram user ID
 * @returns {Promise<Object>} - Update result
 */
async function updateAllUserPositions(telegramId: string): Promise<any> {
  try {
    const result = await positions.updateAllOpenPositions(telegramId);
    return result;
  } catch (error) {
    console.error('Error updating user positions:', error);
    return {
      success: false,
      message: `Failed to update positions: ${error.message}`
    };
  }
}

/**
 * Get user's trading statistics
 * @param {string} telegramId - Telegram user ID
 * @returns {Promise<Object>} - Trading statistics
 */
async function getUserTradingStats(telegramId: string): Promise<any> {
  try {
    const statsResult = await positions.getPositionStatistics(telegramId);
    return statsResult;
  } catch (error) {
    console.error('Error getting user trading stats:', error);
    return {
      success: false,
      message: `Failed to get trading stats: ${error.message}`
    };
  }
}

export {
  executeSwapWithPositionTracking,
  getSwapPriceWithPositionPreview,
  updateAllUserPositions,
  getUserTradingStats,
  getTokenInfo
}; 