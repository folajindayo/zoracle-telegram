#!/usr/bin/env python3
"""
Check the configuration of the Zoracle Telegram Bot.
"""
import os
import sys
import logging
from dotenv import load_dotenv
from web3 import Web3

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def check_config():
    """Check the configuration of the Zoracle Telegram Bot."""
    # Load environment variables
    load_dotenv()
    
    # Check required environment variables
    required_env_vars = [
        'TELEGRAM_BOT_TOKEN',
        'ALCHEMY_API_KEY',
        'ENCRYPTION_KEY'
    ]
    
    missing_vars = []
    for var in required_env_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please add these to your .env file.")
        return False
    
    # Check RPC connection
    network = os.getenv('NETWORK', 'testnet').lower()
    if network == 'testnet':
        rpc_url = os.getenv('BASE_TESTNET_RPC', f"https://base-sepolia.g.alchemy.com/v2/{os.getenv('ALCHEMY_API_KEY')}")
        chain_id = 84532  # Base Sepolia
    else:
        rpc_url = os.getenv('BASE_MAINNET_RPC', f"https://base-mainnet.g.alchemy.com/v2/{os.getenv('ALCHEMY_API_KEY')}")
        chain_id = 8453  # Base Mainnet
    
    try:
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            logger.error(f"❌ Could not connect to RPC URL: {rpc_url}")
            return False
        
        # Check chain ID
        if w3.eth.chain_id != chain_id:
            logger.error(f"❌ Chain ID mismatch. Expected {chain_id}, got {w3.eth.chain_id}")
            return False
        
        logger.info(f"✅ Connected to Base {network}. Chain ID: {w3.eth.chain_id}")
    except Exception as e:
        logger.error(f"❌ Error connecting to RPC URL: {str(e)}")
        return False
    
    # Check encryption key
    try:
        from cryptography.fernet import Fernet
        encryption_key = os.getenv('ENCRYPTION_KEY')
        fernet = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
        test_data = fernet.encrypt(b"test")
        decrypted = fernet.decrypt(test_data)
        if decrypted != b"test":
            logger.error("❌ Encryption key test failed")
            return False
        
        logger.info("✅ Encryption key is valid")
    except Exception as e:
        logger.error(f"❌ Error testing encryption key: {str(e)}")
        return False
    
    # All checks passed
    logger.info("✅ All configuration checks passed")
    return True

if __name__ == "__main__":
    if check_config():
        print("\n✅ Configuration is valid. Bot is ready to run.")
        sys.exit(0)
    else:
        print("\n❌ Configuration check failed. Please fix the issues above.")
        sys.exit(1) 