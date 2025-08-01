import { QueryInterface, Sequelize } from 'sequelize';

/**
 * Migration for creating initial database schema
 */
export default {
  up: async (queryInterface: QueryInterface, Sequelize: any) => {
    // Users table
    await queryInterface.createTable('Users', {
      telegramId: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      username: {
        type: Sequelize.STRING,
        allowNull: true
      },
      walletAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      encryptedPrivateKey: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      pin: {
        type: Sequelize.STRING,
        allowNull: true
      },
      twoFactorEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      twoFactorSecret: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lastActive: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Transactions table
    await queryInterface.createTable('Transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      telegramId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'telegramId'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      tokenAddress: {
        type: Sequelize.STRING,
        allowNull: false
      },
      tokenSymbol: {
        type: Sequelize.STRING,
        allowNull: true
      },
      amount: {
        type: Sequelize.STRING,
        allowNull: false
      },
      ethValue: {
        type: Sequelize.STRING,
        allowNull: true
      },
      txHash: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'pending'
      },
      timestamp: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      gasUsed: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Tokens table
    await queryInterface.createTable('Tokens', {
      address: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      symbol: {
        type: Sequelize.STRING,
        allowNull: false
      },
      decimals: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      lastPrice: {
        type: Sequelize.STRING,
        allowNull: true
      },
      priceUpdateTime: {
        type: Sequelize.DATE,
        allowNull: true
      },
      isZoraToken: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      creatorAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Alerts table
    await queryInterface.createTable('Alerts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      telegramId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'telegramId'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tokenAddress: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Tokens',
          key: 'address'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      condition: {
        type: Sequelize.STRING,
        allowNull: false
      },
      value: {
        type: Sequelize.STRING,
        allowNull: false
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      triggered: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // CopyTrade table
    await queryInterface.createTable('CopyTrades', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      telegramId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'telegramId'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      targetAddress: {
        type: Sequelize.STRING,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      minAmount: {
        type: Sequelize.STRING,
        allowNull: true
      },
      maxAmount: {
        type: Sequelize.STRING,
        allowNull: true
      },
      autoTrade: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Settings table
    await queryInterface.createTable('Settings', {
      telegramId: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'Users',
          key: 'telegramId'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      slippage: {
        type: Sequelize.FLOAT,
        defaultValue: 1.0
      },
      gasPrice: {
        type: Sequelize.INTEGER,
        defaultValue: 5
      },
      notifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      theme: {
        type: Sequelize.STRING,
        defaultValue: 'light'
      },
      language: {
        type: Sequelize.STRING,
        defaultValue: 'en'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable('Settings');
    await queryInterface.dropTable('CopyTrades');
    await queryInterface.dropTable('Alerts');
    await queryInterface.dropTable('Tokens');
    await queryInterface.dropTable('Transactions');
    await queryInterface.dropTable('Users');
  }
};