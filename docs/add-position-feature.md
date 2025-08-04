# Add Position Feature Implementation

## Overview

The Add Position feature allows users to create new trading positions by executing swaps through the Zoracle Telegram Bot. This feature integrates position tracking with swap execution, providing users with comprehensive trading management capabilities.

## Architecture

### Core Components

1. **Position Handlers** (`src/bot/handlers/positionHandlers.ts`)
   - `handleAddPosition()` - Initiates the add position flow
   - `handleShowPositions()` - Displays all user positions
   - `handleShowOpenPositions()` - Shows open positions only
   - `handleShowClosedPositions()` - Shows closed positions only

2. **Position Service** (`src/services/positions.ts`)
   - `createPositionFromSwap()` - Creates position from swap data
   - `updatePositionWithMarketData()` - Updates position with current prices
   - `getUserPositions()` - Retrieves user positions
   - `getPositionStatistics()` - Calculates trading statistics

3. **Enhanced Swaps** (`src/services/enhancedSwaps.ts`)
   - `executeSwapWithPositionTracking()` - Executes swap and creates position
   - `getSwapPriceWithPositionPreview()` - Shows price preview with position data

4. **Message Handlers** (`src/bot/bot.ts`)
   - Handles `AWAITING_SWAP_AMOUNT` state for amount input
   - Handles `AWAITING_CUSTOM_TOKEN` state for custom token input
   - Executes swaps with position tracking

## User Flow

### 1. Initiate Add Position
```
User clicks "➕ Add Position" 
→ handleAddPosition() 
→ Shows trading options
```

### 2. Select Trading Method
```
User selects trading option:
- 🔄 Quick Swap
- 🎯 Token Sniper  
- ⏱️ Limit Order
- 👥 Copy Trade
```

### 3. Token Selection
```
User selects from token → to token
→ handleSwapFrom() → handleSwapTo()
→ Sets conversation state to AWAITING_SWAP_AMOUNT
```

### 4. Amount Input
```
User enters amount
→ Message handler processes input
→ Validates amount
→ Shows loading message
```

### 5. Swap Execution
```
executeSwapWithPositionTracking()
→ Executes swap via API
→ Creates position tracking
→ Returns success/failure
```

### 6. Position Creation
```
createPositionFromSwap()
→ Gets token info from GeckoTerminal
→ Calculates initial values
→ Saves to database
```

## Database Schema

### Position Model
```typescript
interface Position {
  id: string;
  telegramId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  initialAmount: number;
  initialUsdValue: number;
  currentAmount: number;
  currentUsdValue: number;
  entryPrice: number;
  currentPrice: number;
  pnlPercentage: number;
  pnlUsd: number;
  status: 'open' | 'closed';
  entryTime: Date;
  closeTime?: Date;
  duration?: string;
  txHash?: string;
  network: string;
  swapType: 'buy' | 'sell';
  // ... additional fields
}
```

## API Integration

### Swap API
- **Endpoint**: `${ZORACLE_API_URL}/api/swaps/execute`
- **Method**: POST
- **Parameters**: accountName, fromToken, toToken, fromAmount, slippageBps, network
- **Response**: Swap execution result with transaction hash

### GeckoTerminal Integration
- **Token Info**: Fetches token symbol, name, decimals
- **Price Data**: Gets current token prices for PnL calculations
- **Pool Data**: Retrieves liquidity and trading data

## Error Handling

### Validation Errors
- Invalid token addresses
- Insufficient balance
- Invalid amount format
- Network connectivity issues

### Swap Execution Errors
- Slippage exceeded
- Insufficient liquidity
- Transaction failed
- Gas estimation errors

### Position Creation Errors
- Token info not found
- Price data unavailable
- Database connection issues

## Security Features

### Input Validation
- Token address format validation
- Amount range validation
- Slippage limits
- Network validation

### Error Recovery
- Graceful fallback for failed swaps
- Position cleanup on errors
- User-friendly error messages
- Retry mechanisms

## UI/UX Features

### Loading States
- "⏳ Loading your portfolio tokens..."
- "⏳ Executing Swap..."
- "⏳ Updating positions..."

### Success Messages
- Transaction details
- Position information
- Next steps guidance

### Error Messages
- Clear error descriptions
- Suggested actions
- Navigation options

## Testing

### Test Coverage
- Position creation from swap data
- Enhanced swap execution
- Message handler processing
- Error handling scenarios
- UI flow validation

### Test File
- `src/test-add-position.ts` - Comprehensive test suite

## Configuration

### Environment Variables
- `ZORACLE_API_URL` - Swap API endpoint
- `PROVIDER_URL` - Blockchain RPC endpoint
- `TELEGRAM_BOT_TOKEN` - Bot authentication

### Default Settings
- Network: 'base'
- Slippage: 1% (100 bps)
- Timeout: 30 seconds
- Gas limit: 150,000

## Future Enhancements

### Planned Features
- Position editing capabilities
- Advanced order types
- Portfolio rebalancing
- Risk management tools
- Performance analytics

### Technical Improvements
- Real-time position updates
- Advanced price feeds
- Multi-chain support
- Enhanced error recovery
- Performance optimization

## Troubleshooting

### Common Issues
1. **Swap fails**: Check balance, liquidity, slippage
2. **Position not created**: Verify API connectivity, token info
3. **Price data missing**: Check GeckoTerminal API status
4. **Database errors**: Verify MongoDB connection

### Debug Steps
1. Check console logs for error messages
2. Verify API endpoints are accessible
3. Test with smaller amounts first
4. Check network connectivity
5. Validate token addresses

## Integration Points

### With Other Features
- **Portfolio**: Displays positions in portfolio view
- **Alerts**: Position-based price alerts
- **Copy Trading**: Position mirroring
- **PnL Cards**: Position performance visualization
- **Discovery**: New token opportunities

### External Services
- **GeckoTerminal**: Price and token data
- **Swap API**: Transaction execution
- **MongoDB**: Position storage
- **Telegram**: User interface

## Performance Considerations

### Optimization
- Async position updates
- Cached token information
- Efficient database queries
- Rate limiting for APIs

### Monitoring
- Swap success rates
- Position creation times
- Error frequency
- User engagement metrics

## Security Considerations

### Data Protection
- Encrypted wallet storage
- Secure API communication
- Input sanitization
- Access control

### Risk Management
- Slippage protection
- Gas estimation
- Transaction validation
- Error recovery mechanisms 