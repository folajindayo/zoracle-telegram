#!/bin/bash

# Zoracle Telegram Bot - Structure Migration Script
# This script helps migrate from the old structure to the new one.

# Create necessary directories
mkdir -p src/{bot,services,utils,database,config}
mkdir -p src/bot/handlers
mkdir -p src/database/{config,migrations,seeders}
mkdir -p database logs

# Copy files from old structure to new structure
echo "Copying files to new structure..."

# Bot files
if [ -f "bot/baseBot.js" ]; then
  cp bot/baseBot.js src/bot/
fi

if [ -f "bot/bot.js" ]; then
  cp bot/bot.js src/bot/
fi

if [ -f "bot/lockManager.js" ]; then
  cp bot/lockManager.js src/bot/
fi

# Bot handlers
if [ -d "bot/handlers" ]; then
  cp bot/handlers/* src/bot/handlers/
fi

# Services
if [ -f "services/copytrade.js" ]; then
  cp services/copytrade.js src/services/
fi

if [ -f "services/mempoolMonitor.js" ]; then
  cp services/mempoolMonitor.js src/services/
fi

if [ -f "services/trading.js" ]; then
  cp services/trading.js src/services/
fi

# Config
if [ -f "config.js" ]; then
  cp config.js src/config/index.js
fi

# Database
if [ -f "database/models.js" ]; then
  cp database/models.js src/database/
fi

if [ -f "database/operations.js" ]; then
  cp database/operations.js src/database/
fi

if [ -f "database/index.js" ]; then
  cp database/index.js src/database/
fi

if [ -f "database/init.js" ]; then
  cp database/init.js src/database/
fi

if [ -f "database/config/config.js" ]; then
  cp database/config/config.js src/database/config/
fi

if [ -d "database/migrations" ]; then
  cp database/migrations/* src/database/migrations/
fi

if [ -d "database/seeders" ]; then
  cp database/seeders/* src/database/seeders/
fi

# Root files
if [ -f "run.js" ]; then
  cp run.js ./
fi

echo "Migration complete!"
echo "Please update your imports to use the new structure."
echo "You can now run the bot with: npm start" 