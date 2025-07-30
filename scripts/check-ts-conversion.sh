#!/bin/bash

# Count total TypeScript files
ts_files=$(find src -name "*.ts" | wc -l)

# Count TypeScript files that still have CommonJS require statements
commonjs_files=$(grep -l "require(" $(find src -name "*.ts") | wc -l)

# Count TypeScript files that still have module.exports
module_exports_files=$(grep -l "module.exports" $(find src -name "*.ts") | wc -l)

# Calculate conversion percentage
total_files=$ts_files
unconverted_files=$((commonjs_files + module_exports_files))
converted_files=$((total_files - unconverted_files))
percentage=$((converted_files * 100 / total_files))

echo "TypeScript Conversion Progress:"
echo "------------------------------"
echo "Total TypeScript files: $ts_files"
echo "Files with CommonJS require: $commonjs_files"
echo "Files with module.exports: $module_exports_files"
echo "Conversion progress: $percentage%"
echo ""

echo "Files that need conversion:"
echo "-------------------------"
grep -l "require(" $(find src -name "*.ts") | sort
grep -l "module.exports" $(find src -name "*.ts") | sort

echo ""
echo "To continue conversion, focus on these files first."