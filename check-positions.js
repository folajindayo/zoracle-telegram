#!/usr/bin/env node

/**
 * Check existing positions in the database
 * This script will show all positions and their user IDs
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import the Position model
const { Position } = require('./dist/database/models');

async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zoracle';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get all positions
    const positions = await Position.find({}).sort({ entryTime: -1 });

    console.log(`📊 Found ${positions.length} total positions in database`);

    if (positions.length === 0) {
      console.log('❌ No positions found in database');
      return;
    }

    // Group by user ID
    const userGroups = {};
    positions.forEach(pos => {
      if (!userGroups[pos.telegramId]) {
        userGroups[pos.telegramId] = [];
      }
      userGroups[pos.telegramId].push(pos);
    });

    console.log('\n👥 Users with positions:');
    Object.keys(userGroups).forEach(userId => {
      const userPositions = userGroups[userId];
      const openPositions = userPositions.filter(p => p.status === 'open');
      const closedPositions = userPositions.filter(p => p.status === 'closed');
      
      console.log(`\n📱 User ID: ${userId}`);
      console.log(`   • Total positions: ${userPositions.length}`);
      console.log(`   • Open positions: ${openPositions.length}`);
      console.log(`   • Closed positions: ${closedPositions.length}`);
      
      // Show details of open positions
      openPositions.forEach((pos, index) => {
        console.log(`   📈 Position ${index + 1}:`);
        console.log(`      • Token: ${pos.tokenSymbol} (${pos.tokenAddress})`);
        console.log(`      • Initial Amount: ${pos.initialAmount}`);
        console.log(`      • Current Amount: ${pos.currentAmount}`);
        console.log(`      • Initial USD: $${pos.initialUsdValue}`);
        console.log(`      • Current USD: $${pos.currentUsdValue}`);
        console.log(`      • Entry Price: $${pos.entryPrice}`);
        console.log(`      • Current Price: $${pos.currentPrice}`);
        console.log(`      • PnL: ${pos.pnlPercentage}%`);
      });
    });

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