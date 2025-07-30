#!/bin/bash

# Script to fix TypeScript issues in the project

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Starting TypeScript fixes...${NC}"

# Step 1: Install required type definitions
echo -e "${YELLOW}📦 Installing TypeScript type definitions...${NC}"
npm install --save-dev @types/node @types/express @types/jest @types/node-telegram-bot-api @types/sequelize @types/fs-extra @types/qrcode @types/speakeasy @types/uuid

# Step 2: Fix database files
echo -e "${YELLOW}🔄 Fixing database files...${NC}"

# Fix migration files
find src/database/migrations -name "*.ts" | while read -r file; do
  echo "Processing $file..."
  
  # Replace module.exports with export =
  sed -i '' 's/module\.exports/export =/g' "$file"
  
  # Fix parameter types
  sed -i '' 's/Sequelize: typeof DataTypes/Sequelize: any/g' "$file"
  
  # Remove 'use strict'
  sed -i '' "s/'use strict';//g" "$file"
  
  # Add proper imports
  if ! grep -q "import { QueryInterface, Sequelize } from 'sequelize';" "$file"; then
    sed -i '' '1s/^/import { QueryInterface, Sequelize } from '\''sequelize'\'';\n\n/' "$file"
  fi
done

# Fix seeder files
find src/database/seeders -name "*.ts" | while read -r file; do
  echo "Processing $file..."
  
  # Replace module.exports with export =
  sed -i '' 's/module\.exports/export =/g' "$file"
  
  # Remove 'use strict'
  sed -i '' "s/'use strict';//g" "$file"
  
  # Add proper imports
  if ! grep -q "import { QueryInterface } from 'sequelize';" "$file"; then
    sed -i '' '1s/^/import { QueryInterface } from '\''sequelize'\'';\n\n/' "$file"
  fi
done

# Step 3: Fix common TypeScript errors
echo -e "${YELLOW}🔄 Fixing common TypeScript errors...${NC}"

# Fix import errors (Module has no default export)
echo "Fixing import errors..."
find src -name "*.ts" -exec sed -i '' 's/import \([a-zA-Z]*\) from/import * as \1 from/g' {} \;

# Fix parse_mode errors
echo "Fixing parse_mode errors..."
find src -name "*.ts" -exec sed -i '' "s/parse_mode: 'Markdown'/parse_mode: 'MarkdownV2'/g" {} \;
find src -name "*.ts" -exec sed -i '' "s/parse_mode: 'HTML'/parse_mode: 'HTML'/g" {} \;

# Fix async function return types
echo "Fixing async function return types..."
find src -name "*.ts" -exec sed -i '' 's/async function \([a-zA-Z0-9_]*\)(\(.*\)): any {/async function \1(\2): Promise<any> {/g' {} \;

# Fix error.code property access
echo "Fixing error.code property access..."
find src -name "*.ts" -exec sed -i '' 's/error\.code/(error as any)\.code/g' {} \;

# Fix mongoose connection options
echo "Fixing mongoose connection options..."
find src -name "*.ts" -exec sed -i '' 's/useNewUrlParser: true,//g' {} \;
find src -name "*.ts" -exec sed -i '' 's/useUnifiedTopology: true,//g' {} \;

# Fix token.volume24h property access
echo "Fixing token.volume24h property access..."
find src -name "*.ts" -exec sed -i '' 's/token\.volume24h/(token as any)\.volume24h/g' {} \;

# Fix addr.toLowerCase() property access
echo "Fixing addr.toLowerCase() property access..."
find src -name "*.ts" -exec sed -i '' 's/addr\.toLowerCase()/(addr as string)\.toLowerCase()/g' {} \;

# Step 4: Fix handler exports
echo -e "${YELLOW}🔄 Fixing handler exports...${NC}"

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
if ! grep -q "export {" src/bot/baseBot.ts; then
  echo "Adding exports to baseBot.ts..."
  echo -e "\n$(cat temp_basebot_exports.ts)" >> src/bot/baseBot.ts
fi

# Fix handler exports
find src/bot/handlers -name "*.ts" | while read -r file; do
  echo "Fixing exports in $file..."
  sed -i '' 's/module\.exports = /export default /g' "$file"
done

# Clean up temporary files
rm -f temp_basebot_exports.ts

# Step 5: Fix bot.ts imports
echo -e "${YELLOW}🔄 Fixing bot.ts imports...${NC}"

# Create a temporary file with the fixed imports
cat > temp_bot_imports.ts << 'EOL'
// Import handlers
import * as walletHandlers from './handlers/walletHandlers';
import * as tradeHandlers from './handlers/tradeHandlers';
import * as portfolioHandlers from './handlers/portfolioHandlers';
import * as discoveryHandlers from './handlers/discoveryHandlers';
import * as alertHandlers from './handlers/alertHandlers';
import * as copytradeHandlers from './handlers/copytradeHandlers';

// Initialize handlers
if (walletHandlers.default) walletHandlers.default(bot, users);
if (tradeHandlers.default) tradeHandlers.default(bot, users);
if (portfolioHandlers.default) portfolioHandlers.default(bot, users);
if (discoveryHandlers.default) discoveryHandlers.default(bot, users);
if (alertHandlers.default) alertHandlers.default(bot, users);
if (copytradeHandlers.default) copytradeHandlers.default(bot, users);
EOL

# Replace the import section in bot.ts
if grep -q "import { default as init" src/bot/bot.ts; then
  sed -i '' -e '/import { default as init/,/copytradeHandlers(bot, users);/c\
  '"$(cat temp_bot_imports.ts)" src/bot/bot.ts
fi

# Clean up temporary files
rm -f temp_bot_imports.ts

# Step 6: Fix request options in baseBot.ts
echo -e "${YELLOW}🔄 Fixing request options in baseBot.ts...${NC}"
sed -i '' 's/request: {/polling: {/g' src/bot/baseBot.ts

# Step 7: Run TypeScript compiler to check for remaining errors
echo -e "${YELLOW}🔍 Checking for remaining TypeScript errors...${NC}"
npx tsc --noEmit

echo -e "${GREEN}✅ TypeScript fixes completed!${NC}"
echo -e "${YELLOW}Note: There may still be some errors that need manual fixing.${NC}"