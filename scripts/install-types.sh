#!/bin/bash

# Script to install TypeScript type definitions for all dependencies

echo "🔍 Installing TypeScript type definitions..."

# Install common types
npm install --save-dev @types/node @types/express @types/jest

# Install types for project dependencies
npm install --save-dev @types/node-telegram-bot-api @types/sequelize @types/fs-extra @types/qrcode @types/speakeasy @types/uuid

# Install TypeScript and related tools
npm install --save-dev typescript ts-node ts-jest @typescript-eslint/eslint-plugin @typescript-eslint/parser

echo "✅ TypeScript type definitions installed!"