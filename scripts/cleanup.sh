#!/bin/bash

# Script to clean up JavaScript files after TypeScript conversion
# This script will:
# 1. Find all .js files that have corresponding .ts files
# 2. Remove those .js files
# 3. Remove any empty directories

echo "🧹 Starting cleanup of JavaScript files..."

# Count total JavaScript files before cleanup
total_js_files=$(find src -name "*.js" | wc -l)
echo "Found $total_js_files JavaScript files before cleanup"

# Find and remove .js files that have corresponding .ts files
removed_count=0
for ts_file in $(find src -name "*.ts"); do
    js_file="${ts_file%.ts}.js"
    if [ -f "$js_file" ]; then
        echo "Removing duplicate: $js_file"
        rm "$js_file"
        removed_count=$((removed_count + 1))
    fi
done

# Find and remove any remaining .js files in the src directory
for js_file in $(find src -name "*.js"); do
    echo "Removing JavaScript file: $js_file"
    rm "$js_file"
    removed_count=$((removed_count + 1))
done

# Remove any empty directories
find src -type d -empty -delete

# Count remaining JavaScript files
remaining_js_files=$(find src -name "*.js" | wc -l)

echo "✅ Cleanup complete!"
echo "Removed $removed_count JavaScript files"
echo "Remaining JavaScript files: $remaining_js_files"
echo ""
echo "TypeScript files: $(find src -name "*.ts" | wc -l)"