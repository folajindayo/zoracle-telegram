// Base Chain Monitor for Zora Content Coins
const { ethers } = require('ethers');
const axios = require('axios');
const { bot, users, sendPriceAlert, sendWhaleAlert, sendNewPairAlert } = require('./baseBot');

// Alchemy API setup
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const provider = new ethers.providers.AlchemyProvider('base', ALCHEMY_API_KEY);

// Zora-specific contract addresses
const ZORA_CONTRACTS = {
  // Zora 1155 Factory on Base
  ZORA_FACTORY: '0x777777C338d93e2C7adf08D102d45CA7CC4Ed021',
  // Zora Rewards on Base
  ZORA_REWARDS: '0x7777777F279eba3d3Cf220dC9B65lDB275d3F0D9',
  // Zora Drops on Base
  ZORA_DROPS: '0x7777777900D7af739d4531f14CD228C50D83C655',
};

// Common DEX Router addresses on Base for tracking pairs
const DEX_ROUTERS = {
  AERODROME: '0x41C8cf74c27554A8972d3BDE969Cbd0B11D0Ef23', // Aerodrome Router
  BASESWAP: '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86', // BaseSwap Router
  PANCAKESWAP: '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86', // PancakeSwap Router
};

// Minimum transaction value to be considered a whale transaction (in ETH)
const WHALE_THRESHOLD_ETH = 1;

// ABI fragments for monitoring
const ERC1155_FACTORY_ABI = [
  'event ContractCreated(address indexed creator, address indexed contractAddress, string name)',
  'event TokenCreated(address indexed contractAddress, uint256 indexed tokenId, string tokenURI)'
];

const ERC1155_ABI = [
  'function uri(uint256 tokenId) view returns (string)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
];

// Create contract instances for the Zora factory
const zoraFactory = new ethers.Contract(ZORA_CONTRACTS.ZORA_FACTORY, ERC1155_FACTORY_ABI, provider);

// Track known Zora content tokens
const knownZoraTokens = new Map();

/**
 * Initialize monitoring of Zora content coins on Base chain
 */
async function initializeMonitoring() {
  console.log('🚀 Starting Zora content coin monitoring on Base chain');
  
  // Monitor for new Zora contract creations
  monitorNewZoraContracts();
  
  // Monitor for new Zora token creations
  monitorNewZoraTokens();
  
  // Monitor for whale transactions
  monitorWhaleTransactions();
  
  // Monitor for new trading pairs
  monitorNewTradingPairs();
  
  // Poll for price updates of tracked tokens periodically
  startTokenPriceTracking();
  
  console.log('✅ Zora monitoring services initialized successfully');
}

/**
 * Monitor for new Zora contract creations
 */
function monitorNewZoraContracts() {
  console.log('👀 Monitoring for new Zora contract creations...');
  
  zoraFactory.on('ContractCreated', async (creator, contractAddress, name, event) => {
    console.log(`🔔 New Zora contract detected: ${name} (${contractAddress}) by ${creator}`);
    
    // Store the new contract
    knownZoraTokens.set(contractAddress, {
      name,
      creator,
      tokens: new Map(),
      createdAt: new Date().toISOString(),
      blockNumber: event.blockNumber
    });
    
    // Notify users who are interested in new Zora contracts
    notifyUsersAboutNewContract(creator, contractAddress, name);
  });
}

/**
 * Monitor for new Zora token creations within known contracts
 */
function monitorNewZoraTokens() {
  console.log('👀 Monitoring for new Zora token creations...');
  
  zoraFactory.on('TokenCreated', async (contractAddress, tokenId, tokenURI, event) => {
    console.log(`🔔 New Zora token created: ${tokenId} in contract ${contractAddress}`);
    
    try {
      // Get contract instance
      const contractData = knownZoraTokens.get(contractAddress);
      if (!contractData) {
        // If we don't know about this contract yet, fetch its basic info
        const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
        const name = await fetchTokenName(contractAddress, tokenId);
        
        knownZoraTokens.set(contractAddress, {
          name,
          creator: "Unknown", // We would need to query this
          tokens: new Map(),
          createdAt: new Date().toISOString(),
          blockNumber: event.blockNumber
        });
      }
      
      // Store token data
      const contract = knownZoraTokens.get(contractAddress);
      contract.tokens.set(tokenId.toString(), {
        tokenId: tokenId.toString(),
        tokenURI,
        createdAt: new Date().toISOString(),
        blockNumber: event.blockNumber
      });
      
      // Notify users who are interested in new Zora tokens
      notifyUsersAboutNewToken(contractAddress, tokenId, tokenURI);
      
    } catch (error) {
      console.error(`Error processing new token: ${error.message}`);
    }
  });
}

/**
 * Monitor for whale transactions involving Zora tokens
 */
function monitorWhaleTransactions() {
  console.log('🐳 Monitoring for whale transactions...');
  
  // Listen for Transfer events from known contracts
  for (const [contractAddress, contractData] of knownZoraTokens.entries()) {
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
    
    // Monitor ERC1155 single transfers
    contract.on('TransferSingle', async (operator, from, to, id, value, event) => {
      // Skip minting events (from zero address)
      if (from === ethers.constants.AddressZero) return;
      
      try {
        // Calculate estimated value (this would need actual price data in a real implementation)
        const estimatedValueETH = await estimateTokenValue(contractAddress, id, value);
        
        if (estimatedValueETH >= WHALE_THRESHOLD_ETH) {
          console.log(`🐳 Whale Transfer detected: ${value} tokens of ID ${id} from ${from} to ${to}`);
          
          // Fetch token details
          const tokenData = contractData.tokens.get(id.toString()) || { tokenURI: 'Unknown' };
          const tokenName = await fetchTokenName(contractAddress, id);
          
          // Notify users tracking this token or whale activity
          notifyUsersAboutWhaleTransaction(
            contractAddress,
            from,
            to,
            id,
            tokenName,
            value,
            estimatedValueETH,
            event.transactionHash
          );
        }
      } catch (error) {
        console.error(`Error processing whale transaction: ${error.message}`);
      }
    });
    
    // Also monitor batch transfers (similar logic would apply)
    contract.on('TransferBatch', async (operator, from, to, ids, values, event) => {
      // Skip minting events
      if (from === ethers.constants.AddressZero) return;
      
      // Process each token in the batch
      for (let i = 0; i < ids.length; i++) {
        try {
          const id = ids[i];
          const value = values[i];
          
          const estimatedValueETH = await estimateTokenValue(contractAddress, id, value);
          
          if (estimatedValueETH >= WHALE_THRESHOLD_ETH) {
            console.log(`🐳 Whale Batch Transfer detected: ${value} tokens of ID ${id} from ${from} to ${to}`);
            
            const tokenData = contractData.tokens.get(id.toString()) || { tokenURI: 'Unknown' };
            const tokenName = await fetchTokenName(contractAddress, id);
            
            notifyUsersAboutWhaleTransaction(
              contractAddress,
              from,
              to,
              id,
              tokenName,
              value,
              estimatedValueETH,
              event.transactionHash
            );
          }
        } catch (error) {
          console.error(`Error processing whale batch transaction: ${error.message}`);
        }
      }
    });
  }
}

/**
 * Monitor for new trading pairs involving Zora tokens
 */
function monitorNewTradingPairs() {
  console.log('📊 Monitoring for new trading pairs...');
  
  // In a real implementation, we would listen to events from DEX factory contracts
  // For demonstration, we'll check periodically for new pairs
  
  setInterval(async () => {
    for (const [contractAddress, contractData] of knownZoraTokens.entries()) {
      // For each token in the contract, check if new trading pairs have been created
      for (const [tokenId, tokenData] of contractData.tokens.entries()) {
        try {
          const newPairs = await checkForNewTradingPairs(contractAddress, tokenId);
          
          for (const pair of newPairs) {
            console.log(`📊 New trading pair detected for token ${tokenId} in contract ${contractAddress}`);
            
            const tokenName = await fetchTokenName(contractAddress, tokenId);
            
            notifyUsersAboutNewTradingPair(
              contractAddress,
              tokenId,
              tokenName,
              pair.dex,
              pair.pairAddress,
              pair.initialLiquidity
            );
          }
        } catch (error) {
          console.error(`Error checking new trading pairs: ${error.message}`);
        }
      }
    }
  }, 60 * 1000); // Check every minute (would be less frequent in production)
}

/**
 * Start tracking prices of known tokens and send alerts on significant changes
 */
function startTokenPriceTracking() {
  console.log('💰 Starting price tracking for Zora tokens...');
  
  // Store last known prices for comparison
  const lastKnownPrices = new Map();
  
  // Check price changes periodically
  setInterval(async () => {
    for (const [contractAddress, contractData] of knownZoraTokens.entries()) {
      // For each token in the contract, check price changes
      for (const [tokenId, tokenData] of contractData.tokens.entries()) {
        try {
          // This would query actual DEX price data in a real implementation
          const currentPrice = await fetchTokenPrice(contractAddress, tokenId);
          
          if (!currentPrice) continue; // Skip if price can't be determined
          
          const priceKey = `${contractAddress}-${tokenId}`;
          const lastPrice = lastKnownPrices.get(priceKey);
          
          if (lastPrice) {
            // Calculate price change percentage
            const priceChangePercent = ((currentPrice - lastPrice) / lastPrice) * 100;
            
            // Alert on significant price changes (>5% in either direction)
            if (Math.abs(priceChangePercent) >= 5) {
              console.log(`💰 Significant price change detected for token ${tokenId} in contract ${contractAddress}: ${priceChangePercent.toFixed(2)}%`);
              
              const tokenName = await fetchTokenName(contractAddress, tokenId);
              
              // Notify users tracking this token
              notifyUsersAboutPriceChange(
                contractAddress,
                tokenId,
                tokenName,
                priceChangePercent,
                currentPrice
              );
            }
          }
          
          // Update last known price
          lastKnownPrices.set(priceKey, currentPrice);
          
        } catch (error) {
          console.error(`Error tracking token price: ${error.message}`);
        }
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

/**
 * Helper function to fetch token name/symbol
 */
async function fetchTokenName(contractAddress, tokenId) {
  try {
    // In real implementation, this might query metadata from the token URI
    // For now, we'll use a placeholder with contract and token ID
    return `Zora #${tokenId}`;
  } catch (error) {
    console.error(`Error fetching token name: ${error.message}`);
    return `Unknown Token #${tokenId}`;
  }
}

/**
 * Estimate token value (placeholder - would use real price data)
 */
async function estimateTokenValue(contractAddress, tokenId, amount) {
  try {
    // In a real implementation, this would query pricing data from DEXes
    // For now we'll return a simulated value based on token ID
    const mockPricePerToken = (parseInt(tokenId.toString()) % 10 + 1) * 0.1;
    return mockPricePerToken * parseInt(amount.toString());
  } catch (error) {
    console.error(`Error estimating token value: ${error.message}`);
    return 0;
  }
}

/**
 * Check for new trading pairs (placeholder - would check DEX factory events)
 */
async function checkForNewTradingPairs(contractAddress, tokenId) {
  // In real implementation, this would query DEX factory events or APIs
  // For now, we'll occasionally simulate finding a new pair
  
  // Simulate randomly finding a new pair (1% chance)
  if (Math.random() < 0.01) {
    const dexNames = Object.keys(DEX_ROUTERS);
    const randomDex = dexNames[Math.floor(Math.random() * dexNames.length)];
    
    return [{
      dex: randomDex,
      pairAddress: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
      initialLiquidity: Math.floor(Math.random() * 10000) + 1000
    }];
  }
  
  return []; // No new pairs
}

/**
 * Fetch token price (placeholder - would use DEX price data)
 */
async function fetchTokenPrice(contractAddress, tokenId) {
  // In real implementation, this would query DEX price data
  // For now we'll return a simulated price
  return Math.random() * 0.1; // Random price between 0 and 0.1 ETH
}

/**
 * Notify users about a new Zora contract creation
 */
function notifyUsersAboutNewContract(creator, contractAddress, name) {
  // Iterate through all users
  for (const [chatId, userData] of users.entries()) {
    // Notify if user is following the creator or has new contract alerts enabled
    if (userData.alerts?.newPairs && 
        (userData.trackedWallets.includes(creator) || true)) { // For demo, notify all
      
      const message = `
🔔 *New Zora Content Contract Detected*

Creator: \`${creator.slice(0, 6)}...${creator.slice(-4)}\`
Contract: \`${contractAddress}\`
Name: ${name}

[View on BaseScan](https://basescan.org/address/${contractAddress})
      `;
      
      bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
    }
  }
}

/**
 * Notify users about a new Zora token creation
 */
function notifyUsersAboutNewToken(contractAddress, tokenId, tokenURI) {
  // Iterate through all users
  for (const [chatId, userData] of users.entries()) {
    // Notify if user is tracking this contract or has new token alerts enabled
    if (userData.alerts?.newPairs && 
        (userData.trackedTokens.includes(contractAddress) || true)) { // For demo, notify all
      
      const message = `
🖼️ *New Zora Content Token Created*

Contract: \`${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}\`
Token ID: ${tokenId}
Token URI: ${tokenURI.substring(0, 30)}${tokenURI.length > 30 ? '...' : ''}

[View on BaseScan](https://basescan.org/token/${contractAddress})
      `;
      
      bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });
    }
  }
}

/**
 * Notify users about a whale transaction
 */
function notifyUsersAboutWhaleTransaction(
  contractAddress, from, to, tokenId, tokenName, amount, valueETH, txHash
) {
  // Use the generic sendWhaleAlert function from baseBot.js
  for (const [chatId, userData] of users.entries()) {
    // Notify if user is tracking this contract, these addresses, or has whale alerts enabled
    if (userData.alerts?.whales && 
        (userData.trackedTokens.includes(contractAddress) || 
         userData.trackedWallets.includes(from) || 
         userData.trackedWallets.includes(to) || 
         true)) { // For demo, notify all
      
      // Approximate USD value (assuming 1 ETH = $2000)
      const usdValue = valueETH * 2000;
      
      sendWhaleAlert(
        chatId,
        from,
        to,
        contractAddress,
        tokenName,
        amount,
        usdValue,
        txHash
      );
    }
  }
}

/**
 * Notify users about a new trading pair
 */
function notifyUsersAboutNewTradingPair(
  contractAddress, tokenId, tokenName, dexName, pairAddress, initialLiquidity
) {
  // Use the generic sendNewPairAlert function from baseBot.js
  for (const [chatId, userData] of users.entries()) {
    // Notify if user is tracking this token or has new pair alerts enabled
    if (userData.alerts?.newPairs && 
        (userData.trackedTokens.includes(contractAddress) || true)) { // For demo, notify all
      
      sendNewPairAlert(
        chatId,
        contractAddress,
        tokenName,
        `#${tokenId}`,
        dexName,
        pairAddress,
        initialLiquidity
      );
    }
  }
}

/**
 * Notify users about a significant price change
 */
function notifyUsersAboutPriceChange(
  contractAddress, tokenId, tokenName, priceChangePercent, currentPrice
) {
  // Use the generic sendPriceAlert function from baseBot.js
  for (const [chatId, userData] of users.entries()) {
    // Notify if user is tracking this token or has price alerts enabled
    if (userData.alerts?.priceChange && 
        (userData.trackedTokens.includes(contractAddress) || true)) { // For demo, notify all
      
      sendPriceAlert(
        chatId,
        contractAddress,
        tokenName,
        `#${tokenId}`,
        priceChangePercent,
        currentPrice
      );
    }
  }
}

// Zora API endpoints for additional data
const ZORA_API_BASE = 'https://api.zora.co';

/**
 * Fetch data from Zora API
 */
async function fetchZoraAPIData(endpoint) {
  try {
    const response = await axios.get(`${ZORA_API_BASE}${endpoint}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching Zora API data: ${error.message}`);
    return null;
  }
}

/**
 * Update package.json to include new dependencies
 */
function updatePackageJSON() {
  // This would be done manually or with another helper function
  console.log('Remember to add ethers and axios to your package.json dependencies');
}

// Initialize monitoring when this module is loaded
initializeMonitoring().catch(error => {
  console.error('Failed to initialize Zora monitoring:', error);
});

module.exports = {
  initializeMonitoring,
  knownZoraTokens
}; 