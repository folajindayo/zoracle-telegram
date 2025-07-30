#!/bin/bash

# Script to fix parse_mode issues in TypeScript files

echo "🔧 Fixing parse_mode issues in TypeScript files..."

# Fix parse_mode in baseBot.ts
sed -i '' "s/parse_mode: 'MarkdownV2'/parse_mode: 'MarkdownV2' as const/g" src/bot/baseBot.ts
sed -i '' "s/parse_mode: 'HTML'/parse_mode: 'HTML' as const/g" src/bot/baseBot.ts
sed -i '' "s/parse_mode: 'Markdown'/parse_mode: 'MarkdownV2' as const/g" src/bot/baseBot.ts

# Fix parse_mode in all handler files
find src/bot/handlers -name "*.ts" -exec sed -i '' "s/parse_mode: 'MarkdownV2'/parse_mode: 'MarkdownV2' as const/g" {} \;
find src/bot/handlers -name "*.ts" -exec sed -i '' "s/parse_mode: 'HTML'/parse_mode: 'HTML' as const/g" {} \;
find src/bot/handlers -name "*.ts" -exec sed -i '' "s/parse_mode: 'Markdown'/parse_mode: 'MarkdownV2' as const/g" {} \;

echo "✅ Parse mode issues fixed!"