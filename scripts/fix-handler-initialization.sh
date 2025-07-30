#!/bin/bash

# Script to fix handler initialization in TypeScript files

echo "🔧 Fixing handler initialization in TypeScript files..."

# Fix handler files
find src/bot/handlers -name "*.ts" | while read -r file; do
  echo "Updating $file to self-initialize..."
  
  # Extract the basename without extension
  basename=$(basename "$file" .ts)
  
  # Check if the file already has setupHandlers function
  if grep -q "function setupHandlers" "$file"; then
    # Check if the file already has self-initialization
    if ! grep -q "setupHandlers(bot, users);" "$file"; then
      # Add self-initialization at the end of the file
      echo -e "\n// Self-initialize\nimport { bot, users } from '../baseBot';\nsetupHandlers(bot, users);" >> "$file"
    fi
  fi
done

echo "✅ Handler initialization fixed!"