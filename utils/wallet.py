import os
import sys
from web3 import Web3
from eth_account import Account
from cryptography.fernet import Fernet
import secrets
import binascii

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import ENCRYPTION_KEY, RPC_URL, CHAIN_ID

# Initialize Web3
w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Initialize encryption
fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)

def create_wallet():
    """Create a new Ethereum wallet"""
    # Generate a random private key
    private_key = "0x" + secrets.token_hex(32)
    account = Account.from_key(private_key)
    
    return {
        "address": account.address,
        "private_key": private_key
    }

def import_wallet_from_private_key(private_key):
    """Import a wallet from a private key"""
    try:
        # Strip '0x' prefix if present
        if private_key.startswith('0x'):
            private_key = private_key[2:]
        
        # Validate the private key
        if len(private_key) != 64:
            raise ValueError("Invalid private key length")
        
        # Convert to bytes and validate
        private_key_bytes = binascii.unhexlify(private_key)
        if len(private_key_bytes) != 32:
            raise ValueError("Invalid private key")
        
        # Create account from private key
        account = Account.from_key("0x" + private_key)
        
        return {
            "address": account.address,
            "private_key": "0x" + private_key
        }
    except (ValueError, binascii.Error) as e:
        raise ValueError(f"Invalid private key: {str(e)}")

def encrypt_private_key(private_key):
    """Encrypt a private key"""
    return fernet.encrypt(private_key.encode()).decode()

def decrypt_private_key(encrypted_private_key):
    """Decrypt a private key"""
    return fernet.decrypt(encrypted_private_key.encode()).decode()

def get_eth_balance(address):
    """Get ETH balance for an address"""
    balance_wei = w3.eth.get_balance(address)
    balance_eth = w3.from_wei(balance_wei, 'ether')
    return balance_eth

def get_token_balance(token_address, wallet_address):
    """Get token balance for an address"""
    from config import ERC20_ABI
    
    # Create contract instance
    token_contract = w3.eth.contract(address=token_address, abi=ERC20_ABI)
    
    # Get token balance and decimals
    balance = token_contract.functions.balanceOf(wallet_address).call()
    decimals = token_contract.functions.decimals().call()
    
    # Convert to decimal representation
    balance_decimal = balance / (10 ** decimals)
    
    return balance_decimal

def sign_transaction(private_key, transaction):
    """Sign a transaction with a private key"""
    # Ensure the private key has 0x prefix
    if not private_key.startswith('0x'):
        private_key = '0x' + private_key
    
    # Sign the transaction
    signed_tx = w3.eth.account.sign_transaction(transaction, private_key)
    
    return signed_tx

def send_raw_transaction(signed_tx):
    """Send a signed transaction to the network"""
    # Send the transaction
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
    
    return tx_hash.hex()

def validate_address(address):
    """Validate an Ethereum address"""
    return w3.is_address(address)

def get_transaction_receipt(tx_hash):
    """Get a transaction receipt"""
    return w3.eth.get_transaction_receipt(tx_hash)

def wait_for_transaction_receipt(tx_hash, timeout=120):
    """Wait for a transaction receipt"""
    return w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout) 