#!/bin/bash

# Master script to fix all TypeScript issues

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

# Step 5: Fix parse_mode issues
echo -e "${YELLOW}🔄 Fixing parse_mode issues...${NC}"
./scripts/fix-parse-mode.sh

# Step 6: Fix type assertion issues
echo -e "${YELLOW}🔄 Fixing type assertion issues...${NC}"
./scripts/fix-type-assertions.sh

# Step 7: Fix handler exports
echo -e "${YELLOW}🔄 Fixing handler exports...${NC}"
./scripts/fix-handler-exports.sh

# Step 8: Fix handler initialization
echo -e "${YELLOW}🔄 Fixing handler initialization...${NC}"
./scripts/fix-handler-initialization.sh

# Step 9: Fix service exports
echo -e "${YELLOW}🔄 Fixing service exports...${NC}"
./scripts/fix-service-exports.sh

# Step 10: Fix database issues
echo -e "${YELLOW}🔄 Fixing database issues...${NC}"
./scripts/fix-database-ts.sh

# Step 11: Run TypeScript compiler to check for remaining errors
echo -e "${YELLOW}🔍 Checking for remaining TypeScript errors...${NC}"
npx tsc --noEmit

# Step 12: Build the project
echo -e "${YELLOW}🔨 Building the project...${NC}"
npm run build

echo -e "${GREEN}✅ TypeScript fixes completed!${NC}"
echo -e "${YELLOW}Note: To run the bot, make sure to set up the required environment variables in a .env file.${NC}"