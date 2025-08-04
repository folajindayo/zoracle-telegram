// CoinGecko API service for token information
import axios from 'axios';

const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';

/**
 * Get token details from CoinGecko
 * @param {string} tokenAddress - Token contract address
 * @param {string} network - Network name (default: base)
 * @returns {Promise<Object>} - Token details
 */
async function getTokenDetails(tokenAddress: string, network: string = 'base'): Promise<any> {
  try {
    // Map network to CoinGecko platform ID
    const platformMap: { [key: string]: string } = {
      'base': 'base',
      'ethereum': 'ethereum',
      'polygon': 'polygon-pos',
      'bsc': 'binance-smart-chain',
      'arbitrum': 'arbitrum-one',
      'optimism': 'optimistic-ethereum'
    };

    const platform = platformMap[network] || 'base';
    
    // Get token info from CoinGecko
    const response = await axios.get(`${COINGECKO_API_BASE_URL}/coins/${platform}/contract/${tokenAddress}`, {
      timeout: 10000,
      validateStatus: (status) => status < 500
    });

    if (!response.data) {
      throw new Error('No data received from CoinGecko');
    }

    const tokenData = response.data;
    
    return {
      success: true,
      token: {
        id: tokenData.id,
        symbol: tokenData.symbol?.toUpperCase(),
        name: tokenData.name,
        address: tokenAddress,
        decimals: tokenData.detail_platforms?.[platform]?.decimal_place || 18,
        marketCap: tokenData.market_data?.market_cap?.usd,
        price: tokenData.market_data?.current_price?.usd,
        volume24h: tokenData.market_data?.total_volume?.usd,
        priceChange24h: tokenData.market_data?.price_change_percentage_24h,
        totalSupply: tokenData.market_data?.total_supply,
        circulatingSupply: tokenData.market_data?.circulating_supply,
        image: tokenData.image?.large,
        description: tokenData.description?.en,
        website: tokenData.links?.homepage?.[0],
        twitter: tokenData.links?.twitter_screen_name,
        telegram: tokenData.links?.telegram_channel_identifier,
        reddit: tokenData.links?.subreddit_url,
        github: tokenData.links?.repos_url?.github?.[0],
        explorer: tokenData.links?.blockchain_site?.[0],
        contractAddress: tokenAddress,
        platform: platform
      }
    };
  } catch (error: any) {
    console.error('Error fetching token details from CoinGecko:', error.message);
    
    // Return basic info if CoinGecko fails
    return {
      success: false,
      message: `Failed to fetch token details: ${error.message}`,
      token: {
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        address: tokenAddress,
        decimals: 18,
        platform: network
      }
    };
  }
}

/**
 * Get token price from CoinGecko
 * @param {string} tokenAddress - Token contract address
 * @param {string} network - Network name (default: base)
 * @returns {Promise<Object>} - Token price
 */
async function getTokenPrice(tokenAddress: string, network: string = 'base'): Promise<any> {
  try {
    const platformMap: { [key: string]: string } = {
      'base': 'base',
      'ethereum': 'ethereum',
      'polygon': 'polygon-pos',
      'bsc': 'binance-smart-chain',
      'arbitrum': 'arbitrum-one',
      'optimism': 'optimistic-ethereum'
    };

    const platform = platformMap[network] || 'base';
    
    const response = await axios.get(`${COINGECKO_API_BASE_URL}/simple/token_price/${platform}`, {
      params: {
        contract_addresses: tokenAddress,
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_market_cap: true,
        include_24hr_vol: true
      },
      timeout: 10000,
      validateStatus: (status) => status < 500
    });

    if (!response.data || !response.data[tokenAddress.toLowerCase()]) {
      throw new Error('Token not found on CoinGecko');
    }

    const priceData = response.data[tokenAddress.toLowerCase()];
    
    return {
      success: true,
      price: priceData.usd,
      priceChange24h: priceData.usd_24h_change,
      marketCap: priceData.usd_market_cap,
      volume24h: priceData.usd_24h_vol
    };
  } catch (error: any) {
    console.error('Error fetching token price from CoinGecko:', error.message);
    return {
      success: false,
      message: `Failed to fetch token price: ${error.message}`
    };
  }
}

/**
 * Search for tokens on CoinGecko
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Search results
 */
async function searchTokens(query: string): Promise<any> {
  try {
    const response = await axios.get(`${COINGECKO_API_BASE_URL}/search`, {
      params: {
        query: query
      },
      timeout: 10000,
      validateStatus: (status) => status < 500
    });

    if (!response.data || !response.data.coins) {
      throw new Error('No search results found');
    }

    return {
      success: true,
      coins: response.data.coins.slice(0, 10) // Limit to top 10 results
    };
  } catch (error: any) {
    console.error('Error searching tokens on CoinGecko:', error.message);
    return {
      success: false,
      message: `Failed to search tokens: ${error.message}`,
      coins: []
    };
  }
}

export {
  getTokenDetails,
  getTokenPrice,
  searchTokens
}; 