#!/usr/bin/env node

/**
 * Fix initial and current values in positions
 * This script will update both initial and current values to match actual wallet balances
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import the Position model and services
const { Position } = require('./dist/database/models');
const { getTokenBalance } = require('./dist/services/cdpWallet');
const { getTokenData } = require('./dist/services/geckoTerminal');

async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zoracle';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get user ID from command line argument
    const userId = process.argv[2];
    if (!userId) {
      console.log('❌ Please provide a user ID as argument');
      console.log('Usage: node fix-initial-values.js <userId>');
      process.exit(1);
    }

    console.log(`🔧 Fixing initial and current values for user: ${userId}`);

    // Get all open positions for the user
    const openPositions = await Position.find({ telegramId: userId, status: 'open' });
    console.log(`📊 Found ${openPositions.length} open positions`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const position of openPositions) {
      try {
        console.log(`\n🔍 Processing position for ${position.tokenSymbol}:`);
        console.log(`   • Initial amount: ${position.initialAmount}`);
        console.log(`   • Initial USD: $${position.initialUsdValue}`);
        console.log(`   • Current amount: ${position.currentAmount}`);
        console.log(`   • Current USD: $${position.currentUsdValue}`);
        
        // Get actual wallet balance from CDP wallet API
        const balanceResult = await getTokenBalance(userId, position.tokenAddress);
        
        if (balanceResult.success && balanceResult.token && balanceResult.token.balance) {
          const actualBalance = parseFloat(balanceResult.token.balance);
          console.log(`   • Actual balance: ${actualBalance}`);
          
          // Get current token data
          const tokenDataResult = await getTokenData(position.network, position.tokenAddress);
          const currentPrice = tokenDataResult.success ? tokenDataResult.token.priceUsd : position.currentPrice;
          console.log(`   • Current price: $${currentPrice}`);
          
          // Preserve initial values (historical swap data) but update current values
          console.log(`   • Preserving initial values, updating current values...`);
          
          // Keep initial values as they were (historical swap data)
          // Only update current values with actual wallet balance
          position.currentAmount = actualBalance;
          position.currentUsdValue = actualBalance * currentPrice;
          position.currentPrice = currentPrice;
          
          // Recalculate PnL based on preserved initial values and updated current values
          const pnlUsd = position.currentUsdValue - position.initialUsdValue;
          position.pnlUsd = pnlUsd;
          position.pnlPercentage = position.initialUsdValue > 0 
            ? (pnlUsd / position.initialUsdValue) * 100 
            : 0;
          
          await position.save();
          console.log(`   ✅ Position updated successfully`);
          console.log(`   • Initial amount: ${position.initialAmount} (preserved)`);
          console.log(`   • Initial USD: $${position.initialUsdValue} (preserved)`);
          console.log(`   • New current amount: ${position.currentAmount}`);
          console.log(`   • New current USD: $${position.currentUsdValue}`);
          console.log(`   • New PnL: ${position.pnlPercentage.toFixed(2)}%`);
          
          fixedCount++;
        } else {
          console.log(`   ❌ Failed to get balance: ${balanceResult.message}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error fixing position ${position._id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Final Results:`);
    console.log(`   • Fixed: ${fixedCount} positions`);
    console.log(`   • Errors: ${errorCount} positions`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

main(); 