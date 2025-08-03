/**
 * Language Migration Script
 * 
 * This script adds the language field to existing users in the database.
 */

import mongoose from 'mongoose';

// Connect to MongoDB
async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zoracle';
  
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Migration function
async function migrateLanguageField() {
  try {
    console.log('🔄 Starting language field migration...');
    
    // Get the User model
    const User = mongoose.model('User');
    
    // Find all users without language field or with null/undefined language
    const usersToUpdate = await User.find({
      $or: [
        { language: { $exists: false } },
        { language: null },
        { language: undefined }
      ]
    });
    
    console.log(`📊 Found ${usersToUpdate.length} users to update`);
    
    if (usersToUpdate.length === 0) {
      console.log('✅ No users need migration');
      return;
    }
    
    // Update all users to have 'en' as default language
    const result = await User.updateMany(
      {
        $or: [
          { language: { $exists: false } },
          { language: null },
          { language: undefined }
        ]
      },
      { $set: { language: 'en' } }
    );
    
    console.log(`✅ Successfully updated ${result.modifiedCount} users`);
    console.log('🌐 All users now have English as their default language');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await connectToDatabase();
    await migrateLanguageField();
    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
main(); 