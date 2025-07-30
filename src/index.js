// Main entry point for Zoracle Telegram Bot
const { acquireLock, releaseLock } = require('./bot/lockManager');
const { CONFIG } = require('./config');
const mempoolMonitor = require('./services/mempoolMonitor');
const copyTradeService = require('./services/copytrade');

// Start the bot
console.log(`🚀 Starting Zoracle Telegram Bot v${CONFIG.BOT_VERSION}...`);

// Try to acquire lock
if (!acquireLock()) {
  console.log('❌ Multiple bot instances detected!');
  console.log('Make sure only one instance of the bot is running.');
  console.log('Try running: pkill -f "node index.js" before starting again.');
  process.exit(1);
}

// Import bot after lock is acquired to prevent telegram polling conflicts
const { bot, users } = require('./bot/bot');

// Initialize services
console.log('🔍 Starting mempool monitoring service...');
mempoolMonitor.startMonitoring();

// Log startup success
console.log(`
🤖 Zoracle Telegram Bot is running!

Use these commands to manage the bot:
- npm start: Start the bot
- npm run kill-bot: Stop the bot
- npm run dev: Start the bot in development mode (with nodemon)

Press Ctrl+C to stop the bot.
`);

// Export the bot instance and services for external use
module.exports = { bot, users, mempoolMonitor, copyTradeService };

// Graceful shutdown handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

/**
 * Gracefully shutdown the bot and release resources
 */
function gracefulShutdown() {
  console.log('🛑 Shutting down gracefully...');
  
  // Stop the bot polling
  if (bot && bot.isPolling()) {
    console.log('🤖 Stopping bot polling...');
    bot.stopPolling();
  }
  
  // Stop mempool monitoring if active
  if (mempoolMonitor.isActive()) {
    console.log('🔍 Stopping mempool monitoring...');
    mempoolMonitor.stopMonitoring();
  }
  
  // Release the lock
  releaseLock();
  
  console.log('👋 Goodbye!');
  process.exit(0);
} 