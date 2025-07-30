// Configuration file for Zoracle Telegram Bot
import * as path from 'path';
import { Config } from '../types';

// Environment validation
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN', 
  'ALCHEMY_API_KEY'
];

// CDP API keys are optional in development mode
if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push('CDP_API_KEY', 'CDP_API_SECRET');
}

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ERROR: ${envVar} is not set in environment variables!`);
    console.error('Please create a .env file with the required variables.');
    process.exit(1);
  }
}

// Paths
const WALLETS_DIR = path.join(__dirname, '../../services/secure_wallets');
const LOGS_DIR = path.join(__dirname, '../../logs');

// Configuration
const CONFIG: Config & Record<string, any> = {
  // Bot operation
  BOT_VERSION: '1.0.0',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Network configuration
  NETWORK: process.env.NETWORK || 'base',
  PROVIDER_URL: process.env.PROVIDER_URL || `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  TESTNET_PROVIDER_URL: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  
  // CDP Server Wallet configuration
  CDP_NETWORK: process.env.CDP_NETWORK || 'base',
  CDP_API_URL: process.env.CDP_API_URL || 'https://api.cloud.coinbase.com/api/v2/',
  CDP_API_KEY: process.env.CDP_API_KEY,
  CDP_API_SECRET: process.env.CDP_API_SECRET,
  CDP_SIMULATION_MODE: process.env.NODE_ENV !== 'production', // Use simulation mode in development
  
  // Trading fees
  FEE_PERCENTAGE: 5, // 0.5% trading fee
  FEE_RECIPIENT: process.env.FEE_RECIPIENT || '0x27cEe32550DcC30De5a23551bAF7de2f3b0b98A0', // Fee recipient wallet
  
  // Trading defaults
  DEFAULT_SLIPPAGE: 1.0, // 1% default slippage
  DEFAULT_GAS_LIMIT: 300000,
  DEFAULT_TIMEOUT: 60, // 60 seconds timeout for transactions
  MIN_LIQUIDITY_ETH: 0.5, // Minimum 0.5 ETH in liquidity pool
  MAX_ORDER_SIZE_ETH: 10, // Maximum 10 ETH per trade
  
  // Wallet security
  WALLET_LOCK_TIMEOUT: 15, // 15 minutes of inactivity
  PASSWORD_ATTEMPTS_MAX: 5, // Max failed password attempts
  
  // Zora contracts
  ZORA_CONTRACTS: {
    FACTORY: '0x777777C338d93e2C7adf08D102d45CA7CC4Ed021',
    REWARDS: '0x7777777F279eba3d3Cf220dC9B65lDB275d3F0D9',
    DROPS: '0x7777777900D7af739d4531f14CD228C50D83C655',
  },
  
  // DEX routers on Base
  DEX_ROUTERS: {
    AERODROME: '0x41C8cf74c27554A8972d3BDE969Cbd0B11D0Ef23', // Aerodrome Router
    BASESWAP: '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86', // BaseSwap Router
    PANCAKESWAP: '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86', // PancakeSwap Router
  },
  
  // Token addresses
  TOKENS: {
    WETH: '0x4200000000000000000000000000000000000006', // Wrapped ETH on Base
    USDC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USD Coin on Base
  },
  
  // API endpoints
  ZORA_API_BASE: 'https://api.zora.co',
  ZORA_GRAPHQL: 'https://api.zora.co/graphql',
  PARASWAP_API: 'https://apiv5.paraswap.io',
  COINGECKO_API: 'https://api.coingecko.com/api/v3',
  
  // Chart and price services
  CHART_API: 'https://api.dexscreener.com/latest/dex/tokens',
  
  // MEV protection
  MEV_PROTECTION: {
    ENABLED: true,
    ORDER_SPLITS: 3, // Split orders into 3 parts
    MIN_RANDOM_DELAY: 100, // ms
    MAX_RANDOM_DELAY: 1500, // ms
    THRESHOLD: '1.0', // ETH - orders above this will be split
    RELAYERS: [
      'https://relay.flashbots.net',
      'https://api.edennetwork.io/v1/bundle',
      'https://rpc.beaverbuild.org'
    ]
  },

  // Alert thresholds
  ALERTS: {
    PRICE_CHANGE_THRESHOLD: 5, // 5% price change
    LIQUIDITY_CHANGE_THRESHOLD: 10, // 10% liquidity change
    WHALE_THRESHOLD_ETH: 1, // 1 ETH or more is considered a whale
    GAS_PRICE_WARNING: 100, // Gwei
  },
  
  // Copy trading
  COPY_TRADING: {
    DEFAULT_SLIPPAGE_GUARD: 2, // 2% max slippage for mirrored trades
    MIN_DELAY: 500, // ms minimum delay before executing mirrored trade
    MAX_DELAY: 2000, // ms maximum delay
  },
  
  // Paths
  WALLETS_DIR,
  LOGS_DIR,
  
  // Sandbox mode
  SANDBOX: {
    ENABLED: false, // Default to mainnet
    FAUCET_URL: 'https://faucet.base-sepolia.io',
  },
  
  // Database
  DATABASE: {
    TYPE: process.env.DB_TYPE || 'memory', // 'memory', 'mongodb', 'dynamodb'
    URL: process.env.DB_URL || null,
  }
};

// ABIs
const ABIS = {
  // ERC20 token ABI (minimal for balance/transfer)
  ERC20_ABI: [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 amount)',
    'event Approval(address indexed owner, address indexed spender, uint256 amount)',
  ],

  // Aerodrome Router ABI (for trading)
  AERODROME_ROUTER_ABI: [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function getAmountOut(uint amountIn, address tokenIn, address tokenOut) external view returns (uint amountOut, bool stable)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, (address input, address output, bool stable)[] calldata route, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, (address input, address output, bool stable)[] calldata route, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, (address input, address output, bool stable)[] calldata route, address to, uint deadline) external returns (uint[] memory amounts)',
  ],

  // Zora Factory ABI (for monitoring content creation)
  ZORA_FACTORY_ABI: [
    'event ContractCreated(address indexed creator, address indexed contractAddress, string name)',
    'event TokenCreated(address indexed contractAddress, uint256 indexed tokenId, string tokenURI)'
  ],

  // Zora ERC-1155 ABI (for content tokens)
  ZORA_1155_ABI: [
    'function uri(uint256 tokenId) view returns (string)',
    'function balanceOf(address account, uint256 id) view returns (uint256)',
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
    'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
  ]
};

export {
  CONFIG,
  ABIS
};