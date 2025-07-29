// Content-Coin Discovery Module
const axios = require('axios');
const { CONFIG } = require('./config');

// Zora API endpoints
const ZORA_API = 'https://api.zora.co/graphql';

// Subgraph query for new coins
const NEW_COINS_QUERY = `
query NewCoins($last24Hours: String) {
  tokens(where: { mintedAt_gt: $last24Hours, chain: BASE }) {
    id
    address
    name
    symbol
    metadata {
      title
      creator
    }
    mintedAt
  }
}
`;

// Trending query (based on volume/holders)
const TRENDING_QUERY = `
query TrendingCoins {
  tokens(orderBy: volume, orderDirection: desc, first: 50, chain: BASE) {
    id
    address
    name
    symbol
    metadata {
      title
      creator
    }
    volume
    holderCount
  }
}
`;

/**
 * Fetch new Zora content coins minted in last 24 hours
 * @returns {Promise<Array<Object>>} - List of new coins
 */
async function getNewCoins() {
  try {
    const last24Hours = Math.floor(Date.now() / 1000) - 86400; // 24 hours ago
    const response = await axios.post(ZORA_API, {
      query: NEW_COINS_QUERY,
      variables: { last24Hours }
    });

    return response.data.data.tokens.map(token => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      title: token.metadata.title,
      creator: token.metadata.creator,
      mintedAt: token.mintedAt
    }));
  } catch (error) {
    console.error('Error fetching new coins:', error);
    return [];
  }
}

/**
 * Fetch trending Zora content coins
 * @returns {Promise<Array<Object>>} - List of trending coins
 */
async function getTrendingCoins() {
  try {
    const response = await axios.post(ZORA_API, {
      query: TRENDING_QUERY
    });

    return response.data.data.tokens.map(token => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      title: token.metadata.title,
      creator: token.metadata.creator,
      volume: token.volume,
      holders: token.holderCount
    }));
  } catch (error) {
    console.error('Error fetching trending coins:', error);
    return [];
  }
}

/**
 * Search coins by metadata
 * @param {string} query - Search term (title or creator)
 * @returns {Promise<Array<Object>>} - Matching coins
 */
async function searchCoins(query) {
  try {
    // Simplified search - in real, use more advanced query
    const allNew = await getNewCoins();
    const allTrending = await getTrendingCoins();
    const allCoins = [...allNew, ...allTrending];

    return allCoins.filter(coin => 
      coin.title.toLowerCase().includes(query.toLowerCase()) ||
      coin.creator.toLowerCase().includes(query.toLowerCase())
    );
  } catch (error) {
    console.error('Error searching coins:', error);
    return [];
  }
}

/**
 * Check if token is Zora content coin
 * @param {string} tokenAddress - Token address
 * @returns {Promise<boolean>} - True if Zora coin
 */
async function isZoraCoin(tokenAddress) {
  try {
    const query = `
    query IsZoraCoin($address: String) {
      token(id: $address, chain: BASE) {
        id
        metadata {
          creator
        }
      }
    }
    `;

    const response = await axios.post(ZORA_API, {
      query,
      variables: { address: tokenAddress }
    });

    return !!response.data.data.token;
  } catch (error) {
    console.error('Error checking Zora coin:', error);
    return false;
  }
}

module.exports = {
  getNewCoins,
  getTrendingCoins,
  searchCoins,
  isZoraCoin
};