import os
import sys
import logging
import asyncio
from typing import Dict, List, Any, Optional
import time

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import WETH_ADDRESS
from database import (
    get_user_by_telegram_id, create_copy_trade_config, 
    update_copy_trade_config, get_user_copy_trade_configs
)
from utils.wallet import decrypt_private_key
from trading.swap import buy_token_with_eth, sell_token_for_eth
from web3_module.web3_client import web3_client

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# In-memory store for monitored wallets and their transactions
# In a production environment, this would be backed by a database
monitored_wallets = {}
processed_transactions = set()

async def setup_copy_trading(telegram_id: str, target_wallet: str, slippage_guard: float = 5.0, 
                            max_eth_per_trade: float = 0.1, sandbox_mode: bool = True) -> Dict[str, Any]:
    """
    Set up copy trading for a user
    
    Args:
        telegram_id: User's Telegram ID
        target_wallet: Address of the wallet to copy trades from
        slippage_guard: Maximum allowed slippage percentage
        max_eth_per_trade: Maximum ETH amount per trade
        sandbox_mode: Whether to run in sandbox mode (no real trades)
        
    Returns:
        Dictionary containing setup result
    """
    try:
        # Validate target wallet address
        if not web3_client.is_address(target_wallet):
            return {
                "error": "Invalid wallet address",
                "message": "The provided wallet address is not valid."
            }
        
        # Get user from database
        user = get_user_by_telegram_id(telegram_id)
        if not user or not user.wallet_address:
            return {
                "error": "No wallet found",
                "message": "You don't have a wallet set up yet. Use /wallet to set one up."
            }
        
        # Create copy trade config
        config = create_copy_trade_config(
            telegram_id=telegram_id,
            target_wallet=target_wallet,
            slippage_guard=slippage_guard,
            active=True,
            sandbox_mode=sandbox_mode,
            max_eth_per_trade=max_eth_per_trade
        )
        
        # Add to monitored wallets
        if target_wallet not in monitored_wallets:
            monitored_wallets[target_wallet] = []
        
        monitored_wallets[target_wallet].append({
            "telegram_id": telegram_id,
            "config_id": config.id,
            "slippage_guard": slippage_guard,
            "max_eth_per_trade": max_eth_per_trade,
            "sandbox_mode": sandbox_mode
        })
        
        return {
            "success": True,
            "config_id": config.id,
            "target_wallet": target_wallet,
            "slippage_guard": slippage_guard,
            "max_eth_per_trade": max_eth_per_trade,
            "sandbox_mode": sandbox_mode,
            "message": "Copy trading set up successfully!"
        }
    
    except Exception as e:
        logger.error(f"Error setting up copy trading: {str(e)}")
        return {
            "error": "Error setting up copy trading",
            "message": f"An error occurred: {str(e)}"
        }

async def update_copy_trading(telegram_id: str, config_id: int, active: Optional[bool] = None,
                             slippage_guard: Optional[float] = None, sandbox_mode: Optional[bool] = None,
                             max_eth_per_trade: Optional[float] = None) -> Dict[str, Any]:
    """
    Update copy trading configuration
    
    Args:
        telegram_id: User's Telegram ID
        config_id: ID of the copy trade configuration
        active: Whether the configuration is active
        slippage_guard: Maximum allowed slippage percentage
        sandbox_mode: Whether to run in sandbox mode (no real trades)
        max_eth_per_trade: Maximum ETH amount per trade
        
    Returns:
        Dictionary containing update result
    """
    try:
        # Get user from database
        user = get_user_by_telegram_id(telegram_id)
        if not user:
            return {
                "error": "User not found",
                "message": "User not found in database."
            }
        
        # Update copy trade config
        config = update_copy_trade_config(
            config_id=config_id,
            active=active,
            slippage_guard=slippage_guard,
            sandbox_mode=sandbox_mode,
            max_eth_per_trade=max_eth_per_trade
        )
        
        if not config:
            return {
                "error": "Configuration not found",
                "message": "The specified copy trade configuration was not found."
            }
        
        # Update monitored wallets
        for wallet, configs in monitored_wallets.items():
            for i, cfg in enumerate(configs):
                if cfg["config_id"] == config_id:
                    if active is not None:
                        if not active:
                            # Remove from monitored wallets if deactivated
                            monitored_wallets[wallet].pop(i)
                            if not monitored_wallets[wallet]:
                                del monitored_wallets[wallet]
                        else:
                            cfg["active"] = active
                    
                    if slippage_guard is not None:
                        cfg["slippage_guard"] = slippage_guard
                    
                    if sandbox_mode is not None:
                        cfg["sandbox_mode"] = sandbox_mode
                    
                    if max_eth_per_trade is not None:
                        cfg["max_eth_per_trade"] = max_eth_per_trade
                    
                    break
        
        return {
            "success": True,
            "config_id": config_id,
            "active": active if active is not None else config.active,
            "slippage_guard": slippage_guard if slippage_guard is not None else config.slippage_guard,
            "sandbox_mode": sandbox_mode if sandbox_mode is not None else config.sandbox_mode,
            "max_eth_per_trade": max_eth_per_trade if max_eth_per_trade is not None else config.max_eth_per_trade,
            "message": "Copy trading configuration updated successfully!"
        }
    
    except Exception as e:
        logger.error(f"Error updating copy trading: {str(e)}")
        return {
            "error": "Error updating copy trading",
            "message": f"An error occurred: {str(e)}"
        }

async def get_copy_trading_configs(telegram_id: str) -> Dict[str, Any]:
    """
    Get copy trading configurations for a user
    
    Args:
        telegram_id: User's Telegram ID
        
    Returns:
        Dictionary containing copy trading configurations
    """
    try:
        # Get user from database
        user = get_user_by_telegram_id(telegram_id)
        if not user:
            return {
                "error": "User not found",
                "message": "User not found in database."
            }
        
        # Get copy trade configs
        configs = get_user_copy_trade_configs(telegram_id)
        
        # Format configs
        formatted_configs = []
        for config in configs:
            formatted_config = {
                "id": config.id,
                "target_wallet": config.target_wallet,
                "slippage_guard": config.slippage_guard,
                "active": config.active,
                "sandbox_mode": config.sandbox_mode,
                "max_eth_per_trade": config.max_eth_per_trade,
                "created_at": config.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": config.updated_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            formatted_configs.append(formatted_config)
        
        return {
            "configs": formatted_configs,
            "count": len(formatted_configs)
        }
    
    except Exception as e:
        logger.error(f"Error getting copy trading configs: {str(e)}")
        return {
            "error": "Error getting copy trading configs",
            "message": f"An error occurred: {str(e)}"
        }

async def process_transaction(transaction: Dict[str, Any]) -> None:
    """
    Process a transaction for copy trading
    
    Args:
        transaction: Transaction data
    """
    try:
        # Check if transaction is already processed
        tx_hash = transaction["hash"]
        if tx_hash in processed_transactions:
            return
        
        # Add to processed transactions
        processed_transactions.add(tx_hash)
        
        # Get transaction details
        from_address = transaction["from"]
        to_address = transaction["to"]
        value = transaction["value"]
        
        # Check if this is a transaction from a monitored wallet
        if from_address in monitored_wallets:
            # This is a transaction from a monitored wallet
            logger.info(f"Detected transaction from monitored wallet: {from_address}")
            
            # Get the users who are copying this wallet
            copying_users = monitored_wallets[from_address]
            
            # Process the transaction for each user
            for user_config in copying_users:
                telegram_id = user_config["telegram_id"]
                slippage_guard = user_config["slippage_guard"]
                max_eth_per_trade = user_config["max_eth_per_trade"]
                sandbox_mode = user_config["sandbox_mode"]
                
                # Get user from database
                user = get_user_by_telegram_id(telegram_id)
                if not user or not user.wallet_address or not user.encrypted_private_key:
                    logger.warning(f"User {telegram_id} has no wallet or private key")
                    continue
                
                # In a real implementation, you would:
                # 1. Detect if this is a buy or sell transaction
                # 2. Identify the token being bought or sold
                # 3. Calculate the amount to buy or sell based on the user's settings
                # 4. Execute the trade
                
                # For now, we'll just log the transaction
                logger.info(f"Would copy trade for user {telegram_id}: {tx_hash}")
                
                if not sandbox_mode:
                    logger.info(f"Real trading not implemented yet")
                
        # In a real implementation, you would also monitor DEX router contracts
        # to detect swaps and copy them
    
    except Exception as e:
        logger.error(f"Error processing transaction: {str(e)}")

async def start_monitoring() -> None:
    """
    Start monitoring for transactions to copy
    """
    logger.info("Starting copy trade monitoring")
    
    # In a real implementation, you would:
    # 1. Subscribe to new blocks using web3.eth.filter('latest')
    # 2. For each new block, get all transactions
    # 3. Filter transactions from monitored wallets
    # 4. Process those transactions for copy trading
    
    # For now, we'll just simulate monitoring with a simple loop
    while True:
        try:
            # Get latest block number
            latest_block = web3_client.w3.eth.block_number
            logger.debug(f"Latest block: {latest_block}")
            
            # In a real implementation, you would process transactions here
            
            # Sleep for a bit
            await asyncio.sleep(5)
        
        except Exception as e:
            logger.error(f"Error in monitoring loop: {str(e)}")
            await asyncio.sleep(10)  # Sleep a bit longer on error 