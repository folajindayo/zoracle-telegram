/**
 * Migration: Add Limit Orders Collection
 * This migration creates the limit orders collection with proper indexes
 */
import { mongoose } from '../models';

export async function up(): Promise<void> {
  try {
    console.log('🔄 Running migration: Add Limit Orders Collection');
    
    // Create the LimitOrder collection
    const LimitOrder = mongoose.model('LimitOrder');
    
    // Create indexes for better query performance
    await LimitOrder.createIndexes();
    
    // Create specific indexes
    await LimitOrder.collection.createIndex(
      { telegramId: 1, status: 1 },
      { name: 'idx_telegramId_status' }
    );
    
    await LimitOrder.collection.createIndex(
      { status: 1, createdAt: 1 },
      { name: 'idx_status_createdAt' }
    );
    
    await LimitOrder.collection.createIndex(
      { tokenAddress: 1, network: 1 },
      { name: 'idx_tokenAddress_network' }
    );
    
    await LimitOrder.collection.createIndex(
      { expiresAt: 1 },
      { name: 'idx_expiresAt' }
    );
    
    console.log('✅ Migration completed: Limit Orders Collection created with indexes');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

export async function down(): Promise<void> {
  try {
    console.log('🔄 Rolling back migration: Remove Limit Orders Collection');
    
    // Drop the LimitOrder collection
    await mongoose.connection.db.dropCollection('limitorders');
    
    console.log('✅ Rollback completed: Limit Orders Collection removed');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
} 