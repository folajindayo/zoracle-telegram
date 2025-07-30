/**
 * Zoracle Telegram Bot - Startup Script
 * 
 * This script checks for required environment variables and initializes the bot.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initialize: initializeDatabase } = require('./database/init');
const copyTradeService = require('./services/copytrade');

// Required environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'ALCHEMY_API_KEY',
  'MASTER_KEY'
];

// Check for required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ERROR: ${envVar} is not set in environment variables!`);
    console.error('Please create a .env file with the required variables.');
    process.exit(1);
  }
}

// Validate MASTER_KEY format (should be a hex string of appropriate length)
const masterKey = process.env.MASTER_KEY;
if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
  console.error('❌ ERROR: MASTER_KEY is not in the correct format!');
  console.error('It should be a 64-character hex string (32 bytes).');
  console.error('Generate one with: npm run generate-key');
  process.exit(1);
}

// Create necessary directories
const dirs = ['logs'];

for (const dir of dirs) {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`📁 Creating directory: ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Initialize database
console.log('🔄 Initializing database...');
initializeDatabase().then(async (success) => {
  if (!success) {
    console.error('❌ Failed to initialize database. Exiting...');
    process.exit(1);
  }
  
  console.log('✅ Database initialized successfully');
  
  // Initialize copy trade service
  console.log('🔄 Initializing copy trade service...');
  await copyTradeService.initialize();
  
  // Start the bot
  console.log('🔄 Starting bot...');
  require('./index');
}).catch((error) => {
  console.error('❌ Error during initialization:', error);
  process.exit(1);
}); 