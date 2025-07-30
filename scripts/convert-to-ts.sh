#!/bin/bash

# Create directories if they don't exist
mkdir -p dist

# Find all JavaScript files and convert them to TypeScript
find src -type f -name "*.js" | while read file; do
  # Create TypeScript file
  ts_file="${file%.js}.ts"
  echo "Converting $file to $ts_file"
  cp "$file" "$ts_file"
done

echo "Conversion complete!"