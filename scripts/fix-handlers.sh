#!/bin/bash

# Script to fix handler issues in TypeScript files

echo "🔧 Fixing handler issues in TypeScript files..."

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
walletHandlers(bot, users);
tradeHandlers(bot, users);
portfolioHandlers(bot, users);
discoveryHandlers(bot, users);
alertHandlers(bot, users);
copytradeHandlers(bot, users);
EOL

# Replace the import section in bot.ts
if grep -q "import { default as init" src/bot/bot.ts; then
  sed -i '' -e '/import { default as init/,/copytradeHandlers(bot, users);/c\
  '"$(cat temp_bot_imports.ts)" src/bot/bot.ts
fi

# Fix parse_mode in walletHandlers.ts
sed -i '' "s/parse_mode: 'Markdown'/parse_mode: 'MarkdownV2'/g" src/bot/handlers/walletHandlers.ts
sed -i '' "s/parse_mode: 'HTML'/parse_mode: 'HTML'/g" src/bot/handlers/walletHandlers.ts

# Clean up temporary files
rm -f temp_bot_imports.ts

echo "✅ Handler issues fixed!"