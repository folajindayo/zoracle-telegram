import os
import sys
import logging
import asyncio
from typing import Dict, List, Any, Optional
import time

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import (
    get_user_by_telegram_id, get_user_watchlists, 
    get_watchlist_tokens, add_token_to_watchlist
)
from utils.tokens import get_token_info, get_token_price, get_token_liquidity

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# In-memory store for price alerts
# In a production environment, this would be backed by a database
price_alerts = {}  # token_address -> [{ telegram_id, price_high, price_low }]

# In-memory store for token prices and liquidity
# Used to detect changes without querying the blockchain every time
token_data = {}  # token_address -> { price_eth, price_usd, eth_liquidity, token_liquidity }

async def add_price_alert(telegram_id: str, token_address: str, price_high: Optional[float] = None, 
                         price_low: Optional[float] = None, watchlist_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Add a price alert for a token
    
    Args:
        telegram_id: User's Telegram ID
        token_address: Token address
        price_high: High price threshold (in ETH)
        price_low: Low price threshold (in ETH)
        watchlist_name: Name of the watchlist to add the token to
        
    Returns:
        Dictionary containing setup result
    """
    try:
        # Get user from database
        user = get_user_by_telegram_id(telegram_id)
        if not user:
            return {
                "error": "User not found",
                "message": "User not found in database."
            }
        
        # Get token info
        token_info = get_token_info(token_address)
        
        # Add to watchlist if specified
        watchlist_token = None
        if watchlist_name:
            # Get user's watchlists
            watchlists = get_user_watchlists(telegram_id)
            
            # Find the specified watchlist
            watchlist = None
            for wl in watchlists:
                if wl.name.lower() == watchlist_name.lower():
                    watchlist = wl
                    break
            
            if not watchlist:
                return {
                    "error": "Watchlist not found",
                    "message": f"Watchlist '{watchlist_name}' not found."
                }
            
            # Add token to watchlist
            watchlist_token = add_token_to_watchlist(
                watchlist_id=watchlist.id,
                token_address=token_address,
                token_symbol=token_info["symbol"],
                alert_price_high=price_high,
                alert_price_low=price_low
            )
        
        # Add to in-memory price alerts
        if token_address not in price_alerts:
            price_alerts[token_address] = []
        
        # Check if alert already exists
        for alert in price_alerts[token_address]:
            if alert["telegram_id"] == telegram_id:
                # Update existing alert
                alert["price_high"] = price_high
                alert["price_low"] = price_low
                
                return {
                    "success": True,
                    "token_address": token_address,
                    "token_name": token_info["name"],
                    "token_symbol": token_info["symbol"],
                    "price_high": price_high,
                    "price_low": price_low,
                    "watchlist_name": watchlist_name,
                    "message": "Price alert updated successfully!"
                }
        
        # Add new alert
        price_alerts[token_address].append({
            "telegram_id": telegram_id,
            "price_high": price_high,
            "price_low": price_low
        })
        
        # Get current token price and store it
        if token_address not in token_data:
            price_data = get_token_price(token_address)
            liquidity_data = get_token_liquidity(token_address)
            
            token_data[token_address] = {
                "price_eth": price_data["price_in_eth"],
                "price_usd": price_data["price_in_usd"],
                "eth_liquidity": liquidity_data["eth_liquidity"],
                "token_liquidity": liquidity_data["token_liquidity"]
            }
        
        return {
            "success": True,
            "token_address": token_address,
            "token_name": token_info["name"],
            "token_symbol": token_info["symbol"],
            "price_high": price_high,
            "price_low": price_low,
            "watchlist_name": watchlist_name,
            "message": "Price alert added successfully!"
        }
    
    except Exception as e:
        logger.error(f"Error adding price alert: {str(e)}")
        return {
            "error": "Error adding price alert",
            "message": f"An error occurred: {str(e)}"
        }

async def remove_price_alert(telegram_id: str, token_address: str) -> Dict[str, Any]:
    """
    Remove a price alert for a token
    
    Args:
        telegram_id: User's Telegram ID
        token_address: Token address
        
    Returns:
        Dictionary containing result
    """
    try:
        # Check if token has any alerts
        if token_address not in price_alerts:
            return {
                "error": "Alert not found",
                "message": "No alerts found for this token."
            }
        
        # Find and remove the alert
        for i, alert in enumerate(price_alerts[token_address]):
            if alert["telegram_id"] == telegram_id:
                price_alerts[token_address].pop(i)
                
                # Remove token from price_alerts if no alerts left
                if not price_alerts[token_address]:
                    del price_alerts[token_address]
                
                return {
                    "success": True,
                    "token_address": token_address,
                    "message": "Price alert removed successfully!"
                }
        
        return {
            "error": "Alert not found",
            "message": "You don't have an alert set for this token."
        }
    
    except Exception as e:
        logger.error(f"Error removing price alert: {str(e)}")
        return {
            "error": "Error removing price alert",
            "message": f"An error occurred: {str(e)}"
        }

async def get_user_alerts(telegram_id: str) -> Dict[str, Any]:
    """
    Get all price alerts for a user
    
    Args:
        telegram_id: User's Telegram ID
        
    Returns:
        Dictionary containing alerts
    """
    try:
        # Get user from database
        user = get_user_by_telegram_id(telegram_id)
        if not user:
            return {
                "error": "User not found",
                "message": "User not found in database."
            }
        
        # Find all alerts for the user
        user_alerts = []
        for token_address, alerts in price_alerts.items():
            for alert in alerts:
                if alert["telegram_id"] == telegram_id:
                    try:
                        # Get token info
                        token_info = get_token_info(token_address)
                        
                        # Add to user alerts
                        user_alerts.append({
                            "token_address": token_address,
                            "token_name": token_info["name"],
                            "token_symbol": token_info["symbol"],
                            "price_high": alert["price_high"],
                            "price_low": alert["price_low"],
                            "current_price": token_data.get(token_address, {}).get("price_eth", 0)
                        })
                    except Exception as e:
                        logger.error(f"Error getting token info for {token_address}: {str(e)}")
        
        return {
            "alerts": user_alerts,
            "count": len(user_alerts)
        }
    
    except Exception as e:
        logger.error(f"Error getting user alerts: {str(e)}")
        return {
            "error": "Error getting user alerts",
            "message": f"An error occurred: {str(e)}"
        }

async def check_price_alerts() -> List[Dict[str, Any]]:
    """
    Check all price alerts and return triggered alerts
    
    Returns:
        List of triggered alerts
    """
    triggered_alerts = []
    
    try:
        # Check each token with alerts
        for token_address, alerts in price_alerts.items():
            try:
                # Get current token price
                price_data = get_token_price(token_address)
                current_price = price_data["price_in_eth"]
                
                # Get previous price
                previous_price = token_data.get(token_address, {}).get("price_eth", current_price)
                
                # Update token data
                if token_address not in token_data:
                    token_data[token_address] = {}
                
                token_data[token_address]["price_eth"] = current_price
                token_data[token_address]["price_usd"] = price_data["price_in_usd"]
                
                # Check each alert
                for alert in alerts:
                    price_high = alert["price_high"]
                    price_low = alert["price_low"]
                    telegram_id = alert["telegram_id"]
                    
                    # Check if price crossed high threshold
                    if price_high and previous_price < price_high and current_price >= price_high:
                        # Get token info
                        token_info = get_token_info(token_address)
                        
                        # Add to triggered alerts
                        triggered_alerts.append({
                            "type": "price_high",
                            "telegram_id": telegram_id,
                            "token_address": token_address,
                            "token_name": token_info["name"],
                            "token_symbol": token_info["symbol"],
                            "threshold": price_high,
                            "current_price": current_price,
                            "message": f"🚨 Price Alert: {token_info['symbol']} has reached your high price alert of {price_high} ETH. Current price: {current_price} ETH."
                        })
                    
                    # Check if price crossed low threshold
                    if price_low and previous_price > price_low and current_price <= price_low:
                        # Get token info
                        token_info = get_token_info(token_address)
                        
                        # Add to triggered alerts
                        triggered_alerts.append({
                            "type": "price_low",
                            "telegram_id": telegram_id,
                            "token_address": token_address,
                            "token_name": token_info["name"],
                            "token_symbol": token_info["symbol"],
                            "threshold": price_low,
                            "current_price": current_price,
                            "message": f"🚨 Price Alert: {token_info['symbol']} has reached your low price alert of {price_low} ETH. Current price: {current_price} ETH."
                        })
            
            except Exception as e:
                logger.error(f"Error checking price alerts for {token_address}: {str(e)}")
    
    except Exception as e:
        logger.error(f"Error checking price alerts: {str(e)}")
    
    return triggered_alerts

async def check_liquidity_changes() -> List[Dict[str, Any]]:
    """
    Check for significant liquidity changes and return alerts
    
    Returns:
        List of liquidity change alerts
    """
    liquidity_alerts = []
    
    try:
        # Check each token with data
        for token_address, data in token_data.items():
            try:
                # Get current liquidity
                liquidity_data = get_token_liquidity(token_address)
                current_eth_liquidity = liquidity_data["eth_liquidity"]
                
                # Get previous liquidity
                previous_eth_liquidity = data.get("eth_liquidity", current_eth_liquidity)
                
                # Update token data
                data["eth_liquidity"] = current_eth_liquidity
                data["token_liquidity"] = liquidity_data["token_liquidity"]
                
                # Calculate change percentage
                if previous_eth_liquidity > 0:
                    change_percent = ((current_eth_liquidity / previous_eth_liquidity) - 1) * 100
                else:
                    change_percent = 0
                
                # Check if change is significant (more than 20%)
                if abs(change_percent) >= 20:
                    # Get token info
                    token_info = get_token_info(token_address)
                    
                    # Get users with alerts for this token
                    users = set()
                    if token_address in price_alerts:
                        for alert in price_alerts[token_address]:
                            users.add(alert["telegram_id"])
                    
                    # Create alert for each user
                    for telegram_id in users:
                        direction = "increased" if change_percent > 0 else "decreased"
                        
                        liquidity_alerts.append({
                            "type": "liquidity_change",
                            "telegram_id": telegram_id,
                            "token_address": token_address,
                            "token_name": token_info["name"],
                            "token_symbol": token_info["symbol"],
                            "previous_liquidity": previous_eth_liquidity,
                            "current_liquidity": current_eth_liquidity,
                            "change_percent": change_percent,
                            "message": f"💦 Liquidity Alert: {token_info['symbol']} liquidity has {direction} by {abs(change_percent):.2f}%. Current liquidity: {current_eth_liquidity} ETH."
                        })
            
            except Exception as e:
                logger.error(f"Error checking liquidity for {token_address}: {str(e)}")
    
    except Exception as e:
        logger.error(f"Error checking liquidity changes: {str(e)}")
    
    return liquidity_alerts

async def start_alert_monitoring(bot=None) -> None:
    """
    Start monitoring for price and liquidity alerts
    
    Args:
        bot: Telegram bot instance for sending notifications
    """
    logger.info("Starting alert monitoring")
    
    while True:
        try:
            # Check price alerts
            triggered_price_alerts = await check_price_alerts()
            
            # Check liquidity changes
            liquidity_alerts = await check_liquidity_changes()
            
            # Combine alerts
            all_alerts = triggered_price_alerts + liquidity_alerts
            
            # Send notifications
            if bot and all_alerts:
                for alert in all_alerts:
                    try:
                        telegram_id = alert["telegram_id"]
                        message = alert["message"]
                        
                        # In a real implementation, you would send a message to the user
                        logger.info(f"Would send alert to {telegram_id}: {message}")
                        
                        # If bot is provided, send the message
                        # await bot.send_message(chat_id=telegram_id, text=message)
                    
                    except Exception as e:
                        logger.error(f"Error sending alert notification: {str(e)}")
            
            # Sleep for a bit
            await asyncio.sleep(60)  # Check every minute
        
        except Exception as e:
            logger.error(f"Error in alert monitoring loop: {str(e)}")
            await asyncio.sleep(120)  # Sleep a bit longer on error 