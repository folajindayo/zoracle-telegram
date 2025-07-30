#!/bin/bash

# Script to fix handler imports

echo "🔧 Fixing handler imports..."

# Fix handler imports in bot.ts
cat > temp_fix.ts << 'EOL'
// Import handlers
import * as walletHandlers from './handlers/walletHandlers';
import * as tradeHandlers from './handlers/tradeHandlers';
import * as portfolioHandlers from './handlers/portfolioHandlers';
import * as discoveryHandlers from './handlers/discoveryHandlers';
import * as alertHandlers from './handlers/alertHandlers';
import * as copytradeHandlers from './handlers/copytradeHandlers';

// Initialize handlers
walletHandlers.default(bot, users);
tradeHandlers.default(bot, users);
portfolioHandlers.default(bot, users);
discoveryHandlers.default(bot, users);
alertHandlers.default(bot, users);
copytradeHandlers.default(bot, users);
EOL

# Replace the import section in bot.ts
sed -i '' -e '/import.*as init.*Handler/,/copytradeHandlers(bot, users);/c\
'"$(cat temp_fix.ts)" src/bot/bot.ts

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

# Add exports to baseBot.ts
if ! grep -q "export {" src/bot/baseBot.ts; then
  echo "Adding exports to baseBot.ts..."
  echo -e "\n$(cat temp_basebot_exports.ts)" >> src/bot/baseBot.ts
fi

# Fix handler exports
find src/bot/handlers -name "*.ts" | while read -r file; do
  echo "Fixing exports in $file..."
  sed -i '' 's/module\.exports = /export default /g' "$file"
  
  # If the file doesn't have export default, add it
  if ! grep -q "export default" "$file"; then
    # Get the function name from the file
    handler_name=$(basename "$file" .ts)
    echo -e "\nexport default function init${handler_name^}(bot, users) {" >> "$file"
    echo "  // Initialize handlers" >> "$file"
    echo "  setupHandlers(bot, users);" >> "$file"
    echo "}" >> "$file"
  fi
done

# Clean up temporary files
rm temp_fix.ts temp_basebot_exports.ts

echo "✅ Handler imports fixed!"