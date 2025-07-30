/**
 * MongoDB Database Initialization Script
 * 
 * This script initializes the MongoDB database connection.
 */
import { mongoose, initDb  } from './models';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Initialize the database
 * @returns {Promise<boolean>} Success status
 */
async function initialize(): Promise<any> {
  try {
    console.log('🔄 Initializing MongoDB database...');
    
    // Ensure MongoDB connection string is set
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is not set');
      console.error('Please add it to your .env file: MONGODB_URI=mongodb://localhost:27017/zoracle');
      return false;
    }
    
    // Initialize database connection
    const success = await initDb();
    
    if (!success) {
      console.error('❌ Failed to initialize MongoDB database');
      return false;
    }
    
    console.log('✅ MongoDB database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing MongoDB database:', error);
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

export {  initialize  }; 