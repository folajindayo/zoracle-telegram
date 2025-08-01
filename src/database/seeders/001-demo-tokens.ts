import { QueryInterface } from 'sequelize';

/**
 * Seeder for demo tokens
 */
export default {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkInsert('Tokens', [
      {
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
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
        address: '0xbcdef1234567890abcdef1234567890abcdef123',
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
        address: '0xcdef1234567890abcdef1234567890abcdef1234',
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

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete('Tokens', {});
  }
};