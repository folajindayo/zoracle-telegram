'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
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
      gasPrice: {
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
        allowNull: false
      },
      tokenSymbol: {
        type: Sequelize.STRING,
        allowNull: true
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      threshold: {
        type: Sequelize.STRING,
        allowNull: false
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      lastTriggered: {
        type: Sequelize.DATE,
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

    // CopyTrades table
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
      targetWallet: {
        type: Sequelize.STRING,
        allowNull: false
      },
      maxEthPerTrade: {
        type: Sequelize.STRING,
        allowNull: false
      },
      slippage: {
        type: Sequelize.FLOAT,
        defaultValue: 2.0
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      sandboxMode: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
        allowNull: true
      },
      symbol: {
        type: Sequelize.STRING,
        allowNull: true
      },
      decimals: {
        type: Sequelize.INTEGER,
        defaultValue: 18
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

    // Create indexes
    await queryInterface.addIndex('Transactions', ['telegramId']);
    await queryInterface.addIndex('Transactions', ['tokenAddress']);
    await queryInterface.addIndex('Transactions', ['txHash']);
    await queryInterface.addIndex('Alerts', ['telegramId']);
    await queryInterface.addIndex('Alerts', ['tokenAddress']);
    await queryInterface.addIndex('CopyTrades', ['telegramId']);
    await queryInterface.addIndex('CopyTrades', ['targetWallet']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Tokens');
    await queryInterface.dropTable('CopyTrades');
    await queryInterface.dropTable('Alerts');
    await queryInterface.dropTable('Transactions');
    await queryInterface.dropTable('Users');
  }
}; 