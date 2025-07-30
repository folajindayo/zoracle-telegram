/**
 * Database Configuration
 * 
 * This file contains configuration for different environments (development, test, production).
 * Used by Sequelize CLI for migrations and seeders.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

interface DbConfig {
  dialect: string;
  storage: string;
  logging: boolean | ((msg: string) => void);
  define: {
    timestamps: boolean;
  };
}

interface Config {
  development: DbConfig;
  test: DbConfig;
  production: DbConfig;
}

const config: Config = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../../database/zoracle.sqlite'),
    logging: console.log,
    define: {
      timestamps: true
    }
  },
  test: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../../database/zoracle_test.sqlite'),
    logging: false,
    define: {
      timestamps: true
    }
  },
  production: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../../database/zoracle.sqlite'),
    logging: false,
    define: {
      timestamps: true
    }
  }
};

export default config; 