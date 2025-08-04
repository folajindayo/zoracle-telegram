#!/usr/bin/env node

/**
 * Force fix existing positions in the database
 * This script will update all existing positions with actual wallet balances
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import the Position model and services
const { Position } = require('./dist/database/models');
const { getTokenBalance } = require('./dist/services/cdpWallet');
const { getTokenPrice } = require('./dist/services/geckoTerminal');

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
      console.log('Usage: node force-fix-positions.js <userId>');
      process.exit(1);
    }

    console.log(`🔧 Force fixing positions for user: ${userId}`);

    // Get all open positions for the user
    const openPositions = await Position.find({ telegramId: userId, status: 'open' });
    console.log(`📊 Found ${openPositions.length} open positions`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const position of openPositions) {
      try {
        console.log(`\n🔍 Processing position for ${position.tokenSymbol}:`);
        console.log(`   • Stored amount: ${position.currentAmount}`);
        console.log(`   • Stored USD: $${position.currentUsdValue}`);
        
        // Get actual wallet balance from CDP wallet API
        const balanceResult = await getTokenBalance(userId, position.tokenAddress);
        
        if (balanceResult.success && balanceResult.balance) {
          const actualBalance = parseFloat(balanceResult.balance);
          console.log(`   • Actual balance: ${actualBalance}`);
          
          // Calculate difference
          const difference = Math.abs(actualBalance - position.currentAmount) / position.currentAmount;
          console.log(`   • Difference: ${(difference * 100).toFixed(2)}%`);
          
          // Force update regardless of difference
          console.log(`   • Forcing update...`);
          
          // Get current price
          const priceResult = await getTokenPrice(position.network, position.tokenAddress);
          const currentPrice = priceResult.success ? priceResult.price : position.currentPrice;
          console.log(`   • Current price: $${currentPrice}`);
          
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
          console.log(`   ✅ Position updated successfully`);
          console.log(`   • New amount: ${position.currentAmount}`);
          console.log(`   • New USD: $${position.currentUsdValue}`);
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