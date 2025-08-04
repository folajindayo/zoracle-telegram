# Position Tracking System

## Overview

The Zoracle Telegram Bot now includes a comprehensive position tracking system that automatically tracks user trades and calculates real-time PnL (Profit and Loss) using the GeckoTerminal API for accurate price data.

## Features

### 🎯 Automatic Position Creation
- Positions are automatically created when users execute swaps
- Tracks both buy and sell transactions
- Stores detailed swap information including gas costs and slippage

### 📊 Real-time PnL Calculation
- Uses GeckoTerminal API for accurate token prices
- Calculates both percentage and USD PnL
- Updates positions with current market data

### 📈 Trading Statistics
- Win rate analysis
- Best and worst trades tracking
- Average PnL per trade
- Total trading performance metrics

### 🔄 Position Management
- Update individual positions with current market data
- Bulk update all open positions
- Close positions manually or automatically
- Duration tracking for all positions

## Architecture

### Database Schema

The Position model includes the following fields:

```typescript
interface Position {
  telegramId: string;           // User's Telegram ID
  tokenAddress: string;         // Token contract address
  tokenSymbol: string;          // Token symbol (e.g., "PEPE")
  tokenName: string;            // Token name
  initialAmount: number;        // Initial token amount
  initialUsdValue: number;      // Initial USD value
  currentAmount: number;        // Current token amount
  currentUsdValue: number;      // Current USD value
  entryPrice: number;           // Entry price in USD
  currentPrice: number;         // Current price in USD
  pnlPercentage: number;        // PnL percentage
  pnlUsd: number;              // PnL in USD
  status: 'open' | 'closed';   // Position status
  entryTime: Date;             // Entry timestamp
  closeTime?: Date;            // Close timestamp
  duration?: string;           // Position duration
  txHash?: string;             // Transaction hash
  network: string;             // Network (e.g., "base")
  swapType: 'buy' | 'sell';   // Type of swap
  fromToken?: string;          // Token swapped from
  toToken?: string;            // Token swapped to
  fromAmount?: string;         // Amount swapped from
  toAmount?: string;           // Amount swapped to
  slippage?: number;           // Slippage percentage
  gasUsed?: string;            // Gas used
  gasPrice?: string;           // Gas price
}
```

### Services

#### 1. GeckoTerminal Service (`src/services/geckoTerminal.ts`)
- Fetches real-time token prices from GeckoTerminal API
- Gets pool data and token information
- Handles multiple token price requests efficiently

#### 2. Enhanced Positions Service (`src/services/positions.ts`)
- Database operations for position management
- Real-time PnL calculations
- Position statistics and analytics
- Integration with GeckoTerminal for price updates

#### 3. Enhanced Swaps Service (`src/services/enhancedSwaps.ts`)
- Executes swaps with automatic position tracking
- Provides position previews before swaps
- Integrates position updates with swap execution

### API Integration

#### GeckoTerminal API Endpoints Used

1. **Get Token Price**
   ```
   GET /networks/{network}/tokens/{token_address}/pools
   ```
   - Returns top pools for a token
   - Contains `base_token_price_usd` field for current price

2. **Get Token Pools**
   ```
   GET /networks/{network}/tokens/{token_address}/pools
   ```
   - Returns detailed pool information
   - Includes token metadata and relationships

3. **Get Supported Networks**
   ```
   GET /networks
   ```
   - Returns list of supported networks

## Usage

### Automatic Position Creation

When a user executes a swap, the system automatically:

1. **Executes the swap** using the existing swap API
2. **Fetches current token price** from GeckoTerminal
3. **Creates a position record** with swap details
4. **Calculates initial PnL** based on entry price

```typescript
// Example: Execute swap with position tracking
const result = await executeSwapWithPositionTracking(
  telegramId,
  accountName,
  fromToken,
  toToken,
  fromAmount,
  slippageBps,
  network
);
```

### Position Updates

Positions can be updated with current market data:

```typescript
// Update single position
const result = await updatePositionWithMarketData(telegramId, positionId);

// Update all open positions
const result = await updateAllOpenPositions(telegramId);
```

### Trading Statistics

Get comprehensive trading statistics:

```typescript
const stats = await getPositionStatistics(telegramId);
// Returns: totalTrades, winRate, totalPnL, averagePnL, etc.
```

## Bot Commands

### New Position Commands

1. **Update All Positions** (`/update_positions`)
   - Updates all open positions with current market data
   - Shows update summary with success/error counts

2. **Trading Statistics** (`/trading_stats`)
   - Displays comprehensive trading performance
   - Shows win rate, best/worst trades, total PnL

3. **Update Single Position** (`/update_position_{id}`)
   - Updates a specific position with current market data
   - Shows detailed position information

### Enhanced Position Display

The existing position display now includes:
- Real-time price updates
- Accurate PnL calculations
- Duration tracking
- Trading statistics integration

## Configuration

### Environment Variables

No additional environment variables are required. The system uses:
- Existing `ZORACLE_API_URL` for swap execution
- GeckoTerminal API (public, no API key required)

### Database Migration

Run the position tracking migration:

```bash
# The migration is automatically included in the database initialization
# Position model will be created when the bot starts
```

## Error Handling

### GeckoTerminal API Failures
- Graceful fallback to blockchain data
- Error logging for debugging
- User-friendly error messages

### Database Errors
- Transaction rollback on failures
- Detailed error logging
- Retry mechanisms for transient failures

### Network Issues
- Timeout handling (10 seconds for API calls)
- Retry logic for failed requests
- Fallback to cached data when available

## Performance Considerations

### Database Indexes
- Indexed on `telegramId` and `status` for fast queries
- Indexed on `entryTime` for chronological sorting
- Indexed on `tokenAddress` and `network` for price updates

### API Rate Limiting
- GeckoTerminal API calls are rate-limited
- Batch requests for multiple token prices
- Caching of frequently accessed data

### Memory Management
- Efficient position data structures
- Cleanup of old closed positions
- Optimized database queries

## Future Enhancements

### Planned Features
1. **Position Alerts**: Notify users of significant PnL changes
2. **Portfolio Analytics**: Advanced charting and analysis
3. **Risk Management**: Position sizing and stop-loss features
4. **Social Features**: Share trading performance with other users
5. **Export Functionality**: Export position data to CSV/PDF

### Technical Improvements
1. **WebSocket Integration**: Real-time price updates
2. **Advanced Caching**: Redis integration for faster queries
3. **Machine Learning**: Predictive analytics for trading patterns
4. **Multi-chain Support**: Support for additional networks

## Troubleshooting

### Common Issues

1. **Position Not Created After Swap**
   - Check GeckoTerminal API availability
   - Verify token address format
   - Review database connection

2. **Incorrect PnL Calculations**
   - Verify token price accuracy
   - Check for token decimal precision issues
   - Review swap amount calculations

3. **Slow Position Updates**
   - Check GeckoTerminal API response times
   - Review database query performance
   - Consider implementing caching

### Debug Commands

```bash
# Check GeckoTerminal API status
curl https://api.geckoterminal.com/api/v2/networks

# Test token price retrieval
curl "https://api.geckoterminal.com/api/v2/networks/base/tokens/0x123.../pools"

# Verify database connection
node -e "require('./src/database/models').initDb()"
```

## Security Considerations

### Data Privacy
- Position data is user-specific and private
- No sharing of trading data without consent
- Secure database access controls

### API Security
- GeckoTerminal API is public and doesn't require authentication
- All API calls use HTTPS
- Input validation for all user data

### Database Security
- MongoDB connection uses authentication
- Position data is encrypted at rest
- Regular security audits and updates

## Support

For issues related to position tracking:

1. **Check Logs**: Review application logs for error messages
2. **Verify API Status**: Check GeckoTerminal API availability
3. **Database Health**: Ensure MongoDB connection is stable
4. **User Permissions**: Verify user has proper access rights

The position tracking system provides a robust foundation for trading analytics and portfolio management within the Zoracle Telegram Bot. 