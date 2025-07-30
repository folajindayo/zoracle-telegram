#!/bin/bash

# Script to fix type assertion errors in TypeScript files

echo "🔧 Fixing type assertion errors in TypeScript files..."

# Fix baseBot.ts trading calls
sed -i '' 's/trading\.executeSwap as any/((trading as any).executeSwap)/g' src/bot/baseBot.ts
sed -i '' 's/trading\.createLimitOrder as any/((trading as any).createLimitOrder)/g' src/bot/baseBot.ts

# Fix copytrade.ts trading calls
sed -i '' 's/trading\.getTokenQuote as any/((trading as any).getTokenQuote)/g' src/services/copytrade.ts
sed -i '' 's/trading\.executeSwap as any/((trading as any).executeSwap)/g' src/services/copytrade.ts

# Fix copytradeHandlers.ts service calls
sed -i '' 's/copyTradeService\.addCopyTrade as any/((copyTradeService as any).addCopyTrade)/g' src/bot/handlers/copytradeHandlers.ts
sed -i '' 's/copyTradeService\.deleteCopyTrade as any/((copyTradeService as any).deleteCopyTrade)/g' src/bot/handlers/copytradeHandlers.ts
sed -i '' 's/copyTradeService\.toggleCopyTradeActive as any/((copyTradeService as any).toggleCopyTradeActive)/g' src/bot/handlers/copytradeHandlers.ts
sed -i '' 's/copyTradeService\.updateCopyTrade as any/((copyTradeService as any).updateCopyTrade)/g' src/bot/handlers/copytradeHandlers.ts

echo "✅ Type assertion errors fixed!"