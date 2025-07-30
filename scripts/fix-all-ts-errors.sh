#!/bin/bash

# Script to fix all TypeScript errors

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Starting TypeScript fixes...${NC}"

# Step 1: Fix import issues
echo -e "${YELLOW}📦 Fixing import issues...${NC}"
./scripts/fix-imports.sh

# Step 2: Fix handler issues
echo -e "${YELLOW}🔄 Fixing handler issues...${NC}"
./scripts/fix-handlers.sh

# Step 3: Fix axios issues
echo -e "${YELLOW}🔄 Fixing axios issues...${NC}"
./scripts/fix-axios.sh

# Step 4: Fix remaining issues
echo -e "${YELLOW}🔄 Fixing remaining issues...${NC}"
./scripts/fix-remaining-issues.sh

# Step 5: Fix specific issues that might not have been caught
echo -e "${YELLOW}🔍 Fixing specific issues...${NC}"

# Fix TelegramBot import in baseBot.ts
sed -i '' '2s/import \* as TelegramBot from/import TelegramBot from/g' src/bot/baseBot.ts
sed -i '' '2s/import \* as TelegramBot from/import TelegramBot from/g' src/bot/zoracleBot.ts

# Fix parse_mode in all handlers
find src/bot/handlers -name "*.ts" -exec sed -i '' "s/parse_mode: 'Markdown'/parse_mode: 'MarkdownV2' as const/g" {} \;
find src/bot/handlers -name "*.ts" -exec sed -i '' "s/parse_mode: 'HTML'/parse_mode: 'HTML' as const/g" {} \;

# Fix axios calls in cdpWallet.ts
sed -i '' 's/await axios(/await axios.request(/g' src/services/cdpWallet.ts

# Step 6: Run TypeScript compiler to check for remaining errors
echo -e "${YELLOW}🔍 Checking for remaining TypeScript errors...${NC}"
npx tsc --noEmit

echo -e "${GREEN}✅ TypeScript fixes completed!${NC}"
echo -e "${YELLOW}Note: There may still be some errors that need manual fixing.${NC}"