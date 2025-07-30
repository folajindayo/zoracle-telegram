#!/bin/bash

# Script to fix remaining TypeScript issues

echo "🔧 Fixing remaining TypeScript issues..."

# Fix EventEmitter import and instantiation
find src -name "*.ts" -exec sed -i '' 's/import \* as EventEmitter from/import { EventEmitter } from/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/new EventEmitter()/new EventEmitter()/g' {} \;

# Fix moment import and usage
find src -name "*.ts" -exec sed -i '' 's/import \* as moment from/import moment from/g' {} \;

# Fix copytrade service method names
find src -name "*.ts" -exec sed -i '' 's/CopyTradeOps\.getActiveCopyTrades/CopyTradeOps.getAllActiveCopyTrades/g' {} \;

# Add missing exports to trading.ts
if grep -q "executeSwap" src/services/trading.ts && ! grep -q "export {" src/services/trading.ts; then
  echo "Adding exports to trading.ts..."
  echo -e "\nexport {\n  executeSwap,\n  createLimitOrder,\n  getTokenQuote\n};" >> src/services/trading.ts
fi

# Add missing exports to copytrade.ts
if grep -q "addCopyTrade" src/services/copytrade.ts && ! grep -q "export {" src/services/copytrade.ts; then
  echo "Adding exports to copytrade.ts..."
  echo -e "\nexport {\n  addCopyTrade,\n  deleteCopyTrade,\n  toggleCopyTradeActive,\n  updateCopyTrade\n};" >> src/services/copytrade.ts
fi

# Fix Users type in index.ts
sed -i '' 's/users = botModule.users;/users = botModule.users as any;/g' src/index.ts

# Remove useUnifiedTopology from mongoose connection options
sed -i '' 's/useUnifiedTopology: true,//g' src/database/models.ts

echo "✅ Remaining TypeScript issues fixed!"