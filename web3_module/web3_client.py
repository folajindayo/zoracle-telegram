import os
import sys
import logging
from web3 import Web3
from eth_account import Account
import json

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import RPC_URL, CHAIN_ID, ERC20_ABI, ROUTER_ABI

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class Web3Client:
    """Web3 client for interacting with the blockchain"""
    
    def __init__(self, rpc_url=None, chain_id=None):
        """Initialize the Web3 client"""
        self.rpc_url = rpc_url or RPC_URL
        self.chain_id = chain_id or CHAIN_ID
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        # Check connection
        if not self.w3.is_connected():
            logger.error(f"Failed to connect to RPC: {self.rpc_url}")
        else:
            logger.info(f"Connected to RPC: {self.rpc_url}")
            logger.info(f"Chain ID: {self.chain_id}")
    
    def is_address(self, address):
        """Check if an address is valid"""
        return self.w3.is_address(address)
    
    def get_eth_balance(self, address):
        """Get ETH balance for an address"""
        try:
            balance_wei = self.w3.eth.get_balance(address)
            balance_eth = self.w3.from_wei(balance_wei, 'ether')
            return balance_eth
        except Exception as e:
            logger.error(f"Error getting ETH balance: {str(e)}")
            return 0
    
    def get_token_balance(self, token_address, wallet_address):
        """Get token balance for an address"""
        try:
            # Create contract instance
            token_contract = self.w3.eth.contract(address=token_address, abi=ERC20_ABI)
            
            # Get token balance and decimals
            balance = token_contract.functions.balanceOf(wallet_address).call()
            decimals = token_contract.functions.decimals().call()
            
            # Convert to decimal representation
            balance_decimal = balance / (10 ** decimals)
            
            return balance_decimal
        except Exception as e:
            logger.error(f"Error getting token balance: {str(e)}")
            return 0
    
    def get_token_info(self, token_address):
        """Get token information"""
        try:
            # Create contract instance
            token_contract = self.w3.eth.contract(address=token_address, abi=ERC20_ABI)
            
            # Get token info
            name = token_contract.functions.name().call()
            symbol = token_contract.functions.symbol().call()
            decimals = token_contract.functions.decimals().call()
            
            return {
                "address": token_address,
                "name": name,
                "symbol": symbol,
                "decimals": decimals
            }
        except Exception as e:
            logger.error(f"Error getting token info: {str(e)}")
            return None
    
    def get_token_allowance(self, token_address, owner_address, spender_address):
        """Get token allowance"""
        try:
            # Create contract instance
            token_contract = self.w3.eth.contract(address=token_address, abi=ERC20_ABI)
            
            # Get allowance
            allowance = token_contract.functions.allowance(owner_address, spender_address).call()
            
            return allowance
        except Exception as e:
            logger.error(f"Error getting token allowance: {str(e)}")
            return 0
    
    def build_approve_tx(self, token_address, spender_address, wallet_address, amount=None):
        """Build an approve transaction"""
        try:
            # Create contract instance
            token_contract = self.w3.eth.contract(address=token_address, abi=ERC20_ABI)
            
            # Use max uint256 if amount is not specified
            if amount is None:
                amount = 2**256 - 1
            
            # Build transaction
            tx = token_contract.functions.approve(
                spender_address,
                amount
            ).build_transaction({
                'from': wallet_address,
                'gas': 100000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(wallet_address),
                'chainId': self.chain_id
            })
            
            return tx
        except Exception as e:
            logger.error(f"Error building approve transaction: {str(e)}")
            return None
    
    def build_swap_eth_for_tokens_tx(self, router_address, token_address, amount_eth, wallet_address, slippage=5.0, deadline_minutes=20):
        """Build a swap ETH for tokens transaction"""
        try:
            # Create router contract instance
            router_contract = self.w3.eth.contract(address=router_address, abi=ROUTER_ABI)
            
            # Convert ETH to wei
            amount_wei = self.w3.to_wei(amount_eth, 'ether')
            
            # Set deadline
            import time
            deadline = int(time.time() + (deadline_minutes * 60))
            
            # Build transaction
            from config import WETH_ADDRESS
            tx = router_contract.functions.swapExactETHForTokens(
                0,  # amountOutMin (0 for now, in production set this based on slippage)
                [WETH_ADDRESS, token_address],  # path
                wallet_address,  # to
                deadline  # deadline
            ).build_transaction({
                'from': wallet_address,
                'value': amount_wei,
                'gas': 250000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(wallet_address),
                'chainId': self.chain_id
            })
            
            return tx
        except Exception as e:
            logger.error(f"Error building swap ETH for tokens transaction: {str(e)}")
            return None
    
    def build_swap_tokens_for_eth_tx(self, router_address, token_address, amount_tokens, wallet_address, slippage=5.0, deadline_minutes=20):
        """Build a swap tokens for ETH transaction"""
        try:
            # Create router contract instance
            router_contract = self.w3.eth.contract(address=router_address, abi=ROUTER_ABI)
            
            # Create token contract instance
            token_contract = self.w3.eth.contract(address=token_address, abi=ERC20_ABI)
            
            # Get token decimals
            decimals = token_contract.functions.decimals().call()
            
            # Convert token amount to wei equivalent
            amount_tokens_wei = int(amount_tokens * (10 ** decimals))
            
            # Set deadline
            import time
            deadline = int(time.time() + (deadline_minutes * 60))
            
            # Build transaction
            from config import WETH_ADDRESS
            tx = router_contract.functions.swapExactTokensForETH(
                amount_tokens_wei,  # amountIn
                0,  # amountOutMin (0 for now, in production set this based on slippage)
                [token_address, WETH_ADDRESS],  # path
                wallet_address,  # to
                deadline  # deadline
            ).build_transaction({
                'from': wallet_address,
                'value': 0,
                'gas': 250000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(wallet_address),
                'chainId': self.chain_id
            })
            
            return tx
        except Exception as e:
            logger.error(f"Error building swap tokens for ETH transaction: {str(e)}")
            return None
    
    def sign_transaction(self, transaction, private_key):
        """Sign a transaction with a private key"""
        try:
            # Ensure the private key has 0x prefix
            if not private_key.startswith('0x'):
                private_key = '0x' + private_key
            
            # Sign the transaction
            signed_tx = self.w3.eth.account.sign_transaction(transaction, private_key)
            
            return signed_tx
        except Exception as e:
            logger.error(f"Error signing transaction: {str(e)}")
            return None
    
    def send_raw_transaction(self, signed_tx):
        """Send a signed transaction to the network"""
        try:
            # Send the transaction
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            return tx_hash.hex()
        except Exception as e:
            logger.error(f"Error sending transaction: {str(e)}")
            return None
    
    def get_transaction_receipt(self, tx_hash):
        """Get a transaction receipt"""
        try:
            return self.w3.eth.get_transaction_receipt(tx_hash)
        except Exception as e:
            logger.error(f"Error getting transaction receipt: {str(e)}")
            return None
    
    def wait_for_transaction_receipt(self, tx_hash, timeout=120):
        """Wait for a transaction receipt"""
        try:
            return self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
        except Exception as e:
            logger.error(f"Error waiting for transaction receipt: {str(e)}")
            return None

# Create a singleton instance
web3_client = Web3Client()

# Export the instance
__all__ = ['web3_client'] 