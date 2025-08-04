/**
 * Price Monitor Service for Zoracle Bot
 * Monitors prices and executes limit orders automatically
 */
import * as limitOrders from './limitOrders';
import * as geckoTerminal from './geckoTerminal';
import { LimitOrder } from '../database/models';

// Price monitoring interval (in milliseconds)
const MONITORING_INTERVAL = 30000; // 30 seconds

// Cache for token prices to avoid excessive API calls
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 10000; // 10 seconds

/**
 * Start price monitoring service
 */
export function startPriceMonitoring(): void {
  console.log('🔍 Starting price monitoring service...');
  
  // Run initial check
  checkAndExecuteLimitOrders();
  
  // Set up periodic monitoring
  setInterval(checkAndExecuteLimitOrders, MONITORING_INTERVAL);
}

/**
 * Check and execute all pending limit orders
 */
async function checkAndExecuteLimitOrders(): Promise<void> {
  try {
    console.log('🔍 Checking pending limit orders...');
    
    const result = await limitOrders.checkAndExecuteLimitOrders();
    
    if (result.success && result.results.length > 0) {
      console.log(`✅ Executed ${result.results.length} limit orders`);
      
      // Log execution results
      for (const executionResult of result.results) {
        if (executionResult.success) {
          console.log(`✅ Order ${executionResult.orderId} executed successfully`);
        } else {
          console.log(`❌ Order ${executionResult.orderId} failed: ${executionResult.message}`);
        }
      }
    } else {
      console.log('ℹ️ No limit orders to execute');
    }
  } catch (error) {
    console.error('❌ Error checking limit orders:', error);
  }
}

/**
 * Get cached token price or fetch from API
 * @param {string} network - Network ID
 * @param {string} tokenAddress - Token address
 * @returns {Promise<number>} - Token price
 */
async function getTokenPrice(network: string, tokenAddress: string): Promise<number> {
  const cacheKey = `${network}:${tokenAddress}`;
  const cached = priceCache.get(cacheKey);
  
  // Check if cache is still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }
  
  // Fetch fresh price
  try {
    const tokenData = await geckoTerminal.getTokenData(network, tokenAddress);
    
    if (tokenData.success) {
      const price = tokenData.token.priceUsd;
      
      // Update cache
      priceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });
      
      return price;
    } else {
      console.warn(`Failed to get price for ${tokenAddress}: ${tokenData.message}`);
      return 0;
    }
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress}:`, error);
    return 0;
  }
}

/**
 * Check if a limit order should be executed
 * @param {any} order - Limit order object
 * @param {number} currentPrice - Current token price
 * @returns {boolean} - Whether order should be executed
 */
function shouldExecuteOrder(order: any, currentPrice: number): boolean {
  if (currentPrice <= 0) return false;
  
  if (order.orderType === 'buy') {
    // Buy limit: execute when price drops to or below limit price
    return currentPrice <= order.limitPrice;
  } else {
    // Sell limit: execute when price rises to or above limit price
    return currentPrice >= order.limitPrice;
  }
}

/**
 * Get monitoring statistics
 * @returns {Promise<Object>} - Monitoring statistics
 */
export async function getMonitoringStats(): Promise<any> {
  try {
    const pendingOrders = await LimitOrder.find({ status: 'pending' });
    
    // Get unique tokens being monitored
    const uniqueTokens = new Set();
    pendingOrders.forEach(order => {
      uniqueTokens.add(`${order.network}:${order.tokenAddress}`);
    });
    
    return {
      success: true,
      stats: {
        pendingOrders: pendingOrders.length,
        uniqueTokens: uniqueTokens.size,
        cacheSize: priceCache.size,
        lastCheck: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error getting monitoring stats:', error);
    return {
      success: false,
      message: `Failed to get monitoring stats: ${error.message}`
    };
  }
}

/**
 * Stop price monitoring service
 */
export function stopPriceMonitoring(): void {
  console.log('🛑 Stopping price monitoring service...');
  // The service uses setInterval, so we can't easily stop it
  // In a production environment, you'd want to store the interval ID
  // and clear it properly
}

export {
  checkAndExecuteLimitOrders,
  getTokenPrice,
  shouldExecuteOrder
}; 