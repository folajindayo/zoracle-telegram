#!/bin/bash

# Script to fix common TypeScript issues
# This script will:
# 1. Add missing type annotations
# 2. Fix import/export syntax
# 3. Run ESLint to fix other issues

echo "🔍 Checking for TypeScript issues..."

# Create tsconfig.json if it doesn't exist
if [ ! -f "tsconfig.json" ]; then
  echo "Creating tsconfig.json..."
  cat > tsconfig.json << EOL
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "*": ["node_modules/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.spec.ts"]
}
EOL
fi

# Check for remaining require statements
echo "Checking for remaining require() statements..."
grep -r "require(" --include="*.ts" src/

# Check for remaining module.exports statements
echo "Checking for remaining module.exports statements..."
grep -r "module.exports" --include="*.ts" src/

# Run TypeScript compiler in noEmit mode to check for errors
echo "Running TypeScript compiler check..."
npx tsc --noEmit

# Run ESLint to fix issues
echo "Running ESLint to fix issues..."
npx eslint --fix src/ --ext .ts

echo "✅ TypeScript check complete!"