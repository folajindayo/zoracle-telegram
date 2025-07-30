/**
 * Test MongoDB Connection
 * 
 * This script tests the connection to MongoDB using the connection string in .env
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('🔄 Testing MongoDB connection...');
    
    // Get MongoDB connection string from environment variables
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is not set');
      console.error('Please add it to your .env file');
      return false;
    }
    
    console.log(`🔄 Connecting to: ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Check connection
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.ping();
    
    if (result.ok === 1) {
      console.log('✅ MongoDB connection successful!');
      console.log('✅ Server status:', result);
      
      // Get database information
      const dbInfo = await mongoose.connection.db.stats();
      console.log('📊 Database info:');
      console.log(`   - Database name: ${mongoose.connection.db.databaseName}`);
      console.log(`   - Collections: ${dbInfo.collections}`);
      console.log(`   - Documents: ${dbInfo.objects}`);
      console.log(`   - Storage size: ${(dbInfo.storageSize / 1024 / 1024).toFixed(2)} MB`);
    } else {
      console.error('❌ MongoDB ping failed');
      return false;
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    
    // Disconnect from MongoDB if connected
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    return false;
  }
}

// If this script is run directly, test the connection
if (require.main === module) {
  testConnection().then((success) => {
    if (!success) {
      process.exit(1);
    }
    process.exit(0);
  });
}

module.exports = { testConnection }; 