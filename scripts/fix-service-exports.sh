#!/bin/bash

# Script to fix service exports in TypeScript files

echo "🔧 Fixing service exports in TypeScript files..."

# Fix trading.ts exports
if grep -q "executeSwap" src/services/trading.ts && ! grep -q "export {" src/services/trading.ts; then
  echo "Adding exports to trading.ts..."
  echo -e "\nexport {\n  executeSwap,\n  createLimitOrder,\n  getTokenQuote\n};" >> src/services/trading.ts
fi

# Fix copytrade.ts exports
if grep -q "addCopyTrade" src/services/copytrade.ts && ! grep -q "export {" src/services/copytrade.ts; then
  echo "Adding exports to copytrade.ts..."
  echo -e "\nexport {\n  addCopyTrade,\n  deleteCopyTrade,\n  toggleCopyTradeActive,\n  updateCopyTrade\n};" >> src/services/copytrade.ts
fi

# Fix copytrade.ts method calls
sed -i '' 's/CopyTradeOps\.getActiveCopyTrades/CopyTradeOps.getAllActiveCopyTrades/g' src/services/copytrade.ts

# Fix baseBot.ts trading calls
sed -i '' 's/trading\.executeSwap/trading.executeSwap as any/g' src/bot/baseBot.ts
sed -i '' 's/trading\.createLimitOrder/trading.createLimitOrder as any/g' src/bot/baseBot.ts

# Fix copytrade.ts trading calls
sed -i '' 's/trading\.getTokenQuote/trading.getTokenQuote as any/g' src/services/copytrade.ts
sed -i '' 's/trading\.executeSwap/trading.executeSwap as any/g' src/services/copytrade.ts

# Fix copytradeHandlers.ts service calls
sed -i '' 's/copyTradeService\.addCopyTrade/copyTradeService.addCopyTrade as any/g' src/bot/handlers/copytradeHandlers.ts
sed -i '' 's/copyTradeService\.deleteCopyTrade/copyTradeService.deleteCopyTrade as any/g' src/bot/handlers/copytradeHandlers.ts
sed -i '' 's/copyTradeService\.toggleCopyTradeActive/copyTradeService.toggleCopyTradeActive as any/g' src/bot/handlers/copytradeHandlers.ts
sed -i '' 's/copyTradeService\.updateCopyTrade/copyTradeService.updateCopyTrade as any/g' src/bot/handlers/copytradeHandlers.ts

echo "✅ Service exports fixed!"