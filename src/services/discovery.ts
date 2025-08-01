// Discovery service for Zoracle Bot
import { ethers  } from 'ethers';
import axios from 'axios';
import { CONFIG  } from '../config';

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
async function getNewCoins(): Promise<any> {
  try {
    const last24Hours = Math.floor(Date.now() / 1000) - 86400; // 24 hours ago
    
    // Add timeout and retry options
    const response = await axios.post(ZORA_API, {
      query: NEW_COINS_QUERY,
      variables: { last24Hours }
    }, {
      timeout: 5000, // 5 second timeout
      validateStatus: status => status < 500 // Only treat 5xx as errors
    });

    // Check if we have a valid response with data
    if (response.data && response.data.data && response.data.data.tokens) {
      return response.data.data.tokens.map(token => ({
        address: token.address,
        name: token.name || 'Unknown',
        symbol: token.symbol || 'UNKNOWN',
        title: token.metadata?.title || 'Untitled',
        creator: token.metadata?.creator || 'Unknown Creator',
        mintedAt: token.mintedAt
      }));
    } else {
      console.warn('Invalid response format from Zora API');
      return [];
    }
  } catch (error) {
    console.error('Error fetching new coins:', error.message);
    // Return mock data when API is down
    return [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'API Unavailable - Sample Coin',
        symbol: 'SAMPLE',
        title: 'API Currently Unavailable',
        creator: 'System',
        mintedAt: Math.floor(Date.now() / 1000)
      }
    ];
  }
}

/**
 * Fetch trending Zora content coins
 * @returns {Promise<Array<Object>>} - List of trending coins
 */
async function getTrendingCoins(): Promise<any> {
  try {
    const response = await axios.post(ZORA_API, {
      query: TRENDING_QUERY
    }, {
      timeout: 5000, // 5 second timeout
      validateStatus: status => status < 500 // Only treat 5xx as errors
    });

    // Check if we have a valid response with data
    if (response.data && response.data.data && response.data.data.tokens) {
      return response.data.data.tokens.map(token => ({
        address: token.address,
        name: token.name || 'Unknown',
        symbol: token.symbol || 'UNKNOWN',
        title: token.metadata?.title || 'Untitled',
        creator: token.metadata?.creator || 'Unknown Creator',
        volume: token.volume || 0,
        holders: token.holderCount || 0
      }));
    } else {
      console.warn('Invalid response format from Zora API');
      return [];
    }
  } catch (error) {
    console.error('Error fetching trending coins:', error.message);
    // Return mock data when API is down
    return [
      {
        address: '0x2345678901234567890123456789012345678901',
        name: 'API Unavailable - Trending Sample',
        symbol: 'TREND',
        title: 'API Currently Unavailable',
        creator: 'System',
        volume: 1000,
        holders: 250
      }
    ];
  }
}

/**
 * Search coins by metadata
 * @param {string} query - Search term (title or creator)
 * @returns {Promise<Array<Object>>} - Matching coins
 */
async function searchCoins(query): Promise<any> {
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
async function isZoraCoin(tokenAddress): Promise<any> {
  try {
    // Normalize the address to checksum format to avoid errors
    const checksumAddress = ethers.utils.getAddress(tokenAddress);
    
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

    // Add timeout and improved error handling
    const response = await axios.post(ZORA_API, {
      query,
      variables: { address: checksumAddress }
    }, {
      timeout: 5000, // 5 second timeout
      validateStatus: status => status < 500 // Only treat 5xx as errors
    });

    // Check if we have valid data
    if (response.data && response.data.data) {
      return !!response.data.data.token;
    }
    return false;
  } catch (error) {
    console.error('Error checking Zora coin:', error);
    // Don't break the flow if API is down, just return false
    return false;
  }
}

export { 
  getNewCoins,
  getTrendingCoins,
  searchCoins,
  isZoraCoin
 };