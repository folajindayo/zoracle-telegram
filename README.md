# Zoracle Telegram Bot

A Telegram bot for trading Zora content coins on Base blockchain with advanced features including wallet management, trading, portfolio tracking, content discovery, alerts, and copy-trading.

## Features

### Core Features
- **Wallet Management**: Create, import, and manage wallets with PIN protection
- **Trading**: Buy and sell tokens with slippage control and MEV protection
- **Portfolio Tracking**: Track your holdings, transaction history, and profit/loss

### Advanced Features
- **Content Discovery**: Find new and trending Zora content coins
- **Price Alerts**: Set alerts for price changes and liquidity events
- **Copy-Trading**: Mirror trades from target wallets with sandbox mode

### Security Features
- **CDP Server Wallets**: Secure wallets managed by Coinbase Developer Platform
- **PIN Protection**: PIN required for sensitive operations
- **MEV Protection**: Transaction splitting and random delays for large orders
- **Persistent Database**: MongoDB for secure data storage

### Technical Features
- **TypeScript**: Fully typed codebase for better developer experience
- **Modular Architecture**: Well-organized code structure for maintainability
- **Comprehensive Error Handling**: Robust error handling for API calls and database operations
- **Automated Testing**: Jest for unit and integration tests

## Installation

### Prerequisites
- Node.js v16 or higher
- npm or yarn

### Setup
1. Clone the repository:
```bash
git clone https://github.com/yourusername/zoracle-telegram-bot.git
cd zoracle-telegram-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```
# Required Variables
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Ankr RPC (Optional - defaults are provided in code)
PROVIDER_URL=https://rpc.ankr.com/base/your_ankr_api_key_here
TESTNET_PROVIDER_URL=https://rpc.ankr.com/base_sepolia/your_ankr_api_key_here

# UseZoracle API (CDP Integration)
ZORACLE_API_URL=https://usezoracle-telegrambot-production.up.railway.app
CDP_API_KEY=your_cdp_api_key_here
CDP_API_SECRET=your_cdp_api_secret_here
CDP_WALLET_SECRET=your_wallet_secret_here
CDP_NETWORK=base

# Security
MASTER_KEY=generate_with_npm_run_generate-key

# Network settings (mainnet or testnet)
NETWORK=mainnet
```

4. Generate a secure MASTER_KEY:
```bash
npm run generate-key
```
Copy the output and paste it as your MASTER_KEY in the `.env` file.

## Usage

### Starting the Bot
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

### TypeScript Build
```bash
npm run build
```

### Stopping the Bot
```bash
npm run kill-bot
```

## Bot Commands

### Wallet Commands
- `/wallet` - Manage your wallet (create, import, view balance)
- `/wallet create` - Create a new wallet
- `/wallet import` - Import an existing wallet
- `/wallet balance` - View your wallet balance
- `/wallet export` - Export your private key (PIN required)

### Trading Commands
- `/buy <token_address>` - Buy a token
- `/sell <token_address>` - Sell a token

### Portfolio Commands
- `/portfolio` - View your portfolio
- `/transactions` - View your transaction history
- `/pnl` - View your profit/loss

### Discovery Commands
- `/new` - View new Zora content coins
- `/trending` - View trending Zora content coins
- `/search <query>` - Search for tokens

### Alert Commands
- `/alerts` - View your active alerts
- `/addalert <token_address>` - Add a price alert for a token

### Copy-Trade Commands
- `/mirror <wallet_address>` - Mirror trades from a wallet
- `/mirrors` - View your active mirrors

## Architecture

The bot is built with a modular architecture:

- `src/` - Source code directory
  - `bot/` - Telegram bot handlers and utilities
    - `bot.js` - Main bot initialization
    - `baseBot.js` - Core blockchain utilities
    - `lockManager.js` - Prevents multiple bot instances
    - `handlers/` - Command handlers for different features

  - `services/` - Core services
    - `cdpWallet.js` - Coinbase Developer Platform Server Wallet integration
    - `trading.js` - Real DEX integration with Aerodrome
    - `mempoolMonitor.js` - Real-time blockchain monitoring
    - `copytrade.js` - Copy-trade implementation

  - `database/` - Database models and operations
    - `models.js` - Sequelize models for persistent storage
    - `operations.js` - Database operations
    - `migrations/` - Database schema migrations
    - `seeders/` - Sample data for testing
    - `config/` - Database configuration

  - `config/` - Centralized configuration
  - `utils/` - Utility functions
  - `types/` - TypeScript type definitions
  - `run.ts` - Entry point with environment checks
  - `index.ts` - Bot startup and graceful shutdown

- `dist/` - Compiled TypeScript output
- `logs/` - Log files

## Project Structure

```
zoracle-telegram-bot/
├── src/
│   ├── bot/
│   │   ├── baseBot.ts         # Core bot functionality
│   │   ├── bot.ts             # Main bot instance
│   │   ├── lockManager.ts     # Process lock management
│   │   ├── zoracleBot.ts      # Zora-specific functionality
│   │   └── handlers/          # Command handlers
│   │       ├── alertHandlers.ts
│   │       ├── copytradeHandlers.ts
│   │       ├── discoveryHandlers.ts
│   │       ├── portfolioHandlers.ts
│   │       ├── tradeHandlers.ts
│   │       └── walletHandlers.ts
│   ├── services/
│   │   ├── alerts.ts          # Price alert service
│   │   ├── cdpWallet.ts       # CDP Server Wallet integration
│   │   ├── copytrade.ts       # Copy trading functionality
│   │   ├── discovery.ts       # Token discovery service
│   │   ├── mempoolMonitor.ts  # Mempool monitoring
│   │   ├── monitoring.ts      # Price monitoring
│   │   ├── portfolio.ts       # Portfolio tracking
│   │   ├── trading.ts         # Trading functionality
│   │   ├── wallet.ts          # Wallet management
│   │   └── secure_wallets/    # Encrypted wallet storage
│   ├── database/
│   │   ├── config/            # Database configuration
│   │   ├── migrations/        # Database migrations
│   │   ├── seeders/           # Database seeders
│   │   ├── init.ts            # Database initialization
│   │   ├── models.ts          # Database models
│   │   └── operations.ts      # Database operations
│   ├── types/
│   │   └── index.ts           # TypeScript type definitions
│   ├── utils/
│   │   └── common.ts          # Utility functions
│   ├── config/
│   │   └── index.ts           # Configuration
│   ├── run.ts                 # Startup script
│   └── index.ts               # Main entry point
├── scripts/                   # Utility scripts
├── dist/                      # Compiled TypeScript output
├── .env                       # Environment variables
├── tsconfig.json              # TypeScript configuration
├── jest.config.js             # Jest configuration
└── package.json               # Dependencies
```

## Security Features

### Private Key Encryption
All private keys are encrypted using AES-256-CBC encryption with the MASTER_KEY before being stored.

### MEV Protection
Large orders are automatically split into smaller transactions with random delays to protect against MEV (Miner Extractable Value) attacks.

### PIN Protection
Sensitive operations like wallet creation, trading, and exporting private keys require PIN confirmation.

### Persistent Database
User data, wallet information, and transaction history are stored in MongoDB with proper encryption.

## CDP Server Wallets

The bot uses Coinbase Developer Platform (CDP) Server Wallets for enhanced security. This provides several advantages:

### Enhanced Security
- No private keys stored on the bot server
- Enterprise-grade security and compliance
- Multi-party computation (MPC) for transaction signing
- Secure key management by Coinbase infrastructure

## UseZoracle API Integration

The bot uses the UseZoracle API for wallet management and cryptocurrency operations through the Coinbase Developer Platform (CDP).

### Setting up UseZoracle API Integration

Add the following to your `.env` file:

```
# UseZoracle API Configuration
ZORACLE_API_URL=https://usezoracle-telegrambot-production.up.railway.app
CDP_API_KEY=your_cdp_api_key_here
CDP_API_SECRET=your_cdp_api_secret_here
CDP_WALLET_SECRET=your_wallet_secret_here
```

### Key Features

- **Account Management**: Create accounts, check balances, and securely store account data
- **Transaction Handling**: Transfer tokens between accounts with proper error handling
- **Security**: PIN protection, session timeouts, and encrypted wallet data storage

### Limitations
- Direct private key import is not supported with the UseZoracle API
- Users must create a new wallet through the bot interface

## Ankr RPC Integration

The bot uses Ankr's RPC endpoint for Base network to monitor blockchain activity. This replaces the previous Alchemy integration.

### Configuration

Add the following to your `.env` file to override the default endpoints:

```
# Optional - Override the default Ankr endpoints
PROVIDER_URL=https://rpc.ankr.com/base/YOUR_API_KEY
TESTNET_PROVIDER_URL=https://rpc.ankr.com/base_sepolia/YOUR_API_KEY
```

### Key Features

- **Rate Limiting**: Smart handling of Ankr's free tier limitations (~250-300 requests per minute)
- **Block Polling**: Efficient polling system for monitoring new blocks
- **Fallback Providers**: Automatic switching to alternative providers if Ankr is unavailable
- **Error Handling**: Exponential backoff and retry mechanisms for transient errors

### Fallback Providers

If the Ankr endpoint fails, the system automatically switches to one of these alternative providers:
1. Official Base RPC (https://mainnet.base.org)
2. LlamaRPC (https://base.llamarpc.com)
3. Bloxroute (https://base.rpc.blxrbdn.com)
4. 1RPC (https://1rpc.io/base)

## Advanced Trading Features

### Real DEX Integration
The bot integrates with Aerodrome DEX on Base for real trading execution.

### Real-time Mempool Monitoring
The bot monitors the blockchain mempool in real-time to detect transactions for copy-trading and alerts.

### Copy-Trading
Mirror trades from any wallet address with configurable settings:
- Maximum ETH per trade
- Slippage tolerance
- Sandbox mode for simulated trades

## Database

The bot uses MongoDB for persistent data storage. Here's how to set it up:

### MongoDB Atlas Setup

1. **Create a MongoDB Atlas Account**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up or log in
   - Create a new project (if you don't have one)
   - Create a new cluster (the free tier is sufficient for development)

2. **Configure Network Access**:
   - In the MongoDB Atlas dashboard, go to "Network Access" under "Security"
   - Click "Add IP Address"
   - You can either:
     - Add your current IP address (click "Add Current IP Address")
     - Allow access from anywhere (click "Allow Access from Anywhere") - not recommended for production
   - Click "Confirm"

3. **Create a Database User**:
   - In the MongoDB Atlas dashboard, go to "Database Access" under "Security"
   - Click "Add New Database User"
   - Enter a username and password
   - Select "Read and write to any database" under "Database User Privileges"
   - Click "Add User"

4. **Get Connection String**:
   - In the MongoDB Atlas dashboard, click "Connect" on your cluster
   - Select "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user's password
   - Add this connection string to your `.env` file as `MONGODB_URI`

5. **Test the Connection**:
   ```bash
   npm run db:test
   ```

### Database Operations

Initialize the database:
```bash
npm run db:init
```

Seed the database with sample data:
```bash
npm run db:seed
```

### Database Models

The bot uses the following MongoDB models:

- **User**: Stores user information and wallet details
- **Transaction**: Records all transactions (buy, sell, approve)
- **Alert**: Stores price alerts and notification settings
- **CopyTrade**: Configures copy-trading settings
- **Token**: Caches token information

## Troubleshooting

### 409 Conflict Error
If you see a "409 Conflict" error, it means another instance of the bot is already running. Use `npm run kill-bot` to stop all instances before starting a new one.

### Database Issues
If you encounter database errors, try deleting the `database/zoracle.sqlite` file and restarting the bot. This will create a fresh database.

### RPC Connection Issues
If you see RPC connection errors, check your Alchemy API key and network settings in the `.env` file.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
