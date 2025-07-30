/**
 * Trade Handlers for Zoracle Telegram Bot
 */
const { ethers } = require('ethers');
const { getEthBalance, getTokenBalance, getTokenInfo, decryptData } = require('../baseBot');
const { CONFIG, ABIS } = require('../../config');
const { buyTokensWithEth, sellTokensForEth, getTokenPrice, splitBuyOrder, splitSellOrder } = require('../../services/trading');
const { UserOps, TransactionOps } = require('../../database/operations');

// Trading states
const TRADE_STATES = {
  AWAITING_AMOUNT: 1,
  CONFIRMING_TRADE: 2
};

// In-memory trade state storage
const tradeStates = new Map();

module.exports = (bot, users) => {
  // Buy command
  bot.onText(/\/buy (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const tokenAddress = match[1].trim();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Validate token address
    if (!ethers.utils.isAddress(tokenAddress)) {
      bot.sendMessage(chatId, '❌ Invalid token address. Please provide a valid Ethereum address.');
      return;
    }
    
    try {
      // Get token info
      const tokenInfo = await getTokenInfo(tokenAddress);
      
      // Get token price
      const priceQuote = await getTokenPrice(tokenAddress);
      
      // Store trade state
      tradeStates.set(userId, {
        state: TRADE_STATES.AWAITING_AMOUNT,
        action: 'buy',
        tokenAddress,
        tokenInfo,
        priceQuote
      });
      
      // Get user's ETH balance
      const ethBalance = await getEthBalance(user.wallet.address);
      
      bot.sendMessage(chatId, 
        `You're buying ${tokenInfo.name} (${tokenInfo.symbol})\n\n` +
        `Current price: 1 ${tokenInfo.symbol} = ${priceQuote.price} ETH\n\n` +
        `Your ETH balance: ${ethBalance} ETH\n\n` +
        `How much ETH would you like to spend?`
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });
  
  // Sell command
  bot.onText(/\/sell (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const tokenAddress = match[1].trim();
    
    // Check if user has a wallet
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      return;
    }
    
    // Validate token address
    if (!ethers.utils.isAddress(tokenAddress)) {
      bot.sendMessage(chatId, '❌ Invalid token address. Please provide a valid Ethereum address.');
      return;
    }
    
    try {
      // Get token info
      const tokenInfo = await getTokenInfo(tokenAddress);
      
      // Get token balance
      const tokenBalance = await getTokenBalance(tokenAddress, user.wallet.address);
      
      // Check if user has tokens to sell
      if (parseFloat(tokenBalance) <= 0) {
        bot.sendMessage(chatId, `❌ You don't have any ${tokenInfo.symbol} tokens to sell.`);
        return;
      }
      
      // Get token price
      const priceQuote = await getTokenPrice(tokenAddress);
      
      // Store trade state
      tradeStates.set(userId, {
        state: TRADE_STATES.AWAITING_AMOUNT,
        action: 'sell',
        tokenAddress,
        tokenInfo,
        tokenBalance,
        priceQuote
      });
      
      bot.sendMessage(chatId, 
        `You're selling ${tokenInfo.name} (${tokenInfo.symbol})\n\n` +
        `Current price: 1 ${tokenInfo.symbol} = ${priceQuote.price} ETH\n\n` +
        `Your balance: ${tokenBalance} ${tokenInfo.symbol}\n\n` +
        `How many tokens would you like to sell? (You can also type "max" to sell all)`
      );
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  });
  
  // Handle trade amount input
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text;
    
    // Check if we're in a trade flow
    const tradeState = tradeStates.get(userId);
    
    if (!tradeState) return;
    
    // Get user
    const user = users.get(userId);
    
    if (!user || !user.wallet) {
      bot.sendMessage(chatId, 'You don\'t have a wallet set up yet. Use /wallet to set up a wallet.');
      tradeStates.delete(userId);
      return;
    }
    
    if (tradeState.state === TRADE_STATES.AWAITING_AMOUNT) {
      try {
        let amount;
        
        if (tradeState.action === 'buy') {
          // Parse ETH amount for buying
          if (text.toLowerCase() === 'max') {
            // Use all available ETH (minus some for gas)
            const ethBalance = await getEthBalance(user.wallet.address);
            amount = parseFloat(ethBalance) * 0.95; // Leave 5% for gas
          } else {
            amount = parseFloat(text);
          }
          
          // Validate amount
          if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chatId, '❌ Please enter a valid amount.');
            return;
          }
          
          // Check if user has enough ETH
          const ethBalance = await getEthBalance(user.wallet.address);
          
          if (amount > parseFloat(ethBalance)) {
            bot.sendMessage(chatId, `❌ You don't have enough ETH. Your balance is ${ethBalance} ETH.`);
            tradeStates.delete(userId);
            return;
          }
          
          // Estimate token amount
          const estimatedTokens = amount / parseFloat(tradeState.priceQuote.price);
          
          // Update trade state with estimated amount
          tradeStates.set(userId, {
            ...tradeState,
            state: TRADE_STATES.CONFIRMING_TRADE,
            amount,
            estimatedTokens
          });
          
          // Ask for confirmation with estimated amount
          bot.sendMessage(chatId, 
            `You are about to buy approximately ${estimatedTokens.toFixed(6)} ${tradeState.tokenInfo.symbol} ` +
            `with ${amount} ETH.\n\n` +
            `Note: Actual amount may vary due to price impact and slippage.\n\n` +
            `Please enter your PIN to confirm:`
          );
          
        } else if (tradeState.action === 'sell') {
          // Parse token amount for selling
          if (text.toLowerCase() === 'max') {
            amount = parseFloat(tradeState.tokenBalance);
          } else {
            amount = parseFloat(text);
          }
          
          // Validate amount
          if (isNaN(amount) || amount <= 0) {
            bot.sendMessage(chatId, '❌ Please enter a valid amount.');
            return;
          }
          
          // Check if user has enough tokens
          if (amount > parseFloat(tradeState.tokenBalance)) {
            bot.sendMessage(chatId, `❌ You don't have enough tokens. Your balance is ${tradeState.tokenBalance} ${tradeState.tokenInfo.symbol}.`);
            tradeStates.delete(userId);
            return;
          }
          
          // Estimate ETH amount
          const estimatedEth = amount * parseFloat(tradeState.priceQuote.price);
          
          // Update trade state
          tradeStates.set(userId, {
            ...tradeState,
            state: TRADE_STATES.CONFIRMING_TRADE,
            amount,
            estimatedEth
          });
          
          // Ask for confirmation with estimated amount
          bot.sendMessage(chatId, 
            `You are about to sell ${amount} ${tradeState.tokenInfo.symbol} ` +
            `for approximately ${estimatedEth.toFixed(6)} ETH.\n\n` +
            `Note: Actual amount may vary due to price impact and slippage.\n\n` +
            `Please enter your PIN to confirm:`
          );
        }
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        tradeStates.delete(userId);
      }
    } else if (tradeState.state === TRADE_STATES.CONFIRMING_TRADE) {
      // Verify PIN
      if (text !== user.pin) {
        bot.sendMessage(chatId, '❌ Incorrect PIN. Trade cancelled.');
        tradeStates.delete(userId);
        return;
      }
      
      try {
        // Execute trade
        bot.sendMessage(chatId, '⏳ Processing your trade...');
        
        // Decrypt private key
        const privateKey = decryptData(user.wallet.encryptedPrivateKey);
        
        // Execute trade based on action
        if (tradeState.action === 'buy') {
          // Check if MEV protection should be applied
          let result;
          if (CONFIG.MEV_PROTECTION.ENABLED && parseFloat(tradeState.amount) > parseFloat(CONFIG.MEV_PROTECTION.THRESHOLD)) {
            // Use order splitting for MEV protection
            result = await splitBuyOrder(
              tradeState.tokenAddress,
              tradeState.amount.toString(),
              privateKey,
              userId
            );
            
            // Sum up token amounts from all transactions
            const totalTokens = result.reduce((sum, tx) => sum + parseFloat(tx.tokenAmount), 0);
            
            bot.sendMessage(chatId, 
              `✅ Successfully bought ${totalTokens.toFixed(6)} ${tradeState.tokenInfo.symbol} with ${tradeState.amount} ETH!\n\n` +
              `Your order was split into ${result.length} transactions for MEV protection.`
            );
          } else {
            // Execute single transaction
            result = await buyTokensWithEth(
              tradeState.tokenAddress,
              tradeState.amount.toString(),
              privateKey,
              CONFIG.DEFAULT_SLIPPAGE,
              userId
            );
            
            bot.sendMessage(chatId, 
              `✅ Successfully bought ${result.tokenAmount} ${tradeState.tokenInfo.symbol} with ${tradeState.amount} ETH!\n\n` +
              `Transaction hash: ${result.txHash}`
            );
          }
        } else {
          // Check if MEV protection should be applied
          let result;
          if (CONFIG.MEV_PROTECTION.ENABLED && 
              tradeState.estimatedEth > parseFloat(CONFIG.MEV_PROTECTION.THRESHOLD)) {
            // Use order splitting for MEV protection
            result = await splitSellOrder(
              tradeState.tokenAddress,
              tradeState.amount.toString(),
              privateKey,
              userId
            );
            
            // Sum up ETH amounts from all transactions
            const totalEth = result.reduce((sum, tx) => sum + parseFloat(tx.ethAmount), 0);
            
            bot.sendMessage(chatId, 
              `✅ Successfully sold ${tradeState.amount} ${tradeState.tokenInfo.symbol} for ${totalEth.toFixed(6)} ETH!\n\n` +
              `Your order was split into ${result.length} transactions for MEV protection.`
            );
          } else {
            // Execute single transaction
            result = await sellTokensForEth(
              tradeState.tokenAddress,
              tradeState.amount.toString(),
              privateKey,
              CONFIG.DEFAULT_SLIPPAGE,
              userId
            );
            
            bot.sendMessage(chatId, 
              `✅ Successfully sold ${tradeState.amount} ${tradeState.tokenInfo.symbol} for ${result.ethAmount} ETH!\n\n` +
              `Transaction hash: ${result.txHash}`
            );
          }
        }
        
        // Clear trade state
        tradeStates.delete(userId);
        
      } catch (error) {
        bot.sendMessage(chatId, `❌ Error executing trade: ${error.message}`);
        tradeStates.delete(userId);
      }
    }
  });
}; 