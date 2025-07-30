/**
 * Database Initialization Script
 * 
 * This script initializes the database, creates tables if they don't exist,
 * and runs any pending migrations.
 */
const { sequelize, initDb } = require('./models');
const fs = require('fs-extra');
const path = require('path');

async function initialize() {
  try {
    console.log('🔄 Initializing database...');
    
    // Create database directory if it doesn't exist
    const dbDir = path.join(__dirname);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Initialize database
    const success = await initDb();
    
    if (!success) {
      console.error('❌ Failed to initialize database');
      return false;
    }
    
    console.log('✅ Database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    return false;
  }
}

// If this script is run directly, initialize the database
if (require.main === module) {
  initialize().then((success) => {
    if (!success) {
      process.exit(1);
    }
    process.exit(0);
  });
}

module.exports = { initialize }; 