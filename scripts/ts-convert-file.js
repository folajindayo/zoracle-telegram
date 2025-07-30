#!/usr/bin/env node

/**
 * TypeScript Conversion Helper
 * 
 * This script helps convert a JavaScript file to TypeScript by:
 * 1. Replacing require() statements with import statements
 * 2. Replacing module.exports with export statements
 * 3. Adding type annotations to function parameters and return values
 */

const fs = require('fs');
const path = require('path');

// Check if file path is provided
if (process.argv.length < 3) {
  console.error('Please provide a file path to convert');
  console.error('Usage: node ts-convert-file.js <file-path>');
  process.exit(1);
}

const filePath = process.argv[2];

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

// Read file content
let content = fs.readFileSync(filePath, 'utf8');

// Replace require statements with import statements
content = content.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, 'import $1 from \'$2\';');
content = content.replace(/const\s+{\s*([^}]+)\s*}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, 'import { $1 } from \'$2\';');

// Replace module.exports with export statements
content = content.replace(/module\.exports\s*=\s*(\w+);?/g, 'export default $1;');
content = content.replace(/module\.exports\s*=\s*{([^}]+)};?/g, 'export { $1 };');

// Add basic type annotations to functions
content = content.replace(/function\s+(\w+)\s*\(([^)]*)\)\s*{/g, 'function $1($2): any {');

// Write the converted content back to the file
fs.writeFileSync(filePath, content);

console.log(`Converted ${filePath} to TypeScript syntax`);