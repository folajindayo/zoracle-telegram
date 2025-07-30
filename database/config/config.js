/**
 * Database Configuration
 * 
 * This file contains configuration for different environments (development, test, production).
 * Used by Sequelize CLI for migrations and seeders.
 */
require('dotenv').config({ path: '../../.env' });
const path = require('path');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../database/zoracle.sqlite'),
    logging: console.log,
    define: {
      timestamps: true
    }
  },
  test: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../database/zoracle_test.sqlite'),
    logging: false,
    define: {
      timestamps: true
    }
  },
  production: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../database/zoracle.sqlite'),
    logging: false,
    define: {
      timestamps: true
    }
  }
}; 