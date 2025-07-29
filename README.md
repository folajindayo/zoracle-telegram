# Zoracle Telegram Bot for Zora Content Coins

A Telegram bot for trading Zora content coins on the Base blockchain, built with Python.

## Features

- **Wallet Management**: Create or import wallets, check balances
- **Trading**: Buy and sell tokens directly from Telegram
- **Portfolio Tracking**: View your holdings and transaction history
- **Content Discovery**: Find new and trending Zora content tokens
- **Price Alerts**: Get notified when tokens reach price thresholds
- **Copy Trading**: Mirror trades from successful wallets
- **Watchlists**: Track tokens you're interested in

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/zoracle-telegram.git
   cd zoracle-telegram/python_bot
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up environment variables by creating a `.env` file:
   ```
   # API Keys
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   ALCHEMY_API_KEY=your_alchemy_api_key_here
   
   # Base Network RPC URLs
   BASE_MAINNET_RPC=https://base-mainnet.g.alchemy.com/v2/your_alchemy_api_key_here
   BASE_TESTNET_RPC=https://base-sepolia.g.alchemy.com/v2/your_alchemy_api_key_here
   
   # Security
   ENCRYPTION_KEY=your_encryption_key_here
   
   # Network settings (mainnet or testnet)
   NETWORK=testnet
   ```

4. Initialize the database:
   ```bash
   python -c "from database.models import init_db; init_db()"
   ```

## Usage

Start the bot:
```bash
python main.py
```

### Bot Commands

- `/start` - Start the bot and get a welcome message
- `/help` - Display help message with available commands
- `/wallet` - Manage your wallet
- `/balance` - Check your ETH and token balances
- `/buy <token_address> <amount>` - Buy tokens with ETH
- `/sell <token_address> <amount>` - Sell tokens for ETH
- `/portfolio` - View your portfolio
- `/transactions` - View your transaction history
- `/pnl` - Calculate profit/loss
- `/search <query>` - Search for tokens
- `/trending` - Show trending tokens
- `/new` - Show newly created tokens
- `/alerts` - Manage your price alerts
- `/addalert <token_address>` - Add a price alert
- `/mirror <wallet_address>` - Mirror another wallet's trades
- `/mirrors` - List active mirrors

## Architecture

The bot is built with a modular architecture:

- `bot/` - Telegram bot handlers and main logic
- `database/` - SQLAlchemy models and database operations
- `trading/` - Trading, portfolio, discovery, alerts, and copy-trading logic
- `utils/` - Wallet management and token utilities
- `web3_module/` - Web3 client for blockchain interactions

## Security

- Private keys are encrypted using Fernet encryption
- PIN protection for wallet operations
- Sandbox mode for copy-trading (simulated trades)
- Slippage protection for trades

## License

MIT

## Disclaimer

This bot is provided for educational purposes only. Use at your own risk. Always do your own research before trading cryptocurrencies. 