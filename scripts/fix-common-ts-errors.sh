#!/bin/bash

# Script to fix common TypeScript errors

echo "🔧 Fixing common TypeScript errors..."

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

echo "✅ Common TypeScript errors fixed!"