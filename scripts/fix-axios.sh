#!/bin/bash

# Script to fix axios issues in TypeScript files

echo "🔧 Fixing axios issues in TypeScript files..."

# Fix axios imports
find src -name "*.ts" -exec sed -i '' 's/import \* as axios from/import axios from/g' {} \;

# Fix axios calls
find src -name "*.ts" -exec sed -i '' 's/await axios({/await axios.request({/g' {} \;

# Fix axios methods
find src -name "*.ts" -exec sed -i '' 's/axios\.get/axios.get/g' {} \;
find src -name "*.ts" -exec sed -i '' 's/axios\.post/axios.post/g' {} \;

echo "✅ Axios issues fixed!"