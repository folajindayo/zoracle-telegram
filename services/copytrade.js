/**
 * Copy Trade Service for Zoracle Telegram Bot
 * 
 * This service monitors transactions from target wallets and mirrors their trades
 * based on user configurations.
 */
const { ethers } = require('ethers');
const { EventEmitter } = require('events');
const { Wallet, Contract } = require('ethers');
const { formatEther, parseEther, formatUnits } = require('ethers/lib/utils');
const { CONFIG, ABIS } = require('../config');
const { CopyTradeOps, UserOps, TransactionOps } = require('../database/operations');
const { buyTokensWithEth, sellTokensForEth, getTokenPrice } = require('./trading');
const mempoolMonitor = require('./mempoolMonitor');

// Create event emitter for trade events
const copyTradeEvents = new EventEmitter();

// Track active copy trade monitors
const activeMonitors = new Map();

/**
 * Initialize copy trade service
 * @returns {Promise<boolean>} - True if initialized successfully
 */
async function initialize() {
  try {
    console.log('🔄 Initializing copy trade service...');
    
    // Start mempool monitoring if not already active
    if (!mempoolMonitor.isActive()) {
      mempoolMonitor.startMonitoring();
    }
    
    // Get all active copy trades from database
    const activeCopyTrades = await getAllActiveCopyTrades();
    
    // Start monitoring for each target wallet
    for (const copyTrade of activeCopyTrades) {
      await startMonitoring(copyTrade.targetWallet);
    }
    
    console.log(`✅ Copy trade service initialized with ${activeCopyTrades.length} active monitors`);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize copy trade service:', error.message);
    return false;
  }
}

/**
 * Get all active copy trades from database
 * @returns {Promise<Array>} - Array of active copy trades
 */
async function getAllActiveCopyTrades() {
  try {
    // Query database for all active copy trades
    // Group by target wallet to avoid duplicate monitors
    const copyTrades = await CopyTradeOps.getAllActiveCopyTrades();
    
    // Group by target wallet
    const groupedByTarget = copyTrades.reduce((acc, copyTrade) => {
      const targetWallet = copyTrade.targetWallet.toLowerCase();
      if (!acc[targetWallet]) {
        acc[targetWallet] = [];
      }
      acc[targetWallet].push(copyTrade);
      return acc;
    }, {});
    
    // Flatten to unique target wallets with their followers
    return Object.keys(groupedByTarget).map(targetWallet => ({
      targetWallet,
      followers: groupedByTarget[targetWallet]
    }));
  } catch (error) {
    console.error('❌ Failed to get active copy trades:', error.message);
    return [];
  }
}

/**
 * Start monitoring a target wallet
 * @param {string} targetWallet - Target wallet address
 * @returns {Promise<boolean>} - True if started successfully
 */
async function startMonitoring(targetWallet) {
  try {
    // Normalize wallet address
    const normalizedAddress = targetWallet.toLowerCase();
    
    // Check if already monitoring
    if (activeMonitors.has(normalizedAddress)) {
      console.log(`🔍 Already monitoring wallet: ${normalizedAddress}`);
      return true;
    }
    
    console.log(`🔍 Starting copy trade monitoring for wallet: ${normalizedAddress}`);
    
    // Add mempool listener for this wallet
    const listenerId = `copy_trade_${normalizedAddress}`;
    
    mempoolMonitor.addListener(
      listenerId,
      'copy_trade',
      (tx) => tx.from.toLowerCase() === normalizedAddress,
      async (tx, data) => {
        await processCopyTrade(tx, data);
      },
      { targetWallet: normalizedAddress }
    );
    
    // Store in active monitors
    activeMonitors.set(normalizedAddress, {
      listenerId,
      startTime: Date.now()
    });
    
    console.log(`✅ Copy trade monitoring started for wallet: ${normalizedAddress}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to start monitoring for ${targetWallet}:`, error.message);
    return false;
  }
}

/**
 * Stop monitoring a target wallet
 * @param {string} targetWallet - Target wallet address
 * @returns {Promise<boolean>} - True if stopped successfully
 */
async function stopMonitoring(targetWallet) {
  try {
    // Normalize wallet address
    const normalizedAddress = targetWallet.toLowerCase();
    
    // Check if monitoring
    if (!activeMonitors.has(normalizedAddress)) {
      console.log(`🔍 Not monitoring wallet: ${normalizedAddress}`);
      return true;
    }
    
    console.log(`🔍 Stopping copy trade monitoring for wallet: ${normalizedAddress}`);
    
    // Get listener ID
    const { listenerId } = activeMonitors.get(normalizedAddress);
    
    // Remove mempool listener
    mempoolMonitor.removeListener(listenerId);
    
    // Remove from active monitors
    activeMonitors.delete(normalizedAddress);
    
    console.log(`✅ Copy trade monitoring stopped for wallet: ${normalizedAddress}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to stop monitoring for ${targetWallet}:`, error.message);
    return false;
  }
}

/**
 * Process a copy trade transaction
 * @param {Object} tx - Transaction object
 * @param {Object} data - Additional data
 * @returns {Promise<void>}
 */
async function processCopyTrade(tx, data) {
  try {
    const { targetWallet, copyTrades } = data;
    
    // Skip if no copy trades
    if (!copyTrades || copyTrades.length === 0) return;
    
    console.log(`👥 Processing copy trade transaction: ${tx.hash}`);
    console.log(`   Target wallet: ${targetWallet}`);
    console.log(`   Number of followers: ${copyTrades.length}`);
    
    // Analyze transaction to determine if it's a trade
    const tradeInfo = await analyzeTrade(tx);
    
    // Skip if not a trade
    if (!tradeInfo) {
      console.log(`   Not a trade transaction, skipping`);
      return;
    }
    
    console.log(`   Trade type: ${tradeInfo.type}`);
    console.log(`   Token: ${tradeInfo.tokenAddress}`);
    console.log(`   Amount: ${tradeInfo.amount}`);
    
    // Emit trade event
    copyTradeEvents.emit('trade', {
      tx,
      targetWallet,
      tradeInfo,
      copyTrades
    });
    
    // Execute mirror trades for each follower
    for (const copyTrade of copyTrades) {
      await executeMirrorTrade(copyTrade, tradeInfo);
    }
  } catch (error) {
    console.error(`❌ Error processing copy trade for ${tx.hash}:`, error.message);
  }
}

/**
 * Analyze a transaction to determine if it's a trade
 * @param {Object} tx - Transaction object
 * @returns {Promise<Object|null>} - Trade info or null if not a trade
 */
async function analyzeTrade(tx) {
  try {
    // Skip transactions with no data
    if (!tx.data || tx.data === '0x') return null;
    
    // Check if transaction is to a DEX router
    const isDexInteraction = Object.values(CONFIG.DEX_ROUTERS).some(
      router => tx.to && tx.to.toLowerCase() === router.toLowerCase()
    );
    
    if (!isDexInteraction) return null;
    
    // Try to decode transaction data
    const aerodromeRouterInterface = new ethers.utils.Interface(ABIS.AERODROME_ROUTER_ABI);
    
    try {
      const decodedData = aerodromeRouterInterface.parseTransaction({ data: tx.data, value: tx.value });
      const { name: functionName, args } = decodedData;
      
      // Process based on function name
      if (functionName === 'swapExactETHForTokens') {
        // ETH to Token swap (Buy)
        return {
          type: 'buy',
          tokenAddress: args.route[0].output,
          amount: formatEther(tx.value),
          ethAmount: formatEther(tx.value),
          rawAmount: tx.value,
          decodedData
        };
      } else if (functionName === 'swapExactTokensForETH') {
        // Token to ETH swap (Sell)
        return {
          type: 'sell',
          tokenAddress: args.route[0].input,
          amount: formatUnits(args.amountIn, 18), // Assuming 18 decimals, should be fetched
          ethAmount: null, // Will be determined after execution
          rawAmount: args.amountIn,
          decodedData
        };
      } else if (functionName === 'swapExactTokensForTokens') {
        // Token to Token swap (Sell + Buy)
        return {
          type: 'token_to_token',
          inputToken: args.route[0].input,
          outputToken: args.route[args.route.length - 1].output,
          amount: formatUnits(args.amountIn, 18), // Assuming 18 decimals
          rawAmount: args.amountIn,
          decodedData
        };
      }
    } catch (error) {
      console.error(`Error decoding transaction data: ${error.message}`);
      return null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error analyzing trade: ${error.message}`);
    return null;
  }
}

/**
 * Execute a mirror trade for a follower
 * @param {Object} copyTrade - Copy trade configuration
 * @param {Object} tradeInfo - Trade information
 * @returns {Promise<Object|null>} - Transaction result or null if failed
 */
async function executeMirrorTrade(copyTrade, tradeInfo) {
  try {
    console.log(`👥 Executing mirror trade for user ${copyTrade.telegramId}`);
    
    // Get user data
    const user = await UserOps.getUser(copyTrade.telegramId);
    
    if (!user || !user.walletAddress || !user.encryptedPrivateKey) {
      console.error(`❌ User ${copyTrade.telegramId} has no wallet`);
      return null;
    }
    
    // Add random delay for MEV protection
    const delay = Math.floor(
      Math.random() * (CONFIG.COPY_TRADING.MAX_DELAY - CONFIG.COPY_TRADING.MIN_DELAY) + 
      CONFIG.COPY_TRADING.MIN_DELAY
    );
    
    console.log(`   Adding ${delay}ms delay for MEV protection`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Execute trade based on type
    if (tradeInfo.type === 'buy') {
      return await executeMirrorBuy(user, copyTrade, tradeInfo);
    } else if (tradeInfo.type === 'sell') {
      return await executeMirrorSell(user, copyTrade, tradeInfo);
    } else if (tradeInfo.type === 'token_to_token') {
      // For token to token swaps, we'll skip for now
      console.log(`   Token to token swaps not supported yet`);
      return null;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error executing mirror trade:`, error.message);
    return null;
  }
}

/**
 * Execute a mirror buy
 * @param {Object} user - User data
 * @param {Object} copyTrade - Copy trade configuration
 * @param {Object} tradeInfo - Trade information
 * @returns {Promise<Object|null>} - Transaction result or null if failed
 */
async function executeMirrorBuy(user, copyTrade, tradeInfo) {
  try {
    // Calculate ETH amount based on copy trade settings
    const targetEthAmount = parseFloat(tradeInfo.ethAmount);
    const maxEthPerTrade = parseFloat(copyTrade.maxEthPerTrade);
    
    // Use the smaller of the two amounts
    let ethAmount = Math.min(targetEthAmount, maxEthPerTrade);
    
    // Check user's ETH balance
    const wallet = new ethers.Wallet(user.encryptedPrivateKey, new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL));
    const ethBalance = parseFloat(formatEther(await wallet.getBalance()));
    
    // Ensure we have enough ETH (leave some for gas)
    ethAmount = Math.min(ethAmount, ethBalance * 0.95);
    
    if (ethAmount <= 0) {
      console.error(`❌ Insufficient ETH balance for mirror trade`);
      return null;
    }
    
    console.log(`   Mirroring buy: ${ethAmount} ETH for ${tradeInfo.tokenAddress}`);
    
    // If in sandbox mode, just simulate the trade
    if (copyTrade.sandboxMode) {
      console.log(`   Sandbox mode: Simulating trade`);
      
      // Record simulated transaction
      await TransactionOps.createTransaction({
        telegramId: user.telegramId,
        type: 'simulated_buy',
        tokenAddress: tradeInfo.tokenAddress,
        amount: '0', // Simulated
        ethValue: ethAmount.toString(),
        status: 'simulated',
        timestamp: new Date()
      });
      
      // Emit event for notification
      copyTradeEvents.emit('mirror_trade_simulated', {
        telegramId: user.telegramId,
        type: 'buy',
        tokenAddress: tradeInfo.tokenAddress,
        ethAmount: ethAmount.toString()
      });
      
      return {
        simulated: true,
        ethAmount: ethAmount.toString()
      };
    }
    
    // Execute real trade
    const privateKey = user.encryptedPrivateKey; // In a real implementation, this should be decrypted
    
    const result = await buyTokensWithEth(
      tradeInfo.tokenAddress,
      ethAmount.toString(),
      privateKey,
      copyTrade.slippage,
      user.telegramId
    );
    
    // Emit event for notification
    copyTradeEvents.emit('mirror_trade_executed', {
      telegramId: user.telegramId,
      type: 'buy',
      tokenAddress: tradeInfo.tokenAddress,
      ethAmount: ethAmount.toString(),
      tokenAmount: result.tokenAmount,
      txHash: result.txHash
    });
    
    return result;
  } catch (error) {
    console.error(`❌ Error executing mirror buy:`, error.message);
    return null;
  }
}

/**
 * Execute a mirror sell
 * @param {Object} user - User data
 * @param {Object} copyTrade - Copy trade configuration
 * @param {Object} tradeInfo - Trade information
 * @returns {Promise<Object|null>} - Transaction result or null if failed
 */
async function executeMirrorSell(user, copyTrade, tradeInfo) {
  try {
    // Check if user has the token
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);
    const tokenContract = new Contract(tradeInfo.tokenAddress, ABIS.ERC20_ABI, provider);
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Get user's token balance
    const tokenBalance = await tokenContract.balanceOf(user.walletAddress);
    const formattedBalance = formatUnits(tokenBalance, decimals);
    
    if (parseFloat(formattedBalance) <= 0) {
      console.log(`   User has no ${tradeInfo.tokenAddress} tokens to sell`);
      return null;
    }
    
    // Calculate percentage of holdings to sell (match the target's percentage)
    // This would require knowing the target's total holdings, which we don't have
    // For now, we'll just sell the same percentage of our balance as the target did
    // Assuming the target sold 100% for simplicity
    const sellAmount = formattedBalance;
    
    console.log(`   Mirroring sell: ${sellAmount} tokens of ${tradeInfo.tokenAddress}`);
    
    // If in sandbox mode, just simulate the trade
    if (copyTrade.sandboxMode) {
      console.log(`   Sandbox mode: Simulating trade`);
      
      // Get estimated ETH value
      const priceQuote = await getTokenPrice(tradeInfo.tokenAddress);
      const estimatedEth = parseFloat(sellAmount) * parseFloat(priceQuote.price);
      
      // Record simulated transaction
      await TransactionOps.createTransaction({
        telegramId: user.telegramId,
        type: 'simulated_sell',
        tokenAddress: tradeInfo.tokenAddress,
        amount: sellAmount,
        ethValue: estimatedEth.toString(),
        status: 'simulated',
        timestamp: new Date()
      });
      
      // Emit event for notification
      copyTradeEvents.emit('mirror_trade_simulated', {
        telegramId: user.telegramId,
        type: 'sell',
        tokenAddress: tradeInfo.tokenAddress,
        tokenAmount: sellAmount,
        estimatedEth: estimatedEth.toString()
      });
      
      return {
        simulated: true,
        tokenAmount: sellAmount,
        estimatedEth: estimatedEth.toString()
      };
    }
    
    // Execute real trade
    const privateKey = user.encryptedPrivateKey; // In a real implementation, this should be decrypted
    
    const result = await sellTokensForEth(
      tradeInfo.tokenAddress,
      sellAmount,
      privateKey,
      copyTrade.slippage,
      user.telegramId
    );
    
    // Emit event for notification
    copyTradeEvents.emit('mirror_trade_executed', {
      telegramId: user.telegramId,
      type: 'sell',
      tokenAddress: tradeInfo.tokenAddress,
      tokenAmount: sellAmount,
      ethAmount: result.ethAmount,
      txHash: result.txHash
    });
    
    return result;
  } catch (error) {
    console.error(`❌ Error executing mirror sell:`, error.message);
    return null;
  }
}

/**
 * Add a copy trade configuration
 * @param {string} telegramId - Telegram user ID
 * @param {string} targetWallet - Target wallet address
 * @param {string} maxEthPerTrade - Maximum ETH per trade
 * @param {number} slippage - Slippage percentage
 * @param {boolean} sandboxMode - Sandbox mode (simulate trades)
 * @returns {Promise<Object>} - Created copy trade configuration
 */
async function addCopyTrade(telegramId, targetWallet, maxEthPerTrade, slippage = 2.0, sandboxMode = true) {
  try {
    // Normalize wallet address
    const normalizedAddress = targetWallet.toLowerCase();
    
    // Create copy trade in database
    const copyTrade = await CopyTradeOps.createCopyTrade({
      telegramId,
      targetWallet: normalizedAddress,
      maxEthPerTrade,
      slippage,
      sandboxMode,
      active: true
    });
    
    // Start monitoring if not already active
    await startMonitoring(normalizedAddress);
    
    return copyTrade;
  } catch (error) {
    console.error(`❌ Error adding copy trade:`, error.message);
    throw error;
  }
}

/**
 * Update a copy trade configuration
 * @param {string} id - Copy trade ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<boolean>} - True if updated successfully
 */
async function updateCopyTrade(id, updateData) {
  try {
    // Update copy trade in database
    const success = await CopyTradeOps.updateCopyTrade(id, updateData);
    return success;
  } catch (error) {
    console.error(`❌ Error updating copy trade:`, error.message);
    throw error;
  }
}

/**
 * Toggle copy trade active status
 * @param {string} id - Copy trade ID
 * @param {boolean} active - Active status
 * @returns {Promise<boolean>} - True if updated successfully
 */
async function toggleCopyTradeActive(id, active) {
  try {
    // Update copy trade in database
    const success = await CopyTradeOps.toggleCopyTradeActive(id, active);
    
    // If deactivating, check if we need to stop monitoring
    if (!active) {
      const copyTrade = await CopyTradeOps.getCopyTrade(id);
      
      if (copyTrade) {
        // Check if there are other active copy trades for this target
        const activeCopyTrades = await CopyTradeOps.getActiveTargetCopyTrades(copyTrade.targetWallet);
        
        if (activeCopyTrades.length === 0) {
          // No more active copy trades for this target, stop monitoring
          await stopMonitoring(copyTrade.targetWallet);
        }
      }
    }
    
    return success;
  } catch (error) {
    console.error(`❌ Error toggling copy trade active status:`, error.message);
    throw error;
  }
}

/**
 * Delete a copy trade configuration
 * @param {string} id - Copy trade ID
 * @returns {Promise<boolean>} - True if deleted successfully
 */
async function deleteCopyTrade(id) {
  try {
    // Get copy trade details first
    const copyTrade = await CopyTradeOps.getCopyTrade(id);
    
    if (!copyTrade) {
      return false;
    }
    
    // Delete copy trade from database
    const success = await CopyTradeOps.deleteCopyTrade(id);
    
    // Check if we need to stop monitoring
    if (success) {
      // Check if there are other active copy trades for this target
      const activeCopyTrades = await CopyTradeOps.getActiveTargetCopyTrades(copyTrade.targetWallet);
      
      if (activeCopyTrades.length === 0) {
        // No more active copy trades for this target, stop monitoring
        await stopMonitoring(copyTrade.targetWallet);
      }
    }
    
    return success;
  } catch (error) {
    console.error(`❌ Error deleting copy trade:`, error.message);
    throw error;
  }
}

/**
 * Get copy trade event emitter
 * @returns {EventEmitter} - Copy trade event emitter
 */
function getEventEmitter() {
  return copyTradeEvents;
}

module.exports = {
  initialize,
  startMonitoring,
  stopMonitoring,
  addCopyTrade,
  updateCopyTrade,
  toggleCopyTradeActive,
  deleteCopyTrade,
  getEventEmitter
}; 