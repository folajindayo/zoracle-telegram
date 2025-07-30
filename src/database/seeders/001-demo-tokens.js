'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Sample Zora tokens for testing
    return queryInterface.bulkInsert('Tokens', [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Creator Token 1',
        symbol: 'CT1',
        decimals: 18,
        lastPrice: '0.001',
        priceUpdateTime: new Date(),
        isZoraToken: true,
        creatorAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        address: '0x2345678901234567890123456789012345678901',
        name: 'Creator Token 2',
        symbol: 'CT2',
        decimals: 18,
        lastPrice: '0.0025',
        priceUpdateTime: new Date(),
        isZoraToken: true,
        creatorAddress: '0xbcdef1234567890abcdef1234567890abcdef123',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        address: '0x3456789012345678901234567890123456789012',
        name: 'Creator Token 3',
        symbol: 'CT3',
        decimals: 18,
        lastPrice: '0.005',
        priceUpdateTime: new Date(),
        isZoraToken: true,
        creatorAddress: '0xcdef1234567890abcdef1234567890abcdef1234',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Tokens', null, {});
  }
}; 