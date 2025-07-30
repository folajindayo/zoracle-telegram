#!/bin/bash

# Script to start the bot with environment variables from .env file

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Zoracle Telegram Bot...${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}❌ ERROR: .env file not found!${NC}"
  echo -e "${YELLOW}Please create a .env file with the required variables.${NC}"
  exit 1
fi

# Check if required environment variables are set
required_vars=("TELEGRAM_BOT_TOKEN" "ALCHEMY_API_KEY" "MASTER_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
  if ! grep -q "^${var}=" .env; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
  echo -e "${RED}❌ ERROR: The following required environment variables are missing:${NC}"
  for var in "${missing_vars[@]}"; do
    echo -e "  - $var"
  done
  echo -e "${YELLOW}Please add them to your .env file.${NC}"
  exit 1
fi

# Load environment variables from .env file
echo -e "${YELLOW}📁 Loading environment variables from .env file...${NC}"
export $(grep -v '^#' .env | xargs -0)

# Run the bot
echo -e "${GREEN}🤖 Starting bot...${NC}"
node dist/run.js