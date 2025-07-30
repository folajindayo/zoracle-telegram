/**
 * MongoDB Database Seed Script
 * 
 * This script seeds the MongoDB database with initial data.
 */
require('dotenv').config();
const { mongoose, User, Token } = require('../src/database/models');

/**
 * Seed the database with initial data
 */
async function seedDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zoracle';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ MongoDB connected successfully');
    
    // Seed sample tokens
    console.log('🔄 Seeding sample tokens...');
    
    const sampleTokens = [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Creator Token 1',
        symbol: 'CT1',
        decimals: 18,
        lastPrice: '0.001',
        priceUpdateTime: new Date(),
        isZoraToken: true,
        creatorAddress: '0xabcdef1234567890abcdef1234567890abcdef12'
      },
      {
        address: '0x2345678901234567890123456789012345678901',
        name: 'Creator Token 2',
        symbol: 'CT2',
        decimals: 18,
        lastPrice: '0.0025',
        priceUpdateTime: new Date(),
        isZoraToken: true,
        creatorAddress: '0xbcdef1234567890abcdef1234567890abcdef123'
      },
      {
        address: '0x3456789012345678901234567890123456789012',
        name: 'Creator Token 3',
        symbol: 'CT3',
        decimals: 18,
        lastPrice: '0.005',
        priceUpdateTime: new Date(),
        isZoraToken: true,
        creatorAddress: '0xcdef1234567890abcdef1234567890abcdef1234'
      }
    ];
    
    // Clear existing tokens
    await Token.deleteMany({});
    
    // Insert sample tokens
    await Token.insertMany(sampleTokens);
    
    console.log('✅ Sample tokens seeded successfully');
    console.log('✅ Database seeding completed successfully');
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    
    return true;
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    
    // Disconnect from MongoDB
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    return false;
  }
}

// If this script is run directly, seed the database
if (require.main === module) {
  seedDatabase().then((success) => {
    if (!success) {
      process.exit(1);
    }
    process.exit(0);
  });
}

module.exports = { seedDatabase }; 