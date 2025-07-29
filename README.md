# Zoracle Telegram Bot

Zoracle is a Telegram bot for trading Zora content tokens on Base blockchain with advanced features including wallet management, swap engine, portfolio tracking, content discovery, alerts, and copy-trading.

## Features

### Wallet Management
- Generate/import Base-network Ethereum wallets (via seed phrase or private key)
- Encrypted local storage with PIN/passphrase
- Optional 2FA for sensitive actions

### In-Chat Swap Engine
- Buy/sell any Zora content token using Base-native ETH (or bridged USDC)
- Percent-based and fixed-amount commands (`/buy TOKEN 10%`, `/sell TOKEN 5`)
- Limit orders, stop-loss, take-profit with on-chain order placement

### Smart Routing & MEV Protection
- Integration with Paraswap as DEX-aggregator to source best price across Base DEXes
- Anti-sandwich routing: split large orders, rotate relayers, dynamic gas-tip control

### Portfolio Dashboard
- Show holdings above user-configurable thresholds
- Cost basis, P&L, and real-time USD valuation
- Drill-down per token: trade history, on-chain TXIDs, mini-charts

### Content-Coin Discovery
- Auto-index Zora content coins on Base by querying Zora's subgraph/API
- Search by content metadata (title, creator) or token address
- "New" feed (coins minted in last 24 hrs) and "Trending" feed (volume/holder spikes)

### Alerts & Notifications
- Price-threshold, liquidity-change, and whale-swap alerts for any token/watchlist
- Content-specific alerts (e.g., when a creator mints a new coin; when royalty settings change)

### Watchlists & Copy-Trading
- User-defined watchlists with grouped alerts
- "Mirror" feature: automatically replicate another wallet's trades (subject to slippage guard)

### Help & Support
- `/help` for command reference, inline tips, and first-time onboarding wizard
- Sandbox/testnet mode for risk-free practice

## Installation

### Prerequisites
- Node.js v16+
- Telegram Bot Token (from BotFather)
- Alchemy API Key for Base network
- Paraswap API Key (optional, for better swap rates)

### Setup
1. Clone the repository
```bash
git clone https://github.com/yourusername/zoracle-telegram.git
cd zoracle-telegram
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file with the following variables: