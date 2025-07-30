#!/bin/bash

# Script to fix TypeScript issues in database files

echo "🔧 Fixing TypeScript issues in database files..."

# Install Sequelize types if not already installed
if ! npm list @types/sequelize | grep -q "@types/sequelize"; then
  echo "📦 Installing @types/sequelize..."
  npm install --save-dev @types/sequelize
fi

# Fix migration files
find src/database/migrations -name "*.ts" | while read -r file; do
  echo "🔍 Processing $file..."
  
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
  echo "🔍 Processing $file..."
  
  # Replace module.exports with export =
  sed -i '' 's/module\.exports/export =/g' "$file"
  
  # Remove 'use strict'
  sed -i '' "s/'use strict';//g" "$file"
  
  # Add proper imports
  if ! grep -q "import { QueryInterface } from 'sequelize';" "$file"; then
    sed -i '' '1s/^/import { QueryInterface } from '\''sequelize'\'';\n\n/' "$file"
  fi
done

# Fix model files
find src/database/models -name "*.ts" | while read -r file; do
  echo "🔍 Processing $file..."
  
  # Replace require with import
  sed -i '' 's/const \([a-zA-Z]*\) = require(.*/import \1 from '\''sequelize'\'';/g' "$file"
  
  # Replace module.exports with export default
  sed -i '' 's/module\.exports/export default/g' "$file"
done

echo "✅ Database TypeScript fixes completed!"