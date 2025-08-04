/**
 * Limit Order Service for Zoracle Bot
 * Handles creation, monitoring, and execution of limit orders
 */
import { LimitOrder } from '../database/models';
import * as geckoTerminal from './geckoTerminal';
import * as enhancedSwaps from './enhancedSwaps';
import * as positions from './positions';
import moment from 'moment';

export interface LimitOrderData {
  telegramId: string;
  orderType: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;
  amount: number;
  limitPrice: number;
  network?: string;
  slippage?: number;
  notes?: string;
  expiresAt?: Date;
}

/**
 * Create a new limit order
 * @param {LimitOrderData} orderData - Limit order data
 * @returns {Promise<Object>} - Created limit order
 */
async function createLimitOrder(orderData: LimitOrderData): Promise<any> {
  try {
    // Validate order data
    if (!orderData.telegramId || !orderData.tokenAddress || !orderData.tokenSymbol) {
      return {
        success: false,
        message: 'Missing required order data'
      };
    }

    if (orderData.amount <= 0 || orderData.limitPrice <= 0) {
      return {
        success: false,
        message: 'Amount and limit price must be greater than 0'
      };
    }

    // Get current token price for validation
    const tokenData = await geckoTerminal.getTokenData(
      orderData.network || 'base',
      orderData.tokenAddress
    );

    if (!tokenData.success) {
      return {
        success: false,
        message: `Failed to get token data: ${tokenData.message}`
      };
    }

    const currentPrice = tokenData.token.priceUsd;
    const totalValue = orderData.amount * orderData.limitPrice;

    // Create limit order
    const limitOrder = new LimitOrder({
      telegramId: orderData.telegramId,
      orderType: orderData.orderType,
      tokenAddress: orderData.tokenAddress,
      tokenSymbol: orderData.tokenSymbol,
      tokenName: orderData.tokenName || tokenData.token.name,
      amount: orderData.amount,
      limitPrice: orderData.limitPrice,
      totalValue: totalValue,
      network: orderData.network || 'base',
      slippage: orderData.slippage || 1.0,
      notes: orderData.notes,
      expiresAt: orderData.expiresAt,
      status: 'pending'
    });

    await limitOrder.save();

    return {
      success: true,
      order: limitOrder.toObject(),
      message: 'Limit order created successfully'
    };
  } catch (error) {
    console.error('Error creating limit order:', error);
    return {
      success: false,
      message: `Failed to create limit order: ${error.message}`
    };
  }
}

/**
 * Get user's limit orders
 * @param {string} telegramId - Telegram user ID
 * @param {string} status - Filter by status ('pending', 'filled', 'cancelled', 'expired', or 'all')
 * @returns {Promise<Object>} - User's limit orders
 */
async function getUserLimitOrders(telegramId: string, status: 'pending' | 'filled' | 'cancelled' | 'expired' | 'all' = 'all'): Promise<any> {
  try {
    // Build query
    const query: any = { telegramId };
    if (status !== 'all') {
      query.status = status;
    }

    const orders = await LimitOrder.find(query).sort({ createdAt: -1 });

    // Calculate summary statistics
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const filledOrders = orders.filter(o => o.status === 'filled');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');
    const expiredOrders = orders.filter(o => o.status === 'expired');

    const totalPendingValue = pendingOrders.reduce((sum, o) => sum + o.totalValue, 0);
    const totalFilledValue = filledOrders.reduce((sum, o) => sum + o.totalValue, 0);

    return {
      success: true,
      orders: orders.map(o => o.toObject()),
      summary: {
        totalOrders: orders.length,
        pendingOrders: pendingOrders.length,
        filledOrders: filledOrders.length,
        cancelledOrders: cancelledOrders.length,
        expiredOrders: expiredOrders.length,
        totalPendingValue,
        totalFilledValue
      }
    };
  } catch (error) {
    console.error('Error getting user limit orders:', error);
    return {
      success: false,
      message: `Failed to get limit orders: ${error.message}`
    };
  }
}

/**
 * Cancel a limit order
 * @param {string} telegramId - Telegram user ID
 * @param {string} orderId - Limit order ID
 * @returns {Promise<Object>} - Cancelled order
 */
async function cancelLimitOrder(telegramId: string, orderId: string): Promise<any> {
  try {
    const order = await LimitOrder.findOne({ _id: orderId, telegramId });

    if (!order) {
      return {
        success: false,
        message: 'Limit order not found'
      };
    }

    if (order.status !== 'pending') {
      return {
        success: false,
        message: `Cannot cancel order with status: ${order.status}`
      };
    }

    order.status = 'cancelled';
    await order.save();

    return {
      success: true,
      order: order.toObject(),
      message: 'Limit order cancelled successfully'
    };
  } catch (error) {
    console.error('Error cancelling limit order:', error);
    return {
      success: false,
      message: `Failed to cancel limit order: ${error.message}`
    };
  }
}

/**
 * Check and execute pending limit orders
 * @param {string} telegramId - Telegram user ID (optional, if not provided checks all users)
 * @returns {Promise<Object>} - Execution results
 */
async function checkAndExecuteLimitOrders(telegramId?: string): Promise<any> {
  try {
    // Build query for pending orders
    const query: any = { status: 'pending' };
    if (telegramId) {
      query.telegramId = telegramId;
    }

    // Add expiration check
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ];

    const pendingOrders = await LimitOrder.find(query);
    const results = [];

    for (const order of pendingOrders) {
      try {
        // Get current token price
        const tokenData = await geckoTerminal.getTokenData(order.network, order.tokenAddress);
        
        if (!tokenData.success) {
          console.warn(`Failed to get price for order ${order._id}: ${tokenData.message}`);
          continue;
        }

        const currentPrice = tokenData.token.priceUsd;
        let shouldExecute = false;

        // Check if order should be executed
        if (order.orderType === 'buy' && currentPrice <= order.limitPrice) {
          shouldExecute = true;
        } else if (order.orderType === 'sell' && currentPrice >= order.limitPrice) {
          shouldExecute = true;
        }

        if (shouldExecute) {
          // Execute the order
          const executionResult = await executeLimitOrder(order, currentPrice);
          results.push(executionResult);
        }
      } catch (error) {
        console.error(`Error processing order ${order._id}:`, error);
        results.push({
          orderId: order._id,
          success: false,
          message: `Error processing order: ${error.message}`
        });
      }
    }

    return {
      success: true,
      results,
      message: `Processed ${pendingOrders.length} pending orders`
    };
  } catch (error) {
    console.error('Error checking limit orders:', error);
    return {
      success: false,
      message: `Failed to check limit orders: ${error.message}`
    };
  }
}

/**
 * Execute a limit order
 * @param {any} order - Limit order object
 * @param {number} currentPrice - Current token price
 * @returns {Promise<Object>} - Execution result
 */
async function executeLimitOrder(order: any, currentPrice: number): Promise<any> {
  try {
    // Mark order as being processed
    order.status = 'processing';
    await order.save();

    // Execute the swap
    const accountName = `zoracle-${order.telegramId}`;
    let swapResult;

    if (order.orderType === 'buy') {
      // Buy tokens with ETH
      swapResult = await enhancedSwaps.executeSwapWithPositionTracking(
        order.telegramId,
        accountName,
        'ETH',
        order.tokenAddress,
        order.amount.toString(),
        order.slippage,
        order.network
      );
    } else {
      // Sell tokens for ETH
      swapResult = await enhancedSwaps.executeSwapWithPositionTracking(
        order.telegramId,
        accountName,
        order.tokenAddress,
        'ETH',
        order.amount.toString(),
        order.slippage,
        order.network
      );
    }

    if (swapResult.success) {
      // Update order as filled
      order.status = 'filled';
      order.txHash = swapResult.swap?.txHash;
      order.filledAt = new Date();
      await order.save();

      return {
        orderId: order._id,
        success: true,
        order: order.toObject(),
        swap: swapResult.swap,
        position: swapResult.position,
        message: 'Limit order executed successfully'
      };
    } else {
      // Mark order as failed
      order.status = 'pending';
      await order.save();

      return {
        orderId: order._id,
        success: false,
        message: `Failed to execute order: ${swapResult.message}`
      };
    }
  } catch (error) {
    console.error('Error executing limit order:', error);
    
    // Reset order status
    order.status = 'pending';
    await order.save();

    return {
      orderId: order._id,
      success: false,
      message: `Error executing order: ${error.message}`
    };
  }
}

/**
 * Get limit order by ID
 * @param {string} telegramId - Telegram user ID
 * @param {string} orderId - Limit order ID
 * @returns {Promise<Object>} - Limit order data
 */
async function getLimitOrder(telegramId: string, orderId: string): Promise<any> {
  try {
    const order = await LimitOrder.findOne({ _id: orderId, telegramId });

    if (!order) {
      return {
        success: false,
        message: 'Limit order not found'
      };
    }

    return {
      success: true,
      order: order.toObject(),
      message: 'Limit order retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting limit order:', error);
    return {
      success: false,
      message: `Failed to get limit order: ${error.message}`
    };
  }
}

/**
 * Update limit order
 * @param {string} telegramId - Telegram user ID
 * @param {string} orderId - Limit order ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated order
 */
async function updateLimitOrder(telegramId: string, orderId: string, updateData: Partial<LimitOrderData>): Promise<any> {
  try {
    const order = await LimitOrder.findOne({ _id: orderId, telegramId });

    if (!order) {
      return {
        success: false,
        message: 'Limit order not found'
      };
    }

    if (order.status !== 'pending') {
      return {
        success: false,
        message: `Cannot update order with status: ${order.status}`
      };
    }

    // Update allowed fields
    if (updateData.amount) order.amount = updateData.amount;
    if (updateData.limitPrice) order.limitPrice = updateData.limitPrice;
    if (updateData.notes) order.notes = updateData.notes;
    if (updateData.expiresAt) order.expiresAt = updateData.expiresAt;
    if (updateData.slippage) order.slippage = updateData.slippage;

    // Recalculate total value
    order.totalValue = order.amount * order.limitPrice;

    await order.save();

    return {
      success: true,
      order: order.toObject(),
      message: 'Limit order updated successfully'
    };
  } catch (error) {
    console.error('Error updating limit order:', error);
    return {
      success: false,
      message: `Failed to update limit order: ${error.message}`
    };
  }
}

export {
  createLimitOrder,
  getUserLimitOrders,
  cancelLimitOrder,
  checkAndExecuteLimitOrders,
  getLimitOrder,
  updateLimitOrder
}; 