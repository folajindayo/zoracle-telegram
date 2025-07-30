#!/bin/bash

# Script to fix handler exports in TypeScript files

echo "🔧 Fixing handler exports in TypeScript files..."

# Fix handler files
find src/bot/handlers -name "*.ts" | while read -r file; do
  echo "Adding export default to $file..."
  
  # Extract the basename without extension
  basename=$(basename "$file" .ts)
  
  # Check if the file already has an export default
  if ! grep -q "export default" "$file"; then
    # Check if the file has a setupHandlers function
    if grep -q "function setupHandlers" "$file"; then
      # Add export default function
      echo -e "\nexport default function init${basename^}(bot, users) {\n  setupHandlers(bot, users);\n}" >> "$file"
    fi
  fi
done

# Fix bot.ts imports
cat > temp_bot_imports.ts << 'EOL'
// Import handlers
import walletHandlers from './handlers/walletHandlers';
import tradeHandlers from './handlers/tradeHandlers';
import portfolioHandlers from './handlers/portfolioHandlers';
import discoveryHandlers from './handlers/discoveryHandlers';
import alertHandlers from './handlers/alertHandlers';
import copytradeHandlers from './handlers/copytradeHandlers';

// Initialize handlers
if (typeof walletHandlers === 'function') walletHandlers(bot, users);
if (typeof tradeHandlers === 'function') tradeHandlers(bot, users);
if (typeof portfolioHandlers === 'function') portfolioHandlers(bot, users);
if (typeof discoveryHandlers === 'function') discoveryHandlers(bot, users);
if (typeof alertHandlers === 'function') alertHandlers(bot, users);
if (typeof copytradeHandlers === 'function') copytradeHandlers(bot, users);
EOL

# Replace the import section in bot.ts
sed -i '' -e '/import walletHandlers/,/copytradeHandlers(bot, users);/c\
'"$(cat temp_bot_imports.ts)" src/bot/bot.ts

# Clean up temporary files
rm -f temp_bot_imports.ts

echo "✅ Handler exports fixed!"