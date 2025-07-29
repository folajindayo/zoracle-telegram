// Base Zora Trading Bot - Trading Engine
const { ethers } = require('ethers');
const { CONFIG, ABIS } = require('./config');
const walletManager = require('./wallet');
const moment = require('moment');
const { ParaSwap } = require('paraswap-sdk'); // DEX aggregator

// Provider setup
const provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);

// Paraswap integration (for DEX aggregation)
const paraswap = new ParaSwap({
  network: 'base', // Base chain
  apiKey: process.env.PARASWAP_API_KEY // Get from env
});

// Limit orders storage (in-memory for simplicity, use DB in production)
const limitOrders = new Map();

// Stop-loss and take-profit orders
// These would need a monitoring loop to check prices and execute

/**
 * Calculate fee amount based on transaction value
 * @param {ethers.BigNumber} amount - Transaction amount in wei or token units
 * @returns {ethers.BigNumber} - Fee amount in same units
 */
function calculateFee(amount) {
  return amount.mul(CONFIG.FEE_PERCENTAGE).div(100);
}

/**
 * Get token information from contract
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} - Token information
 */
async function getTokenInfo(tokenAddress) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ABIS.ERC20_ABI, provider);
    
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      tokenContract.name().catch(() => "Unknown Token"),
      tokenContract.symbol().catch(() => "???"),
      tokenContract.decimals().catch(() => 18),
      tokenContract.totalSupply()
    ]);
    
    return {
      success: true,
      address: tokenAddress,
      name,
      symbol,
      decimals,
      totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
    };
  } catch (error) {
    console.error('Error getting token info:', error);
    return {
      success: false,
      message: 'Failed to get token info: ' + error.message
    };
  }
}

/**
 * Get price quote for token using Paraswap aggregator
 * @param {string} tokenAddress - Token address to buy/sell
 * @param {string} amountIn - Amount of input token (in ETH or token units)
 * @param {boolean} isBuy - Whether this is a buy (ETH->Token) or sell (Token->ETH)
 * @returns {Promise<Object>} - Price quote information
 */
async function getTokenQuote(tokenAddress, amountIn, isBuy) {
  try {
    // Get token info
    const tokenInfo = await getTokenInfo(tokenAddress);
    if (!tokenInfo.success) {
      return tokenInfo; // Return error
    }
    
    let srcToken, destToken;
    let srcAmount;
    
    if (isBuy) {
      srcToken = CONFIG.TOKENS.WETH;
      destToken = tokenAddress;
      srcAmount = ethers.utils.parseEther(amountIn.toString());
    } else {
      srcToken = tokenAddress;
      destToken = CONFIG.TOKENS.WETH;
      srcAmount = ethers.utils.parseUnits(amountIn.toString(), tokenInfo.decimals);
    }
    
    // Get best price from Paraswap
    const priceRoute = await paraswap.getRate({
      srcToken,
      destToken,
      srcAmount: srcAmount.toString(),
      userAddress: '0x...dummy', // Needed for some routes
      side: isBuy ? 'BUY' : 'SELL'
    });
    
    if (!priceRoute) {
      return { success: false, message: 'No route found' };
    }
    
    // Calculate fee
    const fee = calculateFee(srcAmount);
    const amountInWithFee = srcAmount.sub(fee);
    
    return {
      success: true,
      amountIn: isBuy 
        ? ethers.utils.formatEther(srcAmount) + ' ETH'
        : ethers.utils.formatUnits(srcAmount, tokenInfo.decimals) + ' ' + tokenInfo.symbol,
      amountOut: isBuy
        ? ethers.utils.formatUnits(priceRoute.destAmount, tokenInfo.decimals) + ' ' + tokenInfo.symbol
        : ethers.utils.formatEther(priceRoute.destAmount) + ' ETH',
      feeAmount: isBuy
        ? ethers.utils.formatEther(fee) + ' ETH'
        : ethers.utils.formatUnits(fee, tokenInfo.decimals) + ' ' + tokenInfo.symbol,
      feePercentage: CONFIG.FEE_PERCENTAGE,
      feeRecipient: CONFIG.FEE_RECIPIENT,
      pricePerToken: isBuy
        ? parseFloat(ethers.utils.formatEther(srcAmount)) / parseFloat(ethers.utils.formatUnits(priceRoute.destAmount, tokenInfo.decimals))
        : parseFloat(ethers.utils.formatEther(priceRoute.destAmount)) / parseFloat(ethers.utils.formatUnits(srcAmount, tokenInfo.decimals)),
      priceImpact: priceRoute.priceImpact,
      route: priceRoute.bestRoute,
      tokenInfo
    };
  } catch (error) {
    console.error('Error getting token quote:', error);
    return {
      success: false,
      message: 'Failed to get token quote: ' + error.message
    };
  }
}

/**
 * Parse buy/sell amount (fixed or percent-based)
 * @param {string} amountStr - Amount string like '10' or '10%'
 * @param {ethers.BigNumber} totalBalance - Total available balance
 * @returns {ethers.BigNumber} - Parsed amount
 */
function parseAmount(amountStr, totalBalance) {
  if (amountStr.endsWith('%')) {
    const percent = parseFloat(amountStr.slice(0, -1));
    return totalBalance.mul(Math.floor(percent * 100)).div(10000);
  } else {
    return ethers.utils.parseEther(amountStr);
  }
}

/**
 * Execute token swap using Paraswap with MEV protection
 * @param {string} userId - Telegram user ID
 * @param {string} tokenAddress - Token address to buy/sell
 * @param {string} amountIn - Amount of input token or percentage
 * @param {boolean} isBuy - Whether this is a buy (ETH->Token) or sell (Token->ETH)
 * @param {number} slippage - Slippage percentage (optional)
 * @returns {Promise<Object>} - Transaction result
 */
async function executeSwap(userId, tokenAddress, amountIn, isBuy, slippage = CONFIG.DEFAULT_SLIPPAGE) {
  try {
    // Check if wallet is unlocked
    const wallet = walletManager.getUnlockedWallet(userId);
    if (!wallet) {
      return {
        success: false,
        message: 'Wallet is locked. Please unlock your wallet first.'
      };
    }
    
    // Get token info
    const tokenInfo = await getTokenInfo(tokenAddress);
    if (!tokenInfo.success) {
      return tokenInfo; // Return error
    }
    
    // Get total balance for percentage calculation
    let totalBalance;
    if (isBuy) {
      totalBalance = await wallet.getBalance();
    } else {
      const tokenContract = new ethers.Contract(tokenAddress, ABIS.ERC20_ABI, provider);
      totalBalance = await tokenContract.balanceOf(wallet.address);
    }
    
    // Parse amount (handle percentage)
    const parsedAmountIn = parseAmount(amountIn, totalBalance);
    
    // Check sufficient balance
    if (totalBalance.lt(parsedAmountIn)) {
      return {
        success: false,
        message: 'Insufficient balance'
      };
    }
    
    let srcToken, destToken;
    if (isBuy) {
      srcToken = CONFIG.TOKENS.WETH;
      destToken = tokenAddress;
    } else {
      srcToken = tokenAddress;
      destToken = CONFIG.TOKENS.WETH;
    }
    
    // Get transaction data from Paraswap
    const txData = await paraswap.buildTx({
      srcToken,
      destToken,
      srcAmount: parsedAmountIn.toString(),
      slippage: slippage * 100, // Paraswap uses basis points
      userAddress: wallet.address
    });
    
    if (!txData) {
      return { success: false, message: 'No route found' };
    }
    
    // If MEV protection enabled, split the order
    if (CONFIG.MEV_PROTECTION.ENABLED && parsedAmountIn.gt(ethers.utils.parseEther(CONFIG.MEV_PROTECTION.THRESHOLD))) {
      return executeSplitOrder(userId, txData, parsedAmountIn, isBuy);
    }
    
    // Sign and send transaction
    const tx = await wallet.sendTransaction(txData);
    const receipt = await tx.wait();
    
    return {
      success: true,
      message: 'Swap executed successfully',
      transactionHash: receipt.transactionHash
    };
  } catch (error) {
    console.error('Error executing swap:', error);
    return {
      success: false,
      message: 'Failed to execute swap: ' + error.message
    };
  }
}

/**
 * Execute split order for MEV protection
 * @param {string} userId - Telegram user ID
 * @param {Object} txData - Base transaction data
 * @param {ethers.BigNumber} totalAmount - Total amount to split
 * @param {boolean} isBuy - Buy or sell
 * @returns {Promise<Object>} - Result
 */
async function executeSplitOrder(userId, txData, totalAmount, isBuy) {
  try {
    const wallet = walletManager.getUnlockedWallet(userId);
    const splits = CONFIG.MEV_PROTECTION.ORDER_SPLITS;
    const amountPerSplit = totalAmount.div(splits);
    
    const receipts = [];
    for (let i = 0; i < splits; i++) {
      // Adjust amount for this split
      const splitTxData = { ...txData };
      splitTxData.value = isBuy ? amountPerSplit : 0;
      // For sell, need to adjust approval and amount in call data - this is simplified
      
      // Random delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      
      // Dynamic gas tip (maxPriorityFeePerGas)
      const gasPrice = await provider.getGasPrice();
      splitTxData.maxPriorityFeePerGas = gasPrice.mul(2); // Aggressive tip for MEV protection
      
      const tx = await wallet.sendTransaction(splitTxData);
      const receipt = await tx.wait();
      receipts.push(receipt);
    }
    
    return {
      success: true,
      message: `Split order executed in ${splits} parts`,
      receipts
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to execute split order: ' + error.message
    };
  }
}

/**
 * Check if token has Zora content association
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<boolean>} - True if token is Zora-related
 */
async function isZoraToken(tokenAddress) {
  try {
    // Check if token was minted via Zora
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);
    const factory = new ethers.Contract(
      CONFIG.ZORA_CONTRACTS.FACTORY,
      ABIS.ZORA_FACTORY_ABI,
      provider
    );
    
    // Note: This is a simplified check
    // In a real implementation, we would check the contract's bytecode
    // or query Zora's API to verify token association
    
    // For demo purposes, let's just check if the address is valid
    return ethers.utils.isAddress(tokenAddress);
  } catch (error) {
    console.error('Error checking Zora token:', error);
    return false;
  }
}

/**
 * Create a limit order
 * @param {string} userId - Telegram user ID
 * @param {string} tokenAddress - Token address
 * @param {string} amount - Amount of ETH or tokens
 * @param {string} targetPrice - Target price
 * @param {boolean} isBuy - Whether this is a buy or sell limit
 * @returns {Promise<Object>} - Limit order result
 */
async function createLimitOrder(userId, tokenAddress, amount, targetPrice, isBuy) {
  const orderId = crypto.randomUUID();
  limitOrders.set(orderId, {
    userId,
    tokenAddress,
    amount,
    targetPrice: parseFloat(targetPrice),
    isBuy,
    createdAt: moment(),
    status: 'pending'
  });
  
  // In production, this would interact with an on-chain limit order protocol like 0x
  // or a monitoring service that executes when price condition met
  
  return {
    success: true,
    orderId,
    message: 'Limit order created successfully'
  };
}

/**
 * Create a stop-loss order
 * @param {string} userId - Telegram user ID
 * @param {string} tokenAddress - Token address
 * @param {string} amount - Amount to sell
 * @param {string} stopPrice - Stop price
 * @returns {Promise<Object>} - Order result
 */
async function createStopLoss(userId, tokenAddress, amount, stopPrice) {
  const orderId = crypto.randomUUID();
  limitOrders.set(orderId, {
    userId,
    tokenAddress,
    amount,
    stopPrice: parseFloat(stopPrice),
    type: 'stop-loss',
    status: 'pending'
  });
  
  return {
    success: true,
    orderId,
    message: 'Stop-loss order created successfully'
  };
}

/**
 * Create a take-profit order
 * @param {string} userId - Telegram user ID
 * @param {string} tokenAddress - Token address
 * @param {string} amount - Amount to sell
 * @param {string} profitPrice - Profit price
 * @returns {Promise<Object>} - Order result
 */
async function createTakeProfit(userId, tokenAddress, amount, profitPrice) {
  const orderId = crypto.randomUUID();
  limitOrders.set(orderId, {
    userId,
    tokenAddress,
    amount,
    profitPrice: parseFloat(profitPrice),
    type: 'take-profit',
    status: 'pending'
  });
  
  return {
    success: true,
    orderId,
    message: 'Take-profit order created successfully'
  };
}

/**
 * Get detailed portfolio for user
 * @param {string} userId - Telegram user ID
 * @returns {Promise<Object>} - Portfolio details
 */
async function getPortfolio(userId) {
  try {
    // Get wallet address
    const address = walletManager.getWalletAddress(userId);
    if (!address) {
      return {
        success: false,
        message: 'No wallet found for this user'
      };
    }
    
    // Get ETH balance
    const ethBalance = await provider.getBalance(address);
    const ethValueUSD = parseFloat(ethers.utils.formatEther(ethBalance)) * 1800; // Mock ETH price
    
    // In a real implementation, you would:
    // 1. Get a list of tokens owned by this address
    // 2. Get balances and prices for each token
    // 3. Calculate total portfolio value
    
    // For demonstration purposes, we'll return a mock portfolio
    return {
      success: true,
      address,
      portfolio: {
        ETH: {
          balance: ethers.utils.formatEther(ethBalance),
          valueUSD: ethValueUSD.toFixed(2),
          percentage: '100%'
        },
        // Mock tokens would be added here
      },
      totalValueUSD: ethValueUSD.toFixed(2)
    };
  } catch (error) {
    console.error('Error getting portfolio:', error);
    return {
      success: false,
      message: 'Failed to get portfolio: ' + error.message
    };
  }
}

module.exports = {
  getTokenInfo,
  getTokenQuote,
  executeSwap,
  isZoraToken,
  createLimitOrder,
  createStopLoss,
  createTakeProfit,
  getPortfolio
}; 