#!/bin/bash

# Script to fix import issues in TypeScript files

echo "🔧 Fixing import issues in TypeScript files..."

# Fix TelegramBot import
find src -name "*.ts" -exec sed -i '' 's/import \* as TelegramBot from/import TelegramBot from/g' {} \;

# Fix axios import
find src -name "*.ts" -exec sed -i '' 's/import \* as axios from/import axios from/g' {} \;

# Fix EventEmitter import
find src -name "*.ts" -exec sed -i '' 's/import \* as EventEmitter from/import { EventEmitter } from/g' {} \;

# Fix moment import
find src -name "*.ts" -exec sed -i '' 's/import \* as moment from/import moment from/g' {} \;

# Fix baseBot exports
cat > temp_basebot_exports.ts << 'EOL'
// Export utility functions for handlers
export {
  bot,
  users,
  getEthBalance,
  getTokenBalance,
  getTokenInfo,
  decryptData,
  encryptData,
  formatEth,
  formatTokenAmount
};
EOL

# Add exports to baseBot.ts if they don't exist
if ! grep -q "export { bot, users" src/bot/baseBot.ts; then
  echo "Adding exports to baseBot.ts..."
  echo -e "\n$(cat temp_basebot_exports.ts)" >> src/bot/baseBot.ts
fi

# Fix handler files
find src/bot/handlers -name "*.ts" | while read -r file; do
  echo "Fixing exports in $file..."
  # Add export default if it doesn't exist
  if ! grep -q "export default" "$file"; then
    # Extract the setupHandlers function
    if grep -q "function setupHandlers" "$file"; then
      # Get the basename without extension
      basename=$(basename "$file" .ts)
      # Add export default function
      echo -e "\nexport default function init${basename^}(bot, users) {\n  setupHandlers(bot, users);\n}" >> "$file"
    fi
  fi
done

# Fix trading service exports
if grep -q "executeSwap" src/services/trading.ts && ! grep -q "export { executeSwap" src/services/trading.ts; then
  echo "Adding exports to trading.ts..."
  echo -e "\nexport {\n  executeSwap,\n  createLimitOrder,\n  getTokenQuote\n};" >> src/services/trading.ts
fi

# Fix copytrade service exports
if grep -q "addCopyTrade" src/services/copytrade.ts && ! grep -q "export { addCopyTrade" src/services/copytrade.ts; then
  echo "Adding exports to copytrade.ts..."
  echo -e "\nexport {\n  addCopyTrade,\n  deleteCopyTrade,\n  toggleCopyTradeActive,\n  updateCopyTrade\n};" >> src/services/copytrade.ts
fi

# Fix mongoose connection options
sed -i '' 's/useUnifiedTopology: true//g' src/database/models.ts

# Fix CopyTradeOps method name
sed -i '' 's/CopyTradeOps.getActiveCopyTrades/CopyTradeOps.getAllActiveCopyTrades/g' src/services/copytrade.ts

# Clean up temporary files
rm -f temp_basebot_exports.ts

echo "✅ Import issues fixed!"