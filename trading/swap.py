import os
import sys
import time
from web3 import Web3

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import RPC_URL, ROUTER_ABI, WETH_ADDRESS, FEE_RECIPIENT, FEE_PERCENTAGE
from utils.wallet import sign_transaction, send_raw_transaction

# Initialize Web3
w3 = Web3(Web3.HTTPProvider(RPC_URL))

def buy_token_with_eth(
    token_address, 
    amount_eth, 
    wallet_address, 
    private_key, 
    slippage=5.0, 
    router_address=None,
    deadline_minutes=20
):
    """
    Buy a token with ETH
    
    Args:
        token_address: Address of the token to buy
        amount_eth: Amount of ETH to spend (in ETH, not wei)
        wallet_address: Address of the buyer's wallet
        private_key: Private key of the buyer's wallet
        slippage: Maximum slippage percentage (default: 5.0%)
        router_address: Address of the DEX router to use
        deadline_minutes: Transaction deadline in minutes
        
    Returns:
        Transaction hash
    """
    try:
        # Validate inputs
        if not w3.is_address(token_address):
            raise ValueError("Invalid token address")
        
        if not w3.is_address(wallet_address):
            raise ValueError("Invalid wallet address")
        
        if amount_eth <= 0:
            raise ValueError("Amount must be greater than 0")
        
        # Use default router if not specified
        if not router_address:
            from config import BASESWAP_ROUTER
            router_address = BASESWAP_ROUTER
        
        # Create router contract instance
        router_contract = w3.eth.contract(address=router_address, abi=ROUTER_ABI)
        
        # Calculate fee amount (if applicable)
        fee_amount_eth = amount_eth * (FEE_PERCENTAGE / 100)
        trade_amount_eth = amount_eth - fee_amount_eth
        
        # Convert ETH to wei
        amount_wei = w3.to_wei(trade_amount_eth, 'ether')
        fee_amount_wei = w3.to_wei(fee_amount_eth, 'ether')
        
        # Calculate minimum output amount based on slippage
        # In a real implementation, you would:
        # 1. Call the router's getAmountsOut function to get the expected output
        # 2. Apply the slippage to calculate the minimum output
        # For now, we'll use a simplified approach
        
        # Set transaction deadline
        deadline = int(time.time() + (deadline_minutes * 60))
        
        # Prepare the swap transaction
        swap_tx = router_contract.functions.swapExactETHForTokens(
            0,  # amountOutMin (0 for now, in production set this based on slippage)
            [WETH_ADDRESS, token_address],  # path
            wallet_address,  # to
            deadline  # deadline
        ).build_transaction({
            'from': wallet_address,
            'value': amount_wei,
            'gas': 250000,  # Estimated gas limit
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(wallet_address)
        })
        
        # If fee is applicable, send it first
        if fee_amount_eth > 0 and FEE_RECIPIENT:
            fee_tx = {
                'to': FEE_RECIPIENT,
                'value': fee_amount_wei,
                'gas': 21000,
                'gasPrice': w3.eth.gas_price,
                'nonce': w3.eth.get_transaction_count(wallet_address),
                'chainId': w3.eth.chain_id
            }
            
            # Sign and send fee transaction
            signed_fee_tx = sign_transaction(private_key, fee_tx)
            fee_tx_hash = send_raw_transaction(signed_fee_tx)
            
            # Increment nonce for the swap transaction
            swap_tx['nonce'] = swap_tx['nonce'] + 1
        
        # Sign and send the swap transaction
        signed_swap_tx = sign_transaction(private_key, swap_tx)
        swap_tx_hash = send_raw_transaction(signed_swap_tx)
        
        return swap_tx_hash
    
    except Exception as e:
        raise Exception(f"Error buying token: {str(e)}")

def sell_token_for_eth(
    token_address, 
    amount_tokens, 
    wallet_address, 
    private_key, 
    slippage=5.0, 
    router_address=None,
    deadline_minutes=20
):
    """
    Sell a token for ETH
    
    Args:
        token_address: Address of the token to sell
        amount_tokens: Amount of tokens to sell
        wallet_address: Address of the seller's wallet
        private_key: Private key of the seller's wallet
        slippage: Maximum slippage percentage (default: 5.0%)
        router_address: Address of the DEX router to use
        deadline_minutes: Transaction deadline in minutes
        
    Returns:
        Transaction hash
    """
    try:
        # Validate inputs
        if not w3.is_address(token_address):
            raise ValueError("Invalid token address")
        
        if not w3.is_address(wallet_address):
            raise ValueError("Invalid wallet address")
        
        if amount_tokens <= 0:
            raise ValueError("Amount must be greater than 0")
        
        # Use default router if not specified
        if not router_address:
            from config import BASESWAP_ROUTER
            router_address = BASESWAP_ROUTER
        
        # Create router contract instance
        router_contract = w3.eth.contract(address=router_address, abi=ROUTER_ABI)
        
        # Create token contract instance
        from config import ERC20_ABI
        token_contract = w3.eth.contract(address=token_address, abi=ERC20_ABI)
        
        # Get token decimals
        decimals = token_contract.functions.decimals().call()
        
        # Convert token amount to wei equivalent
        amount_tokens_wei = int(amount_tokens * (10 ** decimals))
        
        # Check if the router is approved to spend tokens
        allowance = token_contract.functions.allowance(wallet_address, router_address).call()
        
        # If not approved, approve the router
        if allowance < amount_tokens_wei:
            approve_tx = token_contract.functions.approve(
                router_address,
                2**256 - 1  # Max approval (infinite)
            ).build_transaction({
                'from': wallet_address,
                'gas': 100000,
                'gasPrice': w3.eth.gas_price,
                'nonce': w3.eth.get_transaction_count(wallet_address)
            })
            
            # Sign and send approval transaction
            signed_approve_tx = sign_transaction(private_key, approve_tx)
            approve_tx_hash = send_raw_transaction(signed_approve_tx)
            
            # Wait for approval transaction to be mined
            # In a real implementation, you would use async/await or callbacks
            # For simplicity, we'll use a simple sleep
            time.sleep(15)  # Wait 15 seconds for the approval to be mined
        
        # Set transaction deadline
        deadline = int(time.time() + (deadline_minutes * 60))
        
        # Prepare the swap transaction
        swap_tx = router_contract.functions.swapExactTokensForETH(
            amount_tokens_wei,  # amountIn
            0,  # amountOutMin (0 for now, in production set this based on slippage)
            [token_address, WETH_ADDRESS],  # path
            wallet_address,  # to
            deadline  # deadline
        ).build_transaction({
            'from': wallet_address,
            'value': 0,
            'gas': 250000,  # Estimated gas limit
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(wallet_address)
        })
        
        # Sign and send the swap transaction
        signed_swap_tx = sign_transaction(private_key, swap_tx)
        swap_tx_hash = send_raw_transaction(signed_swap_tx)
        
        return swap_tx_hash
    
    except Exception as e:
        raise Exception(f"Error selling token: {str(e)}")

def approve_token(token_address, spender_address, wallet_address, private_key):
    """
    Approve a spender to spend tokens
    
    Args:
        token_address: Address of the token to approve
        spender_address: Address of the spender (usually a router)
        wallet_address: Address of the token owner's wallet
        private_key: Private key of the token owner's wallet
        
    Returns:
        Transaction hash
    """
    try:
        # Validate inputs
        if not w3.is_address(token_address):
            raise ValueError("Invalid token address")
        
        if not w3.is_address(spender_address):
            raise ValueError("Invalid spender address")
        
        if not w3.is_address(wallet_address):
            raise ValueError("Invalid wallet address")
        
        # Create token contract instance
        from config import ERC20_ABI
        token_contract = w3.eth.contract(address=token_address, abi=ERC20_ABI)
        
        # Prepare the approval transaction
        approve_tx = token_contract.functions.approve(
            spender_address,
            2**256 - 1  # Max approval (infinite)
        ).build_transaction({
            'from': wallet_address,
            'gas': 100000,
            'gasPrice': w3.eth.gas_price,
            'nonce': w3.eth.get_transaction_count(wallet_address)
        })
        
        # Sign and send the approval transaction
        signed_approve_tx = sign_transaction(private_key, approve_tx)
        approve_tx_hash = send_raw_transaction(signed_approve_tx)
        
        return approve_tx_hash
    
    except Exception as e:
        raise Exception(f"Error approving token: {str(e)}")

def check_token_allowance(token_address, owner_address, spender_address):
    """
    Check if a spender is approved to spend tokens
    
    Args:
        token_address: Address of the token
        owner_address: Address of the token owner
        spender_address: Address of the spender (usually a router)
        
    Returns:
        Allowance amount
    """
    try:
        # Validate inputs
        if not w3.is_address(token_address):
            raise ValueError("Invalid token address")
        
        if not w3.is_address(owner_address):
            raise ValueError("Invalid owner address")
        
        if not w3.is_address(spender_address):
            raise ValueError("Invalid spender address")
        
        # Create token contract instance
        from config import ERC20_ABI
        token_contract = w3.eth.contract(address=token_address, abi=ERC20_ABI)
        
        # Get allowance
        allowance = token_contract.functions.allowance(owner_address, spender_address).call()
        
        return allowance
    
    except Exception as e:
        raise Exception(f"Error checking allowance: {str(e)}") 