// Main entry point for Zoracle Telegram Bot
import { acquireLock, releaseLock } from './bot/lockManager';
import { CONFIG } from './config';
import * as mempoolMonitor from './services/mempoolMonitor';
import * as copyTradeService from './services/copytrade';
import TelegramBot from 'node-telegram-bot-api';

// Define types for the bot and users
interface Users extends Map<string, any> {
  // Extending Map to match the actual structure used in bot.ts
}

// Start the bot
console.log(`
╭───────────────────────────────────────────────╮
│                                               │
│  🚀 Starting Zoracle Telegram Bot v${CONFIG.BOT_VERSION}...  │
│                                               │
╰───────────────────────────────────────────────╯
`);

// Try to acquire lock
if (!acquireLock()) {
  console.log('❌ Multiple bot instances detected!');
  console.log('Make sure only one instance of the bot is running.');
  console.log('Try running: pkill -f "node index.js" before starting again.');
  process.exit(1);
}

// Import bot after lock is acquired to prevent telegram polling conflicts
let bot: TelegramBot;
let users: Users;

// Using dynamic import since we need to ensure lock is acquired first
import('./bot/bot').then((botModule) => {
  bot = botModule.bot;
  users = botModule.users;

  // Initialize services
  console.log('🔍 Starting mempool monitoring service...');
  mempoolMonitor.startMonitoring();

  // Log startup success
  console.log(`
███████╗ ██████╗ ██████╗  █████╗  ██████╗██╗     ███████╗
╚══███╔╝██╔═══██╗██╔══██╗██╔══██╗██╔════╝██║     ██╔════╝
  ███╔╝ ██║   ██║██████╔╝███████║██║     ██║     █████╗  
 ███╔╝  ██║   ██║██╔══██╗██╔══██║██║     ██║     ██╔══╝  
███████╗╚██████╔╝██║  ██║██║  ██║╚██████╗███████╗███████╗
╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝
                                                       
🤖 Zoracle Telegram Bot v${CONFIG.BOT_VERSION} is running!

Use these commands to manage the bot:
- npm start: Start the bot
- npm run kill-bot: Stop the bot
- npm run dev: Start the bot in development mode (with ts-node)

Press Ctrl+C to stop the bot.
`);
});

// Export the bot instance and services for external use
export { bot, users, mempoolMonitor, copyTradeService };

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
function gracefulShutdown(): void {
  console.log('🛑 Shutting down gracefully...');
  
  // Stop the bot polling
  if (bot && typeof bot.isPolling === 'function' && bot.isPolling()) {
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