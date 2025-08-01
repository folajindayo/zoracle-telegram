// User Types
export interface User {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  wallets?: WalletInfo[];
  settings?: UserSettings;
  state?: string;
  stateData?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

// Wallet Types
export interface WalletInfo {
  id: string;
  userId: number;
  address: string;
  encryptedData: string;
  iv: string;
  name?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletSession {
  userId: number;
  walletId: string;
  expiresAt: Date;
}

export interface WalletData {
  privateKey?: string;
  mnemonic?: string;
  cdpWalletId?: string;
  cdpAddressId?: string;
}

export interface WalletResult {
  success: boolean;
  walletId?: string;
  address?: string;
  error?: string;
}

export interface BalanceResult {
  success: boolean;
  balance?: string;
  formattedBalance?: string;
  error?: string;
}

export interface TokenResult {
  success: boolean;
  symbol: string;
  name: string;
  balance: string;
  formattedBalance: string;
  decimals: number;
  address: string;
  error?: string;
}

// Transaction Types
export interface Transaction {
  id: string;
  userId: number;
  walletId: string;
  hash: string;
  type: TransactionType;
  status: TransactionStatus;
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  price?: string;
  gasFee?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionType {
  BUY = 'BUY',
  SELL = 'SELL',
  TRANSFER = 'TRANSFER'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED'
}

// Alert Types
export interface Alert {
  id: string;
  userId: number;
  type: AlertType;
  tokenAddress: string;
  tokenSymbol: string;
  condition: AlertCondition;
  value: string;
  active: boolean;
  triggered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum AlertType {
  PRICE = 'PRICE',
  VOLUME = 'VOLUME',
  MARKET_CAP = 'MARKET_CAP',
  WHALE_TRANSACTION = 'WHALE_TRANSACTION'
}

export enum AlertCondition {
  ABOVE = 'ABOVE',
  BELOW = 'BELOW',
  PERCENT_CHANGE = 'PERCENT_CHANGE'
}

// Copy Trade Types
export interface CopyTradeConfig {
  id: string;
  userId: number;
  targetAddress: string;
  name?: string;
  active: boolean;
  minAmount?: string;
  maxAmount?: string;
  autoTrade: boolean;
  tokens?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Settings Types
export interface UserSettings {
  userId: number;
  slippage: number;
  gasPrice: number;
  notifications: boolean;
  theme: string;
  language: string;
  currency: string;
  mevProtection: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Config Types
export interface Config {
  BOT_VERSION: string;
  LOG_LEVEL: string;
  NETWORK: string;
  PROVIDER_URL: string;
  TESTNET_PROVIDER_URL: string;
  CDP_NETWORK: string;
  ZORACLE_API_URL: string;
  CDP_API_KEY: string;
  CDP_API_SECRET: string;
  CDP_WALLET_SECRET: string;
  CDP_SIMULATION_MODE: boolean;
  FEE_PERCENTAGE: number;
  FEE_RECIPIENT: string;
  DEFAULT_SLIPPAGE: number;
  DEFAULT_GAS_LIMIT: number;
  DEFAULT_TIMEOUT: number;
  MIN_LIQUIDITY_ETH: number;
  MAX_ORDER_SIZE_ETH: number;
  WALLET_LOCK_TIMEOUT: number;
  PASSWORD_ATTEMPTS_MAX: number;
  ZORA_CONTRACTS: Record<string, string>;
  DEX_ROUTERS: Record<string, string>;
  TOKENS: Record<string, string>;
  ZORA_API_BASE: string;
  ZORA_GRAPHQL: string;
  PARASWAP_API: string;
  COINGECKO_API: string;
  CHART_API: string;
  MEV_PROTECTION: {
    ENABLED: boolean;
    ORDER_SPLITS: number;
    MIN_RANDOM_DELAY: number;
    MAX_RANDOM_DELAY: number;
    THRESHOLD: string;
    RELAYERS: string[];
  };
  ALERTS: {
    PRICE_CHANGE_THRESHOLD: number;
    LIQUIDITY_CHANGE_THRESHOLD: number;
    WHALE_THRESHOLD_ETH: number;
    GAS_PRICE_WARNING: number;
  };
  COPY_TRADING: {
    DEFAULT_SLIPPAGE_GUARD: number;
    MIN_DELAY: number;
    MAX_DELAY: number;
  };
  WALLETS_DIR: string;
  LOGS_DIR: string;
  SANDBOX: {
    ENABLED: boolean;
    FAUCET_URL: string;
  };
  DATABASE: {
    TYPE: string;
    URL: string | null;
  };
}

// Wallet States
export enum WALLET_STATES {
  NONE = 'NONE',
  AWAITING_PASSWORD = 'AWAITING_PASSWORD',
  AWAITING_PIN = 'AWAITING_PIN',
  AWAITING_PRIVATE_KEY = 'AWAITING_PRIVATE_KEY',
  AWAITING_MNEMONIC = 'AWAITING_MNEMONIC',
  AWAITING_WALLET_NAME = 'AWAITING_WALLET_NAME',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION'
}