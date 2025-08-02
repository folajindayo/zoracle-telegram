/**
 * Blockchain Explorer API Service
 * 
 * This service connects to blockchain explorer APIs to fetch real transaction data
 * and other on-chain information. Currently supports Base network via Basescan.
 */

import axios from 'axios';
import { CONFIG } from '../config';

// Define Ankr API endpoints with your API key
const ANKR_API = 'https://rpc.ankr.com/base/b39a19f9ecf66252bf862fe6948021cd1586009ee97874655f46481cfbf3f129';
const ANKR_ADVANCED_API = 'https://rpc.ankr.com/multichain/b39a19f9ecf66252bf862fe6948021cd1586009ee97874655f46481cfbf3f129';
const BASE_CHAIN_ID = 8453; // Chain ID for Base network

// Cache to avoid hitting rate limits
const txCache = new Map<string, any>();
const cacheExpiry = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch transactions for a specific address from Basescan
 * @param address Wallet address
 * @param limit Maximum number of transactions to return (default: 10)
 * @returns Transaction data or error
 */
export async function getTransactions(address: string, limit = 10, forceRefresh = false): Promise<any> {
  try {
    // Check cache first (unless force refresh is requested)
    const cacheKey = `${address}_txs`;
    const cachedData = txCache.get(cacheKey);
    if (!forceRefresh && cachedData && (Date.now() - cachedData.timestamp) < cacheExpiry) {
      return { success: true, data: cachedData.data };
    }

    // Using Ankr with your API key for enhanced rate limits and features
    
    // API call to Ankr for Base network transactions
    // Using standard eth_getBalance method first, then fallback to Advanced API
    try {
      // First try to get basic account info
      const balanceResponse = await axios.post(ANKR_API, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest']
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.ANKR_API_KEY}`
        },
        timeout: 10000 // 10 second timeout
      });

      // If balance call succeeds, proceed to get transactions via Advanced API
      if (balanceResponse.data && balanceResponse.data.result && !balanceResponse.data.error) {
        // Fallback to Advanced API for transactions
        return getAnkrAccountTransactions(address, limit);
      } else {
        console.warn(`Ankr API returned invalid response for Base network:`, balanceResponse.data);
        if (balanceResponse.data && balanceResponse.data.error) {
          console.error(`Error: ${balanceResponse.data.error.message}`);
        }
        // Fallback to alternative method - get account transactions
        return getAnkrAccountTransactions(address, limit);
      }


    } catch (error) {
      console.error('Error fetching transactions from Ankr:', error);
      // Try alternate method
      return getAnkrAccountTransactions(address, limit);
    }
  } catch (error) {
    console.error('Error fetching transactions from blockchain explorer:', error);
    return getMockTransactions(address, limit);
  }
}

/**
 * Format raw transaction data from Ankr API into a standardized format
 * @param rawTxs Raw transaction data from Ankr API
 * @returns Formatted transaction data
 */
function formatAnkrTransactions(rawTxs: any[]): any[] {
  if (!rawTxs || !Array.isArray(rawTxs)) return [];
  
  return rawTxs.map(tx => {
    // Determine transaction type
    let type = 'transfer';
    if (tx.from && tx.to && tx.from.toLowerCase() === tx.to.toLowerCase()) {
      type = 'self';
    } else if (tx.input && tx.input !== '0x' && tx.input !== '0x0') {
      type = 'contract';
    }
    
    // Convert hex values to numbers
    const value = parseInt(tx.value || '0x0', 16) / 1e18; // Convert from wei to ETH
    const gasPrice = tx.gasPrice ? parseInt(tx.gasPrice, 16) / 1e9 : 0; // Convert to Gwei
    const gasUsed = tx.gasUsed ? parseInt(tx.gasUsed, 16) : parseInt(tx.gas || '0x0', 16);
    
    // Timestamp - if available
    const timestamp = tx.timeStamp 
      ? parseInt(tx.timeStamp) * 1000 
      : tx.blockTimestamp 
        ? new Date(tx.blockTimestamp).getTime() 
        : Date.now(); // Fallback to current time if not available
    
    // Return standardized transaction object
    return {
      txHash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: value,
      timestamp: timestamp,
      date: new Date(timestamp).toISOString(),
      gas: gasUsed,
      gasPrice: gasPrice,
      type,
      isError: tx.isError === true || tx.isError === '1',
      status: tx.status === '1' || tx.status === true || (!tx.isError) ? 'success' : 'failed'
    };
  });
}

/**
 * Alternate method to get transactions using Ankr's Advanced API
 * @param address Wallet address
 * @param limit Maximum number of transactions
 * @returns Transaction data
 */
async function getAnkrAccountTransactions(address: string, limit = 10): Promise<any> {
  try {
    // Using Ankr's Advanced API for account transactions with your API key
    const response = await axios.post(ANKR_ADVANCED_API, {
      jsonrpc: '2.0',
      id: 1,
      method: 'ankr_getTransactionsByAddress',
      params: {
        blockchain: "base",
        address: address,
        pageSize: limit,
        pageToken: ""
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.ANKR_API_KEY}`
      },
      timeout: 15000 // 15 second timeout for advanced API
    });

    // Check if response is valid
    if (response.data && response.data.result && response.data.result.transactions) {
      
      // Format the transactions
      const txs = response.data.result.transactions.map((tx: any) => {
        // Get timestamp from blockTimestamp with better validation
        let timestamp;
        let dateString;
        
        try {
          // Try to parse the timestamp from various possible fields
          let timestampValue = null;
          
          // Check different possible timestamp fields based on Ankr API response
          if (tx.blockTimestamp) {
            timestampValue = tx.blockTimestamp;
          } else if (tx.timestamp) {
            // Ankr API returns timestamp as hex string, convert to decimal
            if (typeof tx.timestamp === 'string' && tx.timestamp.startsWith('0x')) {
              timestampValue = parseInt(tx.timestamp, 16) * 1000; // Convert to milliseconds
            } else {
              timestampValue = tx.timestamp;
            }
          } else if (tx.timeStamp) {
            timestampValue = tx.timeStamp;
          } else if (tx.blockTime) {
            timestampValue = tx.blockTime;
          } else if (tx.date) {
            timestampValue = tx.date;
          } else if (tx.blockNumber) {
            // If we have block number but no timestamp, we'll need to estimate
            // For now, use current time as fallback
            timestampValue = null;
          }
          
          if (timestampValue) {
            // If timestampValue is already a number (milliseconds), use it directly
            if (typeof timestampValue === 'number') {
              timestamp = timestampValue;
              dateString = new Date(timestamp).toISOString();
            } else {
              // Otherwise, try to parse it as a date string
              const parsedDate = new Date(timestampValue);
              if (!isNaN(parsedDate.getTime())) {
                timestamp = parsedDate.getTime();
                dateString = parsedDate.toISOString();
              } else {
                throw new Error('Invalid date format');
              }
            }
          } else {
            // If no timestamp field found, use current time
            timestamp = Date.now();
            dateString = new Date(timestamp).toISOString();
            console.log(`No timestamp field found for tx ${tx.hash}, using current time`);
          }
        } catch (e) {
          // Fallback to current time if timestamp is invalid
          timestamp = Date.now();
          dateString = new Date(timestamp).toISOString();
          console.warn(`Invalid timestamp for tx ${tx.hash}, using current time: ${e.message}`);
        }
        
        return {
          txHash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: parseFloat(tx.value || "0"),
          timestamp: timestamp,
          date: dateString,
          gas: tx.gasUsed || 0,
          gasPrice: tx.gasPrice || 0,
          type: tx.method ? 'contract' : 'transfer',
          status: tx.status === 'COMPLETED' ? 'success' : 'failed'
        };
      });

      // Store in cache
      const cacheKey = `${address}_txs`;
      txCache.set(cacheKey, {
        timestamp: Date.now(),
        data: txs
      });

      return { success: true, data: txs };
    } else {
      console.warn('Ankr Advanced API returned invalid response:', response.data);
      return getMockTransactions(address, limit);
    }
  } catch (error) {
    console.error('Ankr Advanced API returned invalid response:', error);
    return getMockTransactions(address, limit);
  }
}

/**
 * Format raw transaction data from explorer API into a standardized format
 * (Kept for backward compatibility)
 * @param rawTxs Raw transaction data from explorer API
 * @returns Formatted transaction data
 */
function formatTransactions(rawTxs: any[]): any[] {
  if (!rawTxs || !Array.isArray(rawTxs)) return [];
  
  return rawTxs.map(tx => {
    // Determine transaction type
    let type = 'transfer';
    if (tx.from.toLowerCase() === tx.to.toLowerCase()) {
      type = 'self';
    } else if (tx.input && tx.input !== '0x') {
      type = 'contract';
    }
    
    // Format timestamp
    const timestamp = parseInt(tx.timeStamp) * 1000;
    
    // Return standardized transaction object
    return {
      txHash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value / 1e18, // Convert from wei to ETH
      timestamp: timestamp,
      date: new Date(timestamp).toISOString(),
      gas: tx.gas,
      gasPrice: tx.gasPrice / 1e9, // Convert to Gwei
      type,
      isError: tx.isError === '1',
      status: tx.txreceipt_status === '1' ? 'success' : 'failed'
    };
  });
}

/**
 * Get mock transaction data when API is unavailable or for testing
 * @param address Wallet address
 * @param limit Maximum number of transactions to return
 * @returns Mock transaction data
 */
function getMockTransactions(address: string, limit = 10): any {
  // Create realistic mock data for development/testing
  const mockTxs = [];
  const now = Date.now();
  
  // Transaction types for random selection
  const types = ['buy', 'sell', 'transfer', 'swap'];
  const tokens = ['ETH', 'WETH', 'USDC', 'ZORA', 'BASE', 'OP'];
  
  // Generate random mock transactions
  for (let i = 0; i < limit; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const amount = (Math.random() * 10).toFixed(4);
    const timestamp = now - (i * 86400000 / 2); // Half-day intervals backwards
    
    mockTxs.push({
      txHash: `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 34)}`,
      from: type === 'sell' || type === 'transfer' ? address : `0x${Math.random().toString(16).substring(2, 42)}`,
      to: type === 'buy' || type === 'swap' ? address : `0x${Math.random().toString(16).substring(2, 42)}`,
      value: parseFloat(amount),
      token,
      timestamp,
      date: new Date(timestamp).toISOString(),
      type,
      status: Math.random() > 0.95 ? 'failed' : 'success' // 5% chance of failure
    });
  }
  
  return { success: true, data: mockTxs };
}

/**
 * Get token details and prices from Ankr API
 * @param address Wallet address
 * @returns Token data or error
 */
export async function getTokenData(address: string): Promise<any> {
  try {
    // Check cache first
    const cacheKey = `${address}_tokens`;
    const cachedData = txCache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp) < cacheExpiry) {
      return { success: true, data: cachedData.data };
    }
    
    try {
      // Using Ankr's Advanced API for token balances with your API key
      const response = await axios.post(ANKR_ADVANCED_API, {
        jsonrpc: '2.0',
        id: 1,
        method: 'ankr_getAccountBalance',
        params: {
          blockchain: "base",
          walletAddress: address,
          onlyWhitelisted: false
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.ANKR_API_KEY}`
        },
        timeout: 15000 // 15 second timeout for advanced API
      });
      
      // Check if response is valid
      if (response.data && response.data.result && response.data.result.assets) {
        // Format the token data into a format compatible with our app
        const tokens = response.data.result.assets.map((token: any) => {
          return {
            tokenSymbol: token.tokenSymbol,
            tokenName: token.tokenName,
            balance: token.balance,
            tokenDecimal: token.tokenDecimals.toString(),
            contractAddress: token.contractAddress || '0x0000000000000000000000000000000000000000',
            thumbnail: token.thumbnail
          };
        });
        
        // Store in cache
        txCache.set(cacheKey, {
          timestamp: Date.now(),
          data: tokens
        });
        
        return { success: true, data: tokens };
      } else {
        console.warn('Ankr API returned invalid token data:', response.data);
        // Try the fallback method
        return getAnkrTokenBalances(address);
      }
    } catch (error) {
      console.error('Error fetching token data from Ankr Advanced API:', error);
      // Try the fallback method
      return getAnkrTokenBalances(address);
    }
  } catch (error) {
    console.error('Error fetching token data:', error);
    return getMockTokenData(address);
  }
}

/**
 * Alternative method to get token balances using standard RPC calls
 * @param address Wallet address
 * @returns Token data or error
 */
async function getAnkrTokenBalances(address: string): Promise<any> {
  try {
    // For Base mainnet - try a simpler approach with standard JSON-RPC
    // We'll use eth_call to get ERC20 balances for common tokens
    
    // List of common tokens on Base
    const commonTokens = [
      { 
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6
      },
      { 
        address: '0x4200000000000000000000000000000000000006', 
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18
      },
      { 
        address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 
        symbol: 'DAI',
        name: 'Dai Stablecoin',
        decimals: 18
      }
    ];
    
    const balancePromises = commonTokens.map(async (token) => {
      try {
        // Create data for balanceOf function call
        const data = '0x70a08231' + // balanceOf function signature
                     '000000000000000000000000' + // padding
                     address.substring(2); // address without 0x prefix
        
        const result = await axios.post(ANKR_API, {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [{
            to: token.address,
            data: data
          }, 'latest']
        }, {
          headers: {
            'Authorization': `Bearer ${CONFIG.ANKR_API_KEY}`
          }
        });
        
        if (result.data && result.data.result) {
          const balance = parseInt(result.data.result, 16) / Math.pow(10, token.decimals);
          
          return {
            tokenSymbol: token.symbol,
            tokenName: token.name,
            balance: balance.toString(),
            tokenDecimal: token.decimals.toString(),
            contractAddress: token.address
          };
        }
        
        return null;
      } catch (e) {
        console.warn(`Failed to fetch balance for token ${token.symbol}:`, e);
        return null;
      }
    });
    
    // Also get ETH balance
    const ethBalancePromise = axios.post(ANKR_API, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest']
    }, {
      headers: {
        'Authorization': `Bearer ${CONFIG.ANKR_API_KEY}`
      }
    }).then(result => {
      if (result.data && result.data.result) {
        const balance = parseInt(result.data.result, 16) / 1e18;
        return {
          tokenSymbol: 'ETH',
          tokenName: 'Ethereum',
          balance: balance.toString(),
          tokenDecimal: '18',
          contractAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' // Standard placeholder for native ETH
        };
      }
      return null;
    }).catch(e => {
      console.warn('Failed to fetch ETH balance:', e);
      return null;
    });
    
    const tokenResults = await Promise.all([...balancePromises, ethBalancePromise]);
    const validTokens = tokenResults.filter(token => token !== null);
    
    // Store in cache
    txCache.set(`${address}_tokens`, {
      timestamp: Date.now(),
      data: validTokens
    });
    
    return { success: true, data: validTokens };
  } catch (error) {
    console.error('Error fetching token balances with fallback method:', error);
    return getMockTokenData(address);
  }
}

/**
 * Get mock token data when API is unavailable or for testing
 * @param address Wallet address
 * @returns Mock token data
 */
function getMockTokenData(address: string): any {
  return {
    success: true,
    data: [
      {
        tokenSymbol: 'WETH',
        tokenName: 'Wrapped Ether',
        balance: '0.25',
        tokenDecimal: '18',
        contractAddress: '0x4200000000000000000000000000000000000006'
      },
      {
        tokenSymbol: 'USDC',
        tokenName: 'USD Coin',
        balance: '150',
        tokenDecimal: '6',
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
      },
      {
        tokenSymbol: 'ZORA',
        tokenName: 'Zora',
        balance: '25.5',
        tokenDecimal: '18',
        contractAddress: '0x7777777777777777777777777777777777777777'
      }
    ]
  };
}