/**
 * MongoDB Database Module Index
 * 
 * This file exports all database-related modules for easy importing.
 */
const { mongoose, User, Transaction, Alert, CopyTrade, Token, initDb } = require('./models');
const { UserOps, TransactionOps, AlertOps, CopyTradeOps, TokenOps } = require('./operations');
const { initialize } = require('./init');

module.exports = {
  // Mongoose
  mongoose,
  
  // Models
  User,
  Transaction,
  Alert,
  CopyTrade,
  Token,
  
  // Operations
  UserOps,
  TransactionOps,
  AlertOps,
  CopyTradeOps,
  TokenOps,
  
  // Initialization
  initDb,
  initialize
}; 