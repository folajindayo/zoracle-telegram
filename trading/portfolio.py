import os
import sys
import logging
from typing import Dict, List, Any, Optional

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.wallet import get_eth_balance, get_token_balance
from utils.tokens import get_token_info, get_token_price
from database import get_user_by_telegram_id, get_user_transactions

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

async def get_user_portfolio(telegram_id: str) -> Dict[str, Any]:
    """
    Get a user's portfolio including ETH and token balances
    
    Args:
        telegram_id: User's Telegram ID
        
    Returns:
        Dictionary containing portfolio information
    """
    # Get user from database
    user = get_user_by_telegram_id(telegram_id)
    if not user or not user.wallet_address:
        return {
            "error": "No wallet found",
            "message": "You don't have a wallet set up yet. Use /wallet to set one up."
        }
    
    wallet_address = user.wallet_address
    
    try:
        # Get ETH balance
        eth_balance = get_eth_balance(wallet_address)
        eth_price_usd = 2500  # Mock ETH price in USD (would fetch from API in production)
        eth_value_usd = eth_balance * eth_price_usd
        
        # Get user's transaction history to identify tokens they've interacted with
        transactions = get_user_transactions(telegram_id)
        
        # Extract unique token addresses from transactions
        token_addresses = set()
        for tx in transactions:
            if tx.token_address:
                token_addresses.add(tx.token_address)
        
        # Get token balances and info
        tokens = []
        total_value_usd = eth_value_usd
        
        for token_address in token_addresses:
            try:
                # Get token info
                token_info = get_token_info(token_address)
                
                # Get token balance
                balance = get_token_balance(token_address, wallet_address)
                
                if balance > 0:
                    # Get token price (mock implementation)
                    price_data = get_token_price(token_address)
                    price_eth = price_data["price_in_eth"]
                    price_usd = price_data["price_in_usd"]
                    
                    # Calculate value
                    value_eth = balance * price_eth
                    value_usd = balance * price_usd
                    
                    # Add to total value
                    total_value_usd += value_usd
                    
                    # Add token to list
                    tokens.append({
                        "address": token_address,
                        "name": token_info["name"],
                        "symbol": token_info["symbol"],
                        "balance": balance,
                        "price_eth": price_eth,
                        "price_usd": price_usd,
                        "value_eth": value_eth,
                        "value_usd": value_usd
                    })
            except Exception as e:
                logger.error(f"Error getting token info for {token_address}: {str(e)}")
        
        # Sort tokens by value (highest first)
        tokens.sort(key=lambda x: x["value_usd"], reverse=True)
        
        return {
            "wallet_address": wallet_address,
            "eth_balance": eth_balance,
            "eth_value_usd": eth_value_usd,
            "tokens": tokens,
            "total_value_usd": total_value_usd
        }
    
    except Exception as e:
        logger.error(f"Error getting portfolio: {str(e)}")
        return {
            "error": "Error getting portfolio",
            "message": f"An error occurred: {str(e)}"
        }

async def get_transaction_history(telegram_id: str, limit: int = 10) -> Dict[str, Any]:
    """
    Get a user's transaction history
    
    Args:
        telegram_id: User's Telegram ID
        limit: Maximum number of transactions to return
        
    Returns:
        Dictionary containing transaction history
    """
    # Get user from database
    user = get_user_by_telegram_id(telegram_id)
    if not user:
        return {
            "error": "User not found",
            "message": "User not found in database."
        }
    
    try:
        # Get user's transaction history
        transactions = get_user_transactions(telegram_id, limit)
        
        # Format transactions
        formatted_transactions = []
        for tx in transactions:
            formatted_tx = {
                "hash": tx.transaction_hash,
                "token_address": tx.token_address,
                "token_symbol": tx.token_symbol,
                "amount": tx.amount,
                "eth_amount": tx.eth_amount,
                "type": tx.transaction_type,
                "status": tx.status,
                "date": tx.created_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            formatted_transactions.append(formatted_tx)
        
        return {
            "transactions": formatted_transactions,
            "count": len(formatted_transactions)
        }
    
    except Exception as e:
        logger.error(f"Error getting transaction history: {str(e)}")
        return {
            "error": "Error getting transaction history",
            "message": f"An error occurred: {str(e)}"
        }

async def calculate_profit_loss(telegram_id: str) -> Dict[str, Any]:
    """
    Calculate profit/loss for a user's portfolio
    
    Args:
        telegram_id: User's Telegram ID
        
    Returns:
        Dictionary containing profit/loss information
    """
    # Get user from database
    user = get_user_by_telegram_id(telegram_id)
    if not user or not user.wallet_address:
        return {
            "error": "No wallet found",
            "message": "You don't have a wallet set up yet. Use /wallet to set one up."
        }
    
    wallet_address = user.wallet_address
    
    try:
        # Get user's transaction history
        transactions = get_user_transactions(telegram_id)
        
        # Group transactions by token
        token_transactions = {}
        for tx in transactions:
            if tx.token_address not in token_transactions:
                token_transactions[tx.token_address] = []
            token_transactions[tx.token_address].append(tx)
        
        # Calculate P&L for each token
        token_pnl = []
        for token_address, txs in token_transactions.items():
            try:
                # Get token info
                token_info = get_token_info(token_address)
                
                # Calculate cost basis
                cost_basis = 0
                tokens_acquired = 0
                
                for tx in txs:
                    if tx.transaction_type == 'buy':
                        cost_basis += tx.eth_amount
                        tokens_acquired += tx.amount
                    elif tx.transaction_type == 'sell':
                        cost_basis -= (tx.eth_amount / tx.amount) * tokens_acquired if tx.amount > 0 else 0
                        tokens_acquired -= tx.amount
                
                # Get current balance and value
                balance = get_token_balance(token_address, wallet_address)
                price_data = get_token_price(token_address)
                current_value_eth = balance * price_data["price_in_eth"]
                
                # Calculate P&L
                if tokens_acquired > 0:
                    avg_cost_per_token = cost_basis / tokens_acquired
                    current_price = price_data["price_in_eth"]
                    unrealized_pnl = balance * (current_price - avg_cost_per_token)
                    unrealized_pnl_percent = ((current_price / avg_cost_per_token) - 1) * 100 if avg_cost_per_token > 0 else 0
                else:
                    unrealized_pnl = 0
                    unrealized_pnl_percent = 0
                
                token_pnl.append({
                    "address": token_address,
                    "name": token_info["name"],
                    "symbol": token_info["symbol"],
                    "balance": balance,
                    "cost_basis": cost_basis,
                    "current_value_eth": current_value_eth,
                    "unrealized_pnl_eth": unrealized_pnl,
                    "unrealized_pnl_percent": unrealized_pnl_percent
                })
            except Exception as e:
                logger.error(f"Error calculating P&L for {token_address}: {str(e)}")
        
        # Sort by unrealized P&L (highest first)
        token_pnl.sort(key=lambda x: x["unrealized_pnl_eth"], reverse=True)
        
        # Calculate total P&L
        total_cost_basis = sum(token["cost_basis"] for token in token_pnl)
        total_current_value = sum(token["current_value_eth"] for token in token_pnl)
        total_unrealized_pnl = sum(token["unrealized_pnl_eth"] for token in token_pnl)
        total_unrealized_pnl_percent = ((total_current_value / total_cost_basis) - 1) * 100 if total_cost_basis > 0 else 0
        
        return {
            "token_pnl": token_pnl,
            "total_cost_basis": total_cost_basis,
            "total_current_value": total_current_value,
            "total_unrealized_pnl": total_unrealized_pnl,
            "total_unrealized_pnl_percent": total_unrealized_pnl_percent
        }
    
    except Exception as e:
        logger.error(f"Error calculating profit/loss: {str(e)}")
        return {
            "error": "Error calculating profit/loss",
            "message": f"An error occurred: {str(e)}"
        } 