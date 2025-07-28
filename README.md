# Zoracle Telegram Bot

This repository contains the Zoracle Telegram Bot and related components for monitoring creator activity on the Zora protocol and sending notifications to users via Telegram.

## Repository Structure

- **Root Directory**: Contains the Node.js Telegram bot files
  - `zoracleBot.js`: The main bot script
  - `package.json`: Dependencies and scripts for the bot
  - `.env`: Environment variables (API keys and tokens)

- **frontend/**: Frontend components that integrate with the Telegram bot
  - **components/**: React components
    - `TelegramConnectSettings.tsx`: UI for connecting Telegram to Zoracle
    - `CopyTradeListener.tsx`: Component that listens for creator activity and dispatches notifications
    - `CreatorMonitoringSettings.tsx`: UI for managing creator activity monitoring settings
  - **services/**: 
    - `telegramService.ts`: Service for interacting with Telegram API
  - **hooks/**: 
    - `useAlchemyCopyTradeMonitor.ts`: Hook for monitoring creator activity via Alchemy API
    - `useLocalStorage.ts`: Hook for managing state in localStorage

## Setup and Usage

### Telegram Bot

1. Navigate to the root directory
2. Create a `.env` file with your Telegram bot token:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token
   NODE_ENV=production
   ```
3. Install dependencies: `npm install`
4. Start the bot: `npm start`

### Frontend Integration

The frontend components are designed to be integrated into a React application. They provide:

1. UI for connecting users' Telegram accounts to Zoracle
2. Monitoring settings for creator activity
3. Automatic notification dispatch when activity is detected

## Bot Commands

- `/start your_wallet_address` - Connect a wallet to receive notifications
- `/status` - Check connection status
- `/chatid` - Get the current Telegram chat ID
- `/help` - Display help information

## Security Note

Never commit the `.env` file with actual API keys or tokens. The provided files may include placeholder values that should be replaced with your own keys. 