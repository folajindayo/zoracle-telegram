#!/usr/bin/env node

/**
 * Fix existing positions in the database
 * This script will update all existing positions with actual wallet balances
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import the fix function
const { fixExistingPositions } = require('./dist/services/positions');

async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zoracle';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get user ID from command line argument or use a default
    const userId = process.argv[2];
    if (!userId) {
      console.log('❌ Please provide a user ID as argument');
      console.log('Usage: node fix-positions.js <userId>');
      process.exit(1);
    }

    console.log(`🔧 Fixing positions for user: ${userId}`);

    // Fix positions
    const result = await fixExistingPositions(userId);

    if (result.success) {
      console.log('✅ Positions fixed successfully!');
      console.log(`📊 Results:`);
      console.log(`   • Fixed: ${result.fixedCount} positions`);
      console.log(`   • Errors: ${result.errorCount}`);
      console.log(`   • Message: ${result.message}`);
    } else {
      console.log('❌ Failed to fix positions');
      console.log(`   • Error: ${result.message}`);
    }

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