// GeckoTerminal API service for Zoracle Bot
import axios from 'axios';

// Base URL for GeckoTerminal API
const GECKOTERMINAL_API_BASE_URL = 'https://api.geckoterminal.com/api/v2';

/**
 * Get token price from GeckoTerminal API
 * @param {string} network - Network ID (e.g., 'eth', 'base', 'polygon')
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} - Token price data
 */
async function getTokenPrice(network: string, tokenAddress: string): Promise<any> {
  try {
    const response = await Promise.race([
      axios.get(`${GECKOTERMINAL_API_BASE_URL}/networks/${network}/tokens/${tokenAddress}/pools`, {
        params: {
          include: 'base_token,quote_token',
          page: 1,
          sort: 'h24_volume_usd_liquidity_desc'
        },
        timeout: 10000,
        validateStatus: status => status < 500
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('GeckoTerminal API request timed out')), 10000)
      )
    ]) as any;

    if (!response.data || !response.data.data || response.data.data.length === 0) {
      throw new Error('No pool data found for token');
    }

    // Get the top pool (highest volume)
    const topPool = response.data.data[0];
    const tokenPriceUsd = topPool.attributes.base_token_price_usd;

    if (!tokenPriceUsd) {
      throw new Error('Token price not available');
    }

    return {
      success: true,
      price: parseFloat(tokenPriceUsd),
      pool: topPool,
      message: 'Token price retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting token price from GeckoTerminal:', error);
    return {
      success: false,
      price: 0,
      message: `Failed to get token price: ${error.message}`
    };
  }
}

/**
 * Get multiple token prices
 * @param {Array} tokens - Array of {network, tokenAddress} objects
 * @returns {Promise<Object>} - Token prices data
 */
async function getMultipleTokenPrices(tokens: Array<{network: string, tokenAddress: string}>): Promise<any> {
  try {
    const pricePromises = tokens.map(token => 
      getTokenPrice(token.network, token.tokenAddress)
    );

    const results = await Promise.allSettled(pricePromises);
    const prices: {[key: string]: number} = {};
    const errors: string[] = [];

    results.forEach((result, index) => {
      const token = tokens[index];
      const key = `${token.network}:${token.tokenAddress}`;
      
      if (result.status === 'fulfilled' && result.value.success) {
        prices[key] = result.value.price;
      } else {
        errors.push(`Failed to get price for ${key}`);
      }
    });

    return {
      success: true,
      prices,
      errors,
      message: `Retrieved ${Object.keys(prices).length} prices, ${errors.length} errors`
    };
  } catch (error) {
    console.error('Error getting multiple token prices:', error);
    return {
      success: false,
      prices: {},
      errors: [error.message],
      message: `Failed to get token prices: ${error.message}`
    };
  }
}

/**
 * Get pool data for a token
 * @param {string} network - Network ID
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} - Pool data
 */
async function getTokenPools(network: string, tokenAddress: string): Promise<any> {
  try {
    const response = await Promise.race([
      axios.get(`${GECKOTERMINAL_API_BASE_URL}/networks/${network}/tokens/${tokenAddress}/pools`, {
        params: {
          include: 'base_token,quote_token,dex',
          page: 1,
          sort: 'h24_volume_usd_liquidity_desc'
        },
        timeout: 10000,
        validateStatus: status => status < 500
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('GeckoTerminal API request timed out')), 10000)
      )
    ]) as any;

    if (!response.data || !response.data.data) {
      throw new Error('No pool data found');
    }

    return {
      success: true,
      pools: response.data.data,
      included: response.data.included || [],
      message: 'Pool data retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting token pools:', error);
    return {
      success: false,
      pools: [],
      message: `Failed to get pool data: ${error.message}`
    };
  }
}

/**
 * Get supported networks from GeckoTerminal
 * @returns {Promise<Object>} - Supported networks
 */
async function getSupportedNetworks(): Promise<any> {
  try {
    const response = await Promise.race([
      axios.get(`${GECKOTERMINAL_API_BASE_URL}/networks`, {
        timeout: 10000,
        validateStatus: status => status < 500
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('GeckoTerminal API request timed out')), 10000)
      )
    ]) as any;

    if (!response.data || !response.data.data) {
      throw new Error('No network data found');
    }

    return {
      success: true,
      networks: response.data.data,
      message: 'Networks retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting supported networks:', error);
    return {
      success: false,
      networks: [],
      message: `Failed to get networks: ${error.message}`
    };
  }
}

/**
 * Get specific token data from GeckoTerminal API
 * @param {string} network - Network ID (e.g., 'eth', 'base', 'polygon')
 * @param {string} tokenAddress - Token contract address
 * @returns {Promise<Object>} - Token data including price and USD value
 */
async function getTokenData(network: string, tokenAddress: string): Promise<any> {
  try {
    const response = await Promise.race([
      axios.get(`${GECKOTERMINAL_API_BASE_URL}/networks/${network}/tokens/${tokenAddress}`, {
        params: {
          include: 'top_pools'
        },
        timeout: 10000,
        validateStatus: status => status < 500
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('GeckoTerminal API request timed out')), 10000)
      )
    ]) as any;

    if (!response.data || !response.data.data) {
      throw new Error('No token data found');
    }

    const tokenData = response.data.data;
    const attributes = tokenData.attributes;

    return {
      success: true,
      token: {
        id: tokenData.id,
        type: tokenData.type,
        name: attributes.name,
        address: attributes.address,
        symbol: attributes.symbol,
        decimals: attributes.decimals,
        totalSupply: attributes.total_supply,
        coingeckoCoinId: attributes.coingecko_coin_id,
        priceUsd: attributes.price_usd ? parseFloat(attributes.price_usd) : 0,
        fdvUsd: attributes.fdv_usd ? parseFloat(attributes.fdv_usd) : 0,
        totalReserveInUsd: attributes.total_reserve_in_usd ? parseFloat(attributes.total_reserve_in_usd) : 0,
        volumeUsd: attributes.volume_usd,
        marketCapUsd: attributes.market_cap_usd ? parseFloat(attributes.market_cap_usd) : 0
      },
      relationships: tokenData.relationships,
      message: 'Token data retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting token data from GeckoTerminal:', error);
    return {
      success: false,
      token: null,
      message: `Failed to get token data: ${error.message}`
    };
  }
}

export {
  getTokenPrice,
  getMultipleTokenPrices,
  getTokenPools,
  getSupportedNetworks,
  getTokenData
}; 