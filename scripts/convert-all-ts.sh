#!/bin/bash

# Find all TypeScript files with CommonJS syntax
files=$(grep -l "require\|module.exports" $(find src -name "*.ts"))

# Convert each file
for file in $files; do
  echo "Converting $file..."
  node scripts/ts-convert-file.js "$file"
done

echo "Conversion complete!"
echo "Run ./scripts/check-ts-conversion.sh to check progress."