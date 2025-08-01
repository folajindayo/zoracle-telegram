/**
 * Trading Service for Zoracle Telegram Bot
 * 
 * This service handles all trading operations including:
 * - Token approvals
 * - Price quotes
 * - Swap execution
 * - MEV protection
 */
import { ethers  } from 'ethers';
import { Wallet, Contract  } from 'ethers';
import { formatEther, parseEther, formatUnits, parseUnits  } from '../utils/ethersUtils';
import axios from 'axios';
import { CONFIG, ABIS  } from '../config';
import { TransactionOps, TokenOps  } from '../database/operations';

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(CONFIG.PROVIDER_URL);

/**
 * Get token price from DEX
 * @param {string} tokenAddress - Token address
 * @param {string} outputTokenAddress - Output token address (default: WETH)
 * @param {string} amount - Amount of tokens to quote (default: 1 token)
 * @returns {Promise<Object>} - Price quote
 */
async function getTokenPrice(tokenAddress, outputTokenAddress = CONFIG.TOKENS.WETH, amount = '1'): Promise<any> {
  try {
    // Normalize addresses to checksum format to avoid "bad address checksum" errors
    const checksumTokenAddress = ethers.utils.getAddress(tokenAddress);
    const checksumOutputAddress = ethers.utils.getAddress(outputTokenAddress);
    
    // Get token decimals
    const tokenContract = new Contract(checksumTokenAddress, ABIS.ERC20_ABI, provider);
    let decimals;
    try {
      decimals = await tokenContract.decimals();
    } catch (err) {
      console.warn(`Error getting token decimals for ${checksumTokenAddress}: ${err.message}`);
      decimals = 18; // Default to 18 decimals if we can't fetch
    }
    
    // Format amount with proper decimals
    const formattedAmount = parseUnits(amount, decimals);
    
    // Use Aerodrome router for price quote
    const router = new Contract(CONFIG.DEX_ROUTERS.AERODROME, ABIS.AERODROME_ROUTER_ABI, provider);
    
    // Get amounts out with retry mechanism
    let amountOut, stable;
    try {
      [amountOut, stable] = await router.getAmountOut(
        formattedAmount,
        checksumTokenAddress,
        checksumOutputAddress
      );
    } catch (routerErr) {
      console.warn(`Router error getting price: ${routerErr.message}`);
      // Return default price if we can't get from router
      return {
        price: "0.000001", // Default low price when we can't fetch
        stable: false,
        inputAmount: amount,
        inputToken: checksumTokenAddress,
        outputToken: checksumOutputAddress,
        error: "Failed to get price from router"
      };
    }
    
    // Get output token decimals
    const outputTokenContract = new Contract(checksumOutputAddress, ABIS.ERC20_ABI, provider);
    let outputDecimals;
    try {
      outputDecimals = await outputTokenContract.decimals();
    } catch (err) {
      console.warn(`Error getting output token decimals: ${err.message}`);
      outputDecimals = 18; // Default to 18 decimals
    }
    
    // Format amount out
    const formattedAmountOut = formatUnits(amountOut, outputDecimals);
    
    // Try to update token price in database but don't fail if it doesn't work
    try {
      await TokenOps.upsertToken(checksumTokenAddress, {
        lastPrice: formattedAmountOut,
        priceUpdateTime: new Date()
      });
    } catch (dbErr) {
      console.warn(`Failed to update token price in database: ${dbErr.message}`);
    }
    
    return {
      price: formattedAmountOut,
      stable,
      inputAmount: amount,
      inputToken: checksumTokenAddress,
      outputToken: checksumOutputAddress
    };
  } catch (error) {
    console.error(`Error getting token price: ${error.message}`);
    // Return a fallback object instead of throwing
    return {
      price: "0.000001", // Default low price
      stable: false,
      inputAmount: amount,
      inputToken: tokenAddress,
      outputToken: outputTokenAddress,
      error: `Failed to get token price: ${error.message}`
    };
  }
}

/**
 * Check if token is approved for trading
 * @param {string} tokenAddress - Token address
 * @param {string} walletAddress - Wallet address
 * @param {string} spender - Spender address (default: Aerodrome router)
 * @returns {Promise<boolean>} - True if approved
 */
async function isTokenApproved(tokenAddress, walletAddress, spender = CONFIG.DEX_ROUTERS.AERODROME): Promise<any> {
  try {
    const tokenContract = new Contract(tokenAddress, ABIS.ERC20_ABI, provider);
    const allowance = await tokenContract.allowance(walletAddress, spender);
    
    // Consider approved if allowance is greater than 0
    return !allowance.isZero();
  } catch (error) {
    console.error(`Error checking token approval: ${error.message}`);
    throw new Error(`Failed to check token approval: ${error.message}`);
  }
}

/**
 * Approve token for trading
 * @param {string} tokenAddress - Token address
 * @param {string} privateKey - Wallet private key
 * @param {string} spender - Spender address (default: Aerodrome router)
 * @returns {Promise<Object>} - Transaction receipt
 */
async function approveToken(tokenAddress, privateKey, spender = CONFIG.DEX_ROUTERS.AERODROME): Promise<any> {
  try {
    // Create wallet from private key
    const wallet = new Wallet(privateKey, provider);
    
    // Create token contract instance
    const tokenContract = new Contract(tokenAddress, ABIS.ERC20_ABI, wallet);
    
    // Approve max amount
    const tx = await tokenContract.approve(
      spender,
      ethers.constants.MaxUint256,
      {
        gasLimit: CONFIG.DEFAULT_GAS_LIMIT,
        maxFeePerGas: await getOptimalGasPrice()
      }
    );
    
    console.log(`Approval transaction sent: ${tx.hash}`);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    // Record transaction in database
    await TransactionOps.createTransaction({
      telegramId: wallet.address, // Using wallet address as telegramId for now
      type: 'approval',
      tokenAddress,
      amount: 'max',
      txHash: tx.hash,
      status: 'confirmed',
      timestamp: new Date(),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: receipt.effectiveGasPrice.toString()
    });
    
    return receipt;
  } catch (error) {
    console.error(`Error approving token: ${error.message}`);
    throw new Error(`Failed to approve token: ${error.message}`);
  }
}

/**
 * Get optimal gas price with MEV protection
 * @returns {Promise<BigNumber>} - Optimal gas price in wei
 */
async function getOptimalGasPrice(): Promise<any> {
  try {
    // Get current gas price
    const feeData = await provider.getFeeData();
    
    // Add 10% to maxFeePerGas for faster confirmation
    const optimalGasPrice = feeData.maxFeePerGas.mul(110).div(100);
    
    return optimalGasPrice;
  } catch (error) {
    console.error(`Error getting optimal gas price: ${error.message}`);
    
    // Fallback to default gas price
    return parseUnits('5', 'gwei');
  }
}

/**
 * Buy tokens with ETH
 * @param {string} tokenAddress - Token address to buy
 * @param {string} amountETH - Amount of ETH to spend
 * @param {string} privateKey - Wallet private key
 * @param {number} slippage - Slippage percentage (default: 1.0)
 * @param {string} telegramId - Telegram user ID for database recording
 * @returns {Promise<Object>} - Transaction receipt
 */
async function buyTokensWithEth(tokenAddress, amountETH, privateKey, slippage = CONFIG.DEFAULT_SLIPPAGE, telegramId): Promise<any> {
  let pendingTx;
  try {
    // Create wallet from private key
    const wallet = new Wallet(privateKey, provider);
    
    // Parse ETH amount
    const ethAmount = parseEther(amountETH);
    
    // Get token info for recording
    const tokenContract = new Contract(tokenAddress, ABIS.ERC20_ABI, provider);
    const tokenSymbol = await tokenContract.symbol();
    
    // Create router contract instance
    const router = new Contract(CONFIG.DEX_ROUTERS.AERODROME, ABIS.AERODROME_ROUTER_ABI, wallet);
    
    // Calculate minimum amount out with slippage
    const route = [
      {
        input: CONFIG.TOKENS.WETH,
        output: tokenAddress,
        stable: false
      }
    ];
    
    // Get amounts out for 1 ETH to estimate price
    const amountsOut = await router.getAmountsOut(
      parseEther('1'),
      [CONFIG.TOKENS.WETH, tokenAddress]
    );
    
    // Calculate expected output based on input amount
    const expectedOutput = ethAmount.mul(amountsOut[1]).div(parseEther('1'));
    
    // Apply slippage tolerance
    const minAmountOut = expectedOutput.mul(100 - slippage).div(100);
    
    // Record transaction as pending
    pendingTx = await TransactionOps.createTransaction({
      telegramId,
      type: 'buy',
      tokenAddress,
      tokenSymbol,
      amount: '0', // Will update after confirmation
      ethValue: amountETH,
      status: 'pending',
      timestamp: new Date()
    });
    
    // Execute swap
    const tx = await router.swapExactETHForTokens(
      minAmountOut,
      route,
      wallet.address,
      Math.floor(Date.now() / 1000) + CONFIG.DEFAULT_TIMEOUT,
      {
        value: ethAmount,
        gasLimit: CONFIG.DEFAULT_GAS_LIMIT,
        maxFeePerGas: await getOptimalGasPrice()
      }
    );
    
    console.log(`Buy transaction sent: ${tx.hash}`);
    
    // Update transaction with hash
    await TransactionOps.updateTransaction(pendingTx.id, {
      txHash: tx.hash
    });
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    // Get actual token amount received
    const tokenBalanceBefore = pendingTx.amount || '0';
    const tokenBalanceAfter = await tokenContract.balanceOf(wallet.address);
    const tokenAmount = formatUnits(tokenBalanceAfter, await tokenContract.decimals());
    
    // Update transaction with confirmed status and token amount
    await TransactionOps.updateTransaction(pendingTx.id, {
      amount: tokenAmount,
      status: 'confirmed',
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: receipt.effectiveGasPrice.toString()
    });
    
    return {
      receipt,
      tokenAmount,
      ethAmount: amountETH,
      txHash: tx.hash
    };
  } catch (error) {
    console.error(`Error buying tokens: ${error.message}`);
    
    // Update transaction as failed if it was created
    if (pendingTx) {
      await TransactionOps.updateTransaction(pendingTx.id, {
        status: 'failed',
        error: error.message
      });
    }
    
    throw new Error(`Failed to buy tokens: ${error.message}`);
  }
}

/**
 * Sell tokens for ETH
 * @param {string} tokenAddress - Token address to sell
 * @param {string} amount - Amount of tokens to sell
 * @param {string} privateKey - Wallet private key
 * @param {number} slippage - Slippage percentage (default: 1.0)
 * @param {string} telegramId - Telegram user ID for database recording
 * @returns {Promise<Object>} - Transaction receipt
 */
async function sellTokensForEth(tokenAddress, amount, privateKey, slippage = CONFIG.DEFAULT_SLIPPAGE, telegramId): Promise<any> {
  let pendingTx;
  try {
    // Create wallet from private key
    const wallet = new Wallet(privateKey, provider);
    
    // Get token info
    const tokenContract = new Contract(tokenAddress, ABIS.ERC20_ABI, provider);
    const decimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol();
    
    // Parse token amount
    const tokenAmount = parseUnits(amount, decimals);
    
    // Check if token is approved
    const isApproved = await isTokenApproved(tokenAddress, wallet.address);
    if (!isApproved) {
      await approveToken(tokenAddress, privateKey);
    }
    
    // Create router contract instance
    const router = new Contract(CONFIG.DEX_ROUTERS.AERODROME, ABIS.AERODROME_ROUTER_ABI, wallet);
    
    // Calculate minimum amount out with slippage
    const route = [
      {
        input: tokenAddress,
        output: CONFIG.TOKENS.WETH,
        stable: false
      }
    ];
    
    // Get amounts out
    const amountsOut = await router.getAmountsOut(
      tokenAmount,
      [tokenAddress, CONFIG.TOKENS.WETH]
    );
    
    // Apply slippage tolerance
    const minAmountOut = amountsOut[1].mul(100 - slippage).div(100);
    
    // Record transaction as pending
    pendingTx = await TransactionOps.createTransaction({
      telegramId,
      type: 'sell',
      tokenAddress,
      tokenSymbol,
      amount,
      ethValue: '0', // Will update after confirmation
      status: 'pending',
      timestamp: new Date()
    });
    
    // Execute swap
    const tx = await router.swapExactTokensForETH(
      tokenAmount,
      minAmountOut,
      route,
      wallet.address,
      Math.floor(Date.now() / 1000) + CONFIG.DEFAULT_TIMEOUT,
      {
        gasLimit: CONFIG.DEFAULT_GAS_LIMIT,
        maxFeePerGas: await getOptimalGasPrice()
      }
    );
    
    console.log(`Sell transaction sent: ${tx.hash}`);
    
    // Update transaction with hash
    await TransactionOps.updateTransaction(pendingTx.id, {
      txHash: tx.hash
    });
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    // Calculate ETH received
    const ethReceived = formatEther(receipt.events.find(e => e.address === CONFIG.TOKENS.WETH).args.value);
    
    // Update transaction with confirmed status and ETH amount
    await TransactionOps.updateTransaction(pendingTx.id, {
      ethValue: ethReceived,
      status: 'confirmed',
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: receipt.effectiveGasPrice.toString()
    });
    
    return {
      receipt,
      tokenAmount: amount,
      ethAmount: ethReceived,
      txHash: tx.hash
    };
  } catch (error) {
    console.error(`Error selling tokens: ${error.message}`);
    
    // Update transaction as failed if it was created
    if (pendingTx) {
      await TransactionOps.updateTransaction(pendingTx.id, {
        status: 'failed',
        error: error.message
      });
    }
    
    throw new Error(`Failed to sell tokens: ${error.message}`);
  }
}

/**
 * Split large orders for MEV protection
 * @param {string} tokenAddress - Token address
 * @param {string} amountETH - Total ETH amount
 * @param {string} privateKey - Wallet private key
 * @param {string} telegramId - Telegram user ID
 * @returns {Promise<Array>} - Array of transaction receipts
 */
async function splitBuyOrder(tokenAddress, amountETH, privateKey, telegramId): Promise<any> {
  // Only split orders above threshold
  if (parseFloat(amountETH) <= parseFloat(CONFIG.MEV_PROTECTION.THRESHOLD)) {
    return [await buyTokensWithEth(tokenAddress, amountETH, privateKey, CONFIG.DEFAULT_SLIPPAGE, telegramId)];
  }
  
  const numSplits = CONFIG.MEV_PROTECTION.ORDER_SPLITS;
  const splitAmount = parseFloat(amountETH) / numSplits;
  const results = [];
  
  console.log(`Splitting ${amountETH} ETH buy order into ${numSplits} parts of ${splitAmount} ETH each`);
  
  for (let i = 0; i < numSplits; i++) {
    // Add random delay between transactions
    if (i > 0) {
      const delay = Math.floor(
        Math.random() * (CONFIG.MEV_PROTECTION.MAX_RANDOM_DELAY - CONFIG.MEV_PROTECTION.MIN_RANDOM_DELAY) + 
        CONFIG.MEV_PROTECTION.MIN_RANDOM_DELAY
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Execute part of the order
    const result = await buyTokensWithEth(
    tokenAddress,
      splitAmount.toFixed(6),
      privateKey,
      CONFIG.DEFAULT_SLIPPAGE,
      telegramId
    );
    
    results.push(result);
  }
  
  return results;
}

/**
 * Split large sell orders for MEV protection
 * @param {string} tokenAddress - Token address
 * @param {string} amount - Total token amount
 * @param {string} privateKey - Wallet private key
 * @param {string} telegramId - Telegram user ID
 * @returns {Promise<Array>} - Array of transaction receipts
 */
async function splitSellOrder(tokenAddress, amount, privateKey, telegramId): Promise<any> {
  // Get token price to determine if it's a large order
  const wallet = new Wallet(privateKey, provider);
  const priceQuote = await getTokenPrice(tokenAddress);
  const ethValue = parseFloat(amount) * parseFloat(priceQuote.price);
  
  // Only split orders above threshold
  if (ethValue <= parseFloat(CONFIG.MEV_PROTECTION.THRESHOLD)) {
    return [await sellTokensForEth(tokenAddress, amount, privateKey, CONFIG.DEFAULT_SLIPPAGE, telegramId)];
  }
  
  const numSplits = CONFIG.MEV_PROTECTION.ORDER_SPLITS;
  const splitAmount = parseFloat(amount) / numSplits;
  const results = [];
  
  console.log(`Splitting ${amount} token sell order into ${numSplits} parts of ${splitAmount} tokens each`);
  
  for (let i = 0; i < numSplits; i++) {
    // Add random delay between transactions
    if (i > 0) {
      const delay = Math.floor(
        Math.random() * (CONFIG.MEV_PROTECTION.MAX_RANDOM_DELAY - CONFIG.MEV_PROTECTION.MIN_RANDOM_DELAY) + 
        CONFIG.MEV_PROTECTION.MIN_RANDOM_DELAY
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Execute part of the order
    const result = await sellTokensForEth(
      tokenAddress,
      splitAmount.toFixed(6),
      privateKey,
      CONFIG.DEFAULT_SLIPPAGE,
      telegramId
    );
    
    results.push(result);
  }
  
  return results;
}

/**
 * Get token quote for trade
 * @param {string} tokenAddress - Token address
 * @param {string} amount - Amount to trade
 * @param {boolean} isBuy - True for buy, false for sell
 * @returns {Promise<Object>} - Quote details including price impact
 */
async function getTokenQuote(tokenAddress: string, amount: string, isBuy: boolean): Promise<any> {
  try {
    // Get base token price
    const basePrice = await getTokenPrice(tokenAddress);
    
    // Calculate price impact based on trade size
    const tradeAmount = isBuy ? parseFloat(amount) : parseFloat(amount) * parseFloat(basePrice.price);
    const priceImpact = calculatePriceImpact(tradeAmount, tokenAddress);
    
    return {
      basePrice: basePrice.price,
      expectedPrice: isBuy ? 
        parseFloat(basePrice.price) * (1 + priceImpact / 100) : 
        parseFloat(basePrice.price) * (1 - priceImpact / 100),
      priceImpact,
      tokenAddress,
      amount
    };
  } catch (error) {
    console.error(`Error getting token quote: ${error.message}`);
    throw new Error(`Failed to get token quote: ${error.message}`);
  }
}

/**
 * Calculate price impact based on trade size and token liquidity
 * @param {number} tradeAmount - Amount in ETH
 * @param {string} tokenAddress - Token address
 * @returns {number} - Price impact percentage
 */
function calculatePriceImpact(tradeAmount: number, tokenAddress: string): number {
  // In a real implementation, this would query the DEX for liquidity depth
  // and calculate actual price impact. This is a simplified mock.
  
  // Mock liquidity thresholds
  const lowLiquidity = tradeAmount > 1;  // > 1 ETH
  const mediumLiquidity = tradeAmount > 5;  // > 5 ETH
  const highLiquidity = tradeAmount > 20; // > 20 ETH
  
  // Return estimated price impact
  if (highLiquidity) return 5.0;  // 5% impact
  if (mediumLiquidity) return 2.5; // 2.5% impact
  if (lowLiquidity) return 1.0;   // 1% impact
  return 0.5; // 0.5% impact for small trades
}

/**
 * Execute a swap (buy or sell)
 * @param {string} userId - User ID
 * @param {string} tokenAddress - Token address
 * @param {string} amount - Amount to trade
 * @param {boolean} isBuy - True for buy, false for sell
 * @param {number} maxSlippage - Maximum allowed slippage
 * @returns {Promise<Object>} - Transaction receipt
 */
async function executeSwap(userId: string, tokenAddress: string, amount: string, isBuy: boolean, maxSlippage = 2): Promise<any> {
  try {
    // Get user wallet
    const cdpWallet = await import('./cdpWallet');
    const userWallet = await cdpWallet.getWallet(userId);
    
    if (!userWallet || !userWallet.privateKey) {
      throw new Error('Wallet not found or locked');
    }
    
    // Execute the trade
    if (isBuy) {
      return await buyTokensWithEth(tokenAddress, amount, userWallet.privateKey, maxSlippage, userId);
    } else {
      return await sellTokensForEth(tokenAddress, amount, userWallet.privateKey, maxSlippage, userId);
    }
  } catch (error) {
    console.error(`Error executing swap: ${error.message}`);
    throw new Error(`Failed to execute swap: ${error.message}`);
  }
}

export { 
  getTokenPrice,
  isTokenApproved,
  approveToken,
  buyTokensWithEth,
  sellTokensForEth,
  splitBuyOrder,
  splitSellOrder,
  getTokenQuote,
  executeSwap,
  getOptimalGasPrice
 }; 