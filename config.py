import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet

# Load environment variables
load_dotenv()

# Telegram Bot Token
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# Alchemy API Key
ALCHEMY_API_KEY = os.getenv("ALCHEMY_API_KEY")

# Network RPC URLs
BASE_MAINNET_RPC = os.getenv("BASE_MAINNET_RPC", f"https://base-mainnet.g.alchemy.com/v2/{ALCHEMY_API_KEY}")
BASE_TESTNET_RPC = os.getenv("BASE_TESTNET_RPC", f"https://base-sepolia.g.alchemy.com/v2/{ALCHEMY_API_KEY}")

# Current network setting
NETWORK = os.getenv("NETWORK", "testnet").lower()
RPC_URL = BASE_TESTNET_RPC if NETWORK == "testnet" else BASE_MAINNET_RPC

# Chain IDs
CHAIN_IDS = {
    "mainnet": 8453,  # Base Mainnet
    "testnet": 84532  # Base Sepolia
}
CHAIN_ID = CHAIN_IDS[NETWORK]

# Security
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
if not ENCRYPTION_KEY:
    # Generate a new key if not provided
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    print(f"Generated new encryption key: {ENCRYPTION_KEY}")
    print("Please add this to your .env file as ENCRYPTION_KEY")

# DEX Router Addresses
BASESWAP_ROUTER = os.getenv("BASESWAP_ROUTER", "0xaE4EC9901c3076D0DdBe76A520F9E90a6227aCB7")
VELORA_ROUTER = os.getenv("VELORA_ROUTER", "0x6e2B76966cbD9cF4cC2Fa0D76d24d5241E0ABC2F")

# Fee settings
FEE_RECIPIENT = os.getenv("FEE_RECIPIENT", "0x27cEe32550DcC30De5a23551bAF7de2f3b0b98A0")
FEE_PERCENTAGE = float(os.getenv("FEE_PERCENTAGE", "0.5"))

# Database settings
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./zoracle_bot.db")

# Token contract ABI (minimal for ERC-20)
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": False,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "payable": False,
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [
            {"name": "_owner", "type": "address"},
            {"name": "_spender", "type": "address"}
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    }
]

# Router ABI (minimal for swapping)
ROUTER_ABI = [
    {
        "inputs": [
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactETHForTokens",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "amountIn", "type": "uint256"},
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactTokensForETH",
        "outputs": [{"name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

# Bot version
BOT_VERSION = "1.0.0"

# Common token addresses
WETH_ADDRESS = "0x4200000000000000000000000000000000000006"  # Wrapped ETH on Base 