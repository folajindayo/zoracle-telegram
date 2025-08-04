#!/bin/bash

# Test script for GeckoTerminal API integration
echo "🧪 Running GeckoTerminal API Integration Test..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if TypeScript is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not available. Please install Node.js and npm"
    exit 1
fi

# Compile TypeScript
echo "📦 Compiling TypeScript..."
npx tsc --noEmit

if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Run the test
echo "🚀 Running GeckoTerminal API test..."
npx ts-node src/test-gecko-terminal.ts

if [ $? -eq 0 ]; then
    echo "✅ GeckoTerminal API test completed successfully!"
else
    echo "❌ GeckoTerminal API test failed"
    exit 1
fi 