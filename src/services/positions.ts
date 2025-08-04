// Enhanced Positions tracking service for Zoracle Bot
import { ethers } from 'ethers';
import moment from 'moment';
import { CONFIG } from '../config/index';
import { Position as PositionModel } from '../database/models';
import * as geckoTerminal from './geckoTerminal';
import * as walletManager from './cdpWallet';

// Position types
export interface Position {
  id: string;
  telegramId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  initialAmount: number;
  initialUsdValue: number;
  currentAmount: number;
  currentUsdValue: number;
  entryPrice: number;
  currentPrice: number;
  pnlPercentage: number;
  pnlUsd: number;
  status: 'open' | 'closed';
  entryTime: Date;
  closeTime?: Date;
  duration?: string;
  txHash?: string;
  network: string;
  dexToolsUrl?: string;
  tonviewerUrl?: string;
  swapUrl?: string;
  swapType: 'buy' | 'sell';
  fromToken?: string;
  toToken?: string;
  fromAmount?: string;
  toAmount?: string;
  slippage?: number;
  gasUsed?: string;
  gasPrice?: string;
}

/**
 * Create a new position from swap execution
 * @param {string} telegramId - Telegram user ID
 * @param {Object} swapData - Swap execution data
 * @returns {Promise<Object>} - Created position
 */
async function createPositionFromSwap(telegramId: string, swapData: {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  swapType: 'buy' | 'sell';
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  txHash: string;
  network: string;
  slippage?: number;
  gasUsed?: string;
  gasPrice?: string;
}): Promise<any> {
  try {
    // Get current token data from GeckoTerminal for current price
    const tokenDataResult = await geckoTerminal.getTokenData(swapData.network, swapData.tokenAddress);
    
    if (!tokenDataResult.success) {
      console.warn(`Failed to get token data for ${swapData.tokenSymbol}: ${tokenDataResult.message}`);
    }

    const currentPrice = tokenDataResult.success ? tokenDataResult.token.priceUsd : 0;
    
    // Get actual wallet balance from CDP wallet API
    const walletManager = await import('./cdpWallet');
    const walletAddress = walletManager.getWalletAddress(telegramId);
    
    if (!walletAddress) {
      return {
        success: false,
        message: 'No wallet found for user'
      };
    }
    
    // Get actual token balance from wallet
    const balanceResult = await walletManager.getTokenBalance(telegramId, swapData.tokenAddress);
    
    let initialAmount = 0;
    let currentAmount = 0;
    let initialUsdValue = 0;
    let currentUsdValue = 0;
    
    if (balanceResult.success && balanceResult.token && balanceResult.token.balance) {
      // Use swap data for initial values (historical)
      initialAmount = parseFloat(swapData.toAmount);
      
      // Use actual wallet balance for current values
      currentAmount = parseFloat(balanceResult.token.balance);
      
      // For initial USD value, use swap amount with current price as approximation
      // (in a real scenario, we'd want to get the historical price at swap time)
      initialUsdValue = initialAmount * currentPrice;
      
      // For current USD value, use actual balance with current price
      currentUsdValue = currentAmount * currentPrice;
    } else {
      // Fallback to swap data if wallet balance not available
      console.warn(`Using swap data as fallback for ${swapData.tokenSymbol}`);
      initialAmount = parseFloat(swapData.toAmount);
      currentAmount = parseFloat(swapData.toAmount);
      initialUsdValue = initialAmount * currentPrice;
      currentUsdValue = currentAmount * currentPrice;
    }

    const position = new PositionModel({
      telegramId,
      tokenAddress: swapData.tokenAddress,
      tokenSymbol: swapData.tokenSymbol,
      tokenName: swapData.tokenName || swapData.tokenSymbol,
      initialAmount: initialAmount,
      initialUsdValue: initialUsdValue,
      currentAmount: currentAmount,
      currentUsdValue: currentUsdValue,
      entryPrice: currentPrice,
      currentPrice: currentPrice,
      pnlPercentage: 0,
      pnlUsd: 0,
      status: 'open',
      entryTime: new Date(),
      network: swapData.network,
      txHash: swapData.txHash,
      swapType: swapData.swapType,
      fromToken: swapData.fromToken,
      toToken: swapData.toToken,
      fromAmount: swapData.fromAmount,
      toAmount: swapData.toAmount,
      slippage: swapData.slippage,
      gasUsed: swapData.gasUsed,
      gasPrice: swapData.gasPrice,
    });

    await position.save();

    return {
      success: true,
      position: position.toObject(),
      message: 'Position created successfully from swap'
    };
  } catch (error) {
    console.error('Error creating position from swap:', error);
    return {
      success: false,
      message: `Failed to create position: ${error.message}`
    };
  }
}

/**
 * Update position with current market data from GeckoTerminal
 * @param {string} telegramId - Telegram user ID
 * @param {string} positionId - Position ID
 * @returns {Promise<Object>} - Updated position
 */
async function updatePositionWithMarketData(telegramId: string, positionId: string): Promise<any> {
  try {
    const position = await PositionModel.findOne({ _id: positionId, telegramId });
    
    if (!position) {
      return {
        success: false,
        message: 'Position not found'
      };
    }

    // Get current token data from GeckoTerminal
    const tokenDataResult = await geckoTerminal.getTokenData(position.network, position.tokenAddress);
    
    if (!tokenDataResult.success) {
      return {
        success: false,
        message: `Failed to get current token data: ${tokenDataResult.message}`
      };
    }

    const currentPrice = tokenDataResult.token.priceUsd;
    
    // Get actual wallet balance from CDP wallet API instead of using stored currentAmount
    const walletManager = await import('./cdpWallet');
    const balanceResult = await walletManager.getTokenBalance(telegramId, position.tokenAddress);
    
    let currentAmount = position.currentAmount; // Fallback to stored amount
    let currentUsdValue = 0;
    
    if (balanceResult.success && balanceResult.token && balanceResult.token.balance) {
      currentAmount = parseFloat(balanceResult.token.balance);
      currentUsdValue = currentAmount * currentPrice;
      
      // Update the stored currentAmount with actual wallet balance
      position.currentAmount = currentAmount;
    } else {
      // Fallback to stored amount if wallet balance not available
      currentUsdValue = position.currentAmount * currentPrice;
    }
    
    const pnlUsd = currentUsdValue - position.initialUsdValue;
    const pnlPercentage = position.initialUsdValue > 0 
      ? (pnlUsd / position.initialUsdValue) * 100 
      : 0;

    // Update position
    position.currentPrice = currentPrice;
    position.currentUsdValue = currentUsdValue;
    position.pnlUsd = pnlUsd;
    position.pnlPercentage = pnlPercentage;

    // Update duration for open positions
    if (position.status === 'open') {
      const duration = moment.duration(moment().diff(moment(position.entryTime)));
      position.duration = `${duration.days()}d ${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`;
    }

    await position.save();

    return {
      success: true,
      position: position.toObject(),
      message: 'Position updated with current market data'
    };
  } catch (error) {
    console.error('Error updating position with market data:', error);
    return {
      success: false,
      message: `Failed to update position: ${error.message}`
    };
  }
}

/**
 * Close a position
 * @param {string} telegramId - Telegram user ID
 * @param {string} positionId - Position ID
 * @param {Object} closeData - Close data
 * @returns {Promise<Object>} - Closed position
 */
async function closePosition(telegramId: string, positionId: string, closeData: Partial<Position>): Promise<any> {
  try {
    const position = await PositionModel.findOne({ _id: positionId, telegramId });
    
    if (!position) {
      return {
        success: false,
        message: 'Position not found'
      };
    }

    // Get final price from GeckoTerminal
    const priceResult = await geckoTerminal.getTokenPrice(position.network, position.tokenAddress);
    
    if (priceResult.success) {
      position.currentPrice = priceResult.price;
      position.currentUsdValue = position.currentAmount * priceResult.price;
    }

    // Update with close data
    Object.assign(position, closeData);
    position.status = 'closed';
    position.closeTime = new Date();
    
    // Calculate final duration
    const duration = moment.duration(moment(position.closeTime).diff(moment(position.entryTime)));
    position.duration = `${duration.days()}d ${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`;

    // Recalculate final PnL
    position.pnlUsd = position.currentUsdValue - position.initialUsdValue;
    position.pnlPercentage = position.initialUsdValue > 0 
      ? (position.pnlUsd / position.initialUsdValue) * 100 
      : 0;

    await position.save();

    return {
      success: true,
      position: position.toObject(),
      message: 'Position closed successfully'
    };
  } catch (error) {
    console.error('Error closing position:', error);
    return {
      success: false,
      message: `Failed to close position: ${error.message}`
    };
  }
}

/**
 * Get user's positions
 * @param {string} telegramId - Telegram user ID
 * @param {string} status - Filter by status ('open', 'closed', or 'all')
 * @returns {Promise<Object>} - User's positions
 */
async function getUserPositions(telegramId: string, status: 'open' | 'closed' | 'all' = 'all'): Promise<any> {
  try {
    // Build query
    const query: any = { telegramId };
    if (status !== 'all') {
      query.status = status;
    }

    const positions = await PositionModel.find(query).sort({ entryTime: -1 });

    // Calculate summary statistics
    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed');
    
    const totalInitialValue = openPositions.reduce((sum, p) => sum + p.initialUsdValue, 0);
    const totalCurrentValue = openPositions.reduce((sum, p) => sum + p.currentUsdValue, 0);
    const totalPnlUsd = totalCurrentValue - totalInitialValue;
    const totalPnlPercentage = totalInitialValue > 0 ? (totalPnlUsd / totalInitialValue) * 100 : 0;

    return {
      success: true,
      positions: positions.map(p => p.toObject()),
      summary: {
        totalPositions: positions.length,
        openPositions: openPositions.length,
        closedPositions: closedPositions.length,
        totalInitialValue,
        totalCurrentValue,
        totalPnlUsd,
        totalPnlPercentage
      }
    };
  } catch (error) {
    console.error('Error getting user positions:', error);
    return {
      success: false,
      message: `Failed to get positions: ${error.message}`
    };
  }
}

/**
 * Get position by ID
 * @param {string} telegramId - Telegram user ID
 * @param {string} positionId - Position ID
 * @returns {Promise<Object>} - Position data
 */
async function getPosition(telegramId: string, positionId: string): Promise<any> {
  try {
    const position = await PositionModel.findOne({ _id: positionId, telegramId });
    
    if (!position) {
      return {
        success: false,
        message: 'Position not found'
      };
    }

    return {
      success: true,
      position: position.toObject()
    };
  } catch (error) {
    console.error('Error getting position:', error);
    return {
      success: false,
      message: `Failed to get position: ${error.message}`
    };
  }
}

/**
 * Delete a position
 * @param {string} telegramId - Telegram user ID
 * @param {string} positionId - Position ID
 * @returns {Promise<Object>} - Deletion result
 */
async function deletePosition(telegramId: string, positionId: string): Promise<any> {
  try {
    const result = await PositionModel.deleteOne({ _id: positionId, telegramId });
    
    if (result.deletedCount === 0) {
      return {
        success: false,
        message: 'Position not found'
      };
    }

    return {
      success: true,
      message: 'Position deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting position:', error);
    return {
      success: false,
      message: `Failed to delete position: ${error.message}`
    };
  }
}

/**
 * Update all open positions with current market data
 * @param {string} telegramId - Telegram user ID
 * @returns {Promise<Object>} - Update result
 */
async function updateAllOpenPositions(telegramId: string): Promise<any> {
  try {
    const openPositions = await PositionModel.find({ telegramId, status: 'open' });
    
    let updatedCount = 0;
    let errorCount = 0;

    for (const position of openPositions) {
      try {
        const result = await updatePositionWithMarketData(telegramId, position._id.toString());
        if (result.success) {
          updatedCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Error updating position ${position._id}:`, error);
        errorCount++;
      }
    }

    return {
      success: true,
      updatedCount,
      errorCount,
      message: `Updated ${updatedCount} positions, ${errorCount} errors`
    };
  } catch (error) {
    console.error('Error updating open positions:', error);
    return {
      success: false,
      message: `Failed to update positions: ${error.message}`
    };
  }
}

/**
 * Get position statistics
 * @param {string} telegramId - Telegram user ID
 * @returns {Promise<Object>} - Position statistics
 */
async function getPositionStatistics(telegramId: string): Promise<any> {
  try {
    const positions = await PositionModel.find({ telegramId });
    
    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed');
    
    // Calculate statistics
    const totalTrades = positions.length;
    const winningTrades = closedPositions.filter(p => p.pnlUsd > 0).length;
    const losingTrades = closedPositions.filter(p => p.pnlUsd < 0).length;
    const breakEvenTrades = closedPositions.filter(p => p.pnlUsd === 0).length;
    
    const totalPnL = closedPositions.reduce((sum, p) => sum + p.pnlUsd, 0);
    const averagePnL = closedPositions.length > 0 ? totalPnL / closedPositions.length : 0;
    
    const largestWin = closedPositions.length > 0 
      ? Math.max(...closedPositions.map(p => p.pnlUsd))
      : 0;
    const largestLoss = closedPositions.length > 0 
      ? Math.min(...closedPositions.map(p => p.pnlUsd))
      : 0;

    return {
      success: true,
      statistics: {
        totalTrades,
        openPositions: openPositions.length,
        closedPositions: closedPositions.length,
        winningTrades,
        losingTrades,
        breakEvenTrades,
        winRate: closedPositions.length > 0 ? (winningTrades / closedPositions.length) * 100 : 0,
        totalPnL,
        averagePnL,
        largestWin,
        largestLoss
      }
    };
  } catch (error) {
    console.error('Error getting position statistics:', error);
    return {
      success: false,
      message: `Failed to get statistics: ${error.message}`
    };
  }
}

/**
 * Fix existing positions by updating them with actual wallet balances
 * @param {string} telegramId - Telegram user ID
 * @returns {Promise<Object>} - Fix result
 */
async function fixExistingPositions(telegramId: string): Promise<any> {
  try {
    const openPositions = await PositionModel.find({ telegramId, status: 'open' });
    
    let fixedCount = 0;
    let errorCount = 0;

    for (const position of openPositions) {
      try {
        // Get actual wallet balance from CDP wallet API
        const walletManager = await import('./cdpWallet');
        const balanceResult = await walletManager.getTokenBalance(telegramId, position.tokenAddress);
        
        if (balanceResult.success && balanceResult.token && balanceResult.token.balance) {
          const actualBalance = parseFloat(balanceResult.token.balance);
          
          // Only update if the balance is significantly different (more than 1% difference)
          const difference = Math.abs(actualBalance - position.currentAmount) / position.currentAmount;
          
          if (difference > 0.01) {
            console.log(`Fixing position for ${position.tokenSymbol}: stored=${position.currentAmount}, actual=${actualBalance}`);
            
            // Get current token data
            const tokenDataResult = await geckoTerminal.getTokenData(position.network, position.tokenAddress);
            const currentPrice = tokenDataResult.success ? tokenDataResult.token.priceUsd : position.currentPrice;
            
            // Update position with actual balance
            position.currentAmount = actualBalance;
            position.currentUsdValue = actualBalance * currentPrice;
            position.currentPrice = currentPrice;
            
            // Recalculate PnL
            const pnlUsd = position.currentUsdValue - position.initialUsdValue;
            position.pnlUsd = pnlUsd;
            position.pnlPercentage = position.initialUsdValue > 0 
              ? (pnlUsd / position.initialUsdValue) * 100 
              : 0;
            
            await position.save();
            fixedCount++;
          }
        }
      } catch (error) {
        console.error(`Error fixing position ${position._id}:`, error);
        errorCount++;
      }
    }

    return {
      success: true,
      fixedCount,
      errorCount,
      message: `Fixed ${fixedCount} positions, ${errorCount} errors`
    };
  } catch (error) {
    console.error('Error fixing existing positions:', error);
    return {
      success: false,
      message: `Failed to fix positions: ${error.message}`
    };
  }
}

/**
 * Get real-time worth for a position by calling GeckoTerminal
 * @param {string} telegramId - Telegram user ID
 * @param {Object} position - Position object
 * @returns {Promise<Object>} - Real-time worth data
 */
async function getRealTimeWorth(telegramId: string, position: any): Promise<any> {
  try {
    // Get current token data from GeckoTerminal
    const tokenDataResult = await geckoTerminal.getTokenData(position.network, position.tokenAddress);
    
    if (!tokenDataResult.success) {
      console.warn(`Failed to get real-time token data for ${position.tokenSymbol}: ${tokenDataResult.message}`);
      return {
        success: false,
        currentPrice: position.currentPrice || 0,
        currentAmount: position.currentAmount || 0,
        currentUsdValue: position.currentUsdValue || 0,
        message: `Failed to get real-time data: ${tokenDataResult.message}`
      };
    }

    const currentPrice = tokenDataResult.token.priceUsd;
    
    // Get actual wallet balance from CDP wallet API
    const walletManager = await import('./cdpWallet');
    const balanceResult = await walletManager.getTokenBalance(telegramId, position.tokenAddress);
    
    let currentAmount = position.currentAmount; // Fallback to stored amount
    let currentUsdValue = 0;
    
    if (balanceResult.success && balanceResult.token && balanceResult.token.balance) {
      currentAmount = parseFloat(balanceResult.token.balance);
      currentUsdValue = currentAmount * currentPrice;
    } else {
      // Fallback to stored amount if wallet balance not available
      currentUsdValue = position.currentAmount * currentPrice;
    }
    
    const pnlUsd = currentUsdValue - position.initialUsdValue;
    const pnlPercentage = position.initialUsdValue > 0 
      ? (pnlUsd / position.initialUsdValue) * 100 
      : 0;

    return {
      success: true,
      currentPrice,
      currentAmount,
      currentUsdValue,
      pnlUsd,
      pnlPercentage,
      message: 'Real-time worth retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting real-time worth:', error);
    return {
      success: false,
      currentPrice: position.currentPrice || 0,
      currentAmount: position.currentAmount || 0,
      currentUsdValue: position.currentUsdValue || 0,
      message: `Failed to get real-time worth: ${error.message}`
    };
  }
}

/**
 * Get user's positions with real-time worth data
 * @param {string} telegramId - Telegram user ID
 * @param {string} status - Filter by status ('open', 'closed', or 'all')
 * @returns {Promise<Object>} - User's positions with real-time worth
 */
async function getUserPositionsWithRealTimeWorth(telegramId: string, status: 'open' | 'closed' | 'all' = 'all'): Promise<any> {
  try {
    // Build query
    const query: any = { telegramId };
    if (status !== 'all') {
      query.status = status;
    }

    const positions = await PositionModel.find(query).sort({ entryTime: -1 });

    // Get real-time worth for all positions
    const positionsWithRealTimeData = await Promise.all(
      positions.map(async (position) => {
        const realTimeData = await getRealTimeWorth(telegramId, position.toObject());
        
        return {
          ...position.toObject(),
          currentPrice: realTimeData.currentPrice,
          currentAmount: realTimeData.currentAmount,
          currentUsdValue: realTimeData.currentUsdValue,
          pnlUsd: realTimeData.pnlUsd,
          pnlPercentage: realTimeData.pnlPercentage
        };
      })
    );

    // Calculate summary statistics with real-time data
    const openPositions = positionsWithRealTimeData.filter(p => p.status === 'open');
    const closedPositions = positionsWithRealTimeData.filter(p => p.status === 'closed');
    
    const totalInitialValue = openPositions.reduce((sum, p) => sum + p.initialUsdValue, 0);
    const totalCurrentValue = openPositions.reduce((sum, p) => sum + p.currentUsdValue, 0);
    const totalPnlUsd = totalCurrentValue - totalInitialValue;
    const totalPnlPercentage = totalInitialValue > 0 ? (totalPnlUsd / totalInitialValue) * 100 : 0;

    return {
      success: true,
      positions: positionsWithRealTimeData,
      summary: {
        totalPositions: positionsWithRealTimeData.length,
        openPositions: openPositions.length,
        closedPositions: closedPositions.length,
        totalInitialValue,
        totalCurrentValue,
        totalPnlUsd,
        totalPnlPercentage
      }
    };
  } catch (error) {
    console.error('Error getting user positions with real-time worth:', error);
    return {
      success: false,
      message: `Failed to get positions with real-time worth: ${error.message}`
    };
  }
}

export {
  createPositionFromSwap,
  updatePositionWithMarketData,
  closePosition,
  getUserPositions,
  getPosition,
  deletePosition,
  updateAllOpenPositions,
  getPositionStatistics,
  fixExistingPositions,
  getRealTimeWorth,
  getUserPositionsWithRealTimeWorth
}; 