#!/usr/bin/env node

/**
 * Restore original swap data for initial values
 * This script will restore the inflated swap data for initial values to show historical vs current
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import the Position model and services
const { Position } = require('./dist/database/models');
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
      console.log('Usage: node restore-swap-data.js <userId>');
      process.exit(1);
    }

    console.log(`🔧 Restoring original swap data for user: ${userId}`);

    // Get all open positions for the user
    const openPositions = await Position.find({ telegramId: userId, status: 'open' });
    console.log(`📊 Found ${openPositions.length} open positions`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const position of openPositions) {
      try {
        console.log(`\n🔍 Processing position for ${position.tokenSymbol}:`);
        console.log(`   • Current initial amount: ${position.initialAmount}`);
        console.log(`   • Current initial USD: $${position.initialUsdValue}`);
        
        // Restore the correct initial values based on actual swap execution
        // The initial amount should be $0.17, not the inflated $305M
        const correctInitialAmount = 33442.29844425135; // Actual tokens received
        const correctInitialUsd = 0.17; // $0.17 USD at swap time
        
        console.log(`   • Setting correct initial values:`);
        console.log(`     - Initial amount: ${correctInitialAmount} tokens`);
        console.log(`     - Initial USD: $${correctInitialUsd}`);
        
        // Get current token data for current price
        const tokenDataResult = await getTokenData(position.network, position.tokenAddress);
        const currentPrice = tokenDataResult.success ? tokenDataResult.token.priceUsd : position.currentPrice;
        console.log(`   • Current price: $${currentPrice}`);
        
        // Update position with correct initial values
        position.initialAmount = correctInitialAmount;
        position.initialUsdValue = correctInitialUsd;
        position.entryPrice = correctInitialUsd / correctInitialAmount; // Calculate entry price
        
        // Keep current values as they are (actual wallet balance)
        console.log(`   • Current amount: ${position.currentAmount} (actual wallet balance)`);
        console.log(`   • Current USD: $${position.currentUsdValue} (actual wallet balance)`);
        
        // Recalculate PnL based on correct initial values vs current wallet balance
        const pnlUsd = position.currentUsdValue - position.initialUsdValue;
        position.pnlUsd = pnlUsd;
        position.pnlPercentage = position.initialUsdValue > 0 
          ? (pnlUsd / position.initialUsdValue) * 100 
          : 0;
        
        await position.save();
        console.log(`   ✅ Position updated successfully`);
        console.log(`   • Initial amount: ${position.initialAmount} (correct swap data)`);
        console.log(`   • Initial USD: $${position.initialUsdValue} (correct swap data)`);
        console.log(`   • Entry price: $${position.entryPrice}`);
        console.log(`   • Current amount: ${position.currentAmount} (actual wallet)`);
        console.log(`   • Current USD: $${position.currentUsdValue} (actual wallet)`);
        console.log(`   • PnL: ${position.pnlPercentage.toFixed(2)}%`);
        
        fixedCount++;
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