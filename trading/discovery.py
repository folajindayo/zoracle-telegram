import os
import sys
import logging
from typing import Dict, List, Any, Optional
import time

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.tokens import get_zora_tokens, get_trending_tokens, search_tokens, get_token_info, get_token_price, get_token_liquidity

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

async def discover_new_tokens(limit: int = 10) -> Dict[str, Any]:
    """
    Discover new Zora content tokens
    
    Args:
        limit: Maximum number of tokens to return
        
    Returns:
        Dictionary containing new tokens
    """
    try:
        # Get new tokens (in a real implementation, this would filter by creation date)
        tokens = get_zora_tokens(limit=limit)
        
        # Enhance token data with price and liquidity info
        enhanced_tokens = []
        for token in tokens:
            try:
                # Get token price and liquidity
                price_data = get_token_price(token["address"])
                liquidity_data = get_token_liquidity(token["address"])
                
                # Add enhanced data
                enhanced_token = {
                    **token,
                    "price_eth": price_data["price_in_eth"],
                    "price_usd": price_data["price_in_usd"],
                    "eth_liquidity": liquidity_data["eth_liquidity"],
                    "token_liquidity": liquidity_data["token_liquidity"],
                    "liquidity_usd": liquidity_data["liquidity_usd"]
                }
                
                enhanced_tokens.append(enhanced_token)
            except Exception as e:
                logger.error(f"Error enhancing token data for {token['address']}: {str(e)}")
                # Still include the token, just without the enhanced data
                enhanced_tokens.append(token)
        
        return {
            "tokens": enhanced_tokens,
            "count": len(enhanced_tokens)
        }
    
    except Exception as e:
        logger.error(f"Error discovering new tokens: {str(e)}")
        return {
            "error": "Error discovering new tokens",
            "message": f"An error occurred: {str(e)}"
        }

async def discover_trending_tokens(limit: int = 10) -> Dict[str, Any]:
    """
    Discover trending Zora content tokens
    
    Args:
        limit: Maximum number of tokens to return
        
    Returns:
        Dictionary containing trending tokens
    """
    try:
        # Get trending tokens
        tokens = get_trending_tokens(limit=limit)
        
        # Enhance token data with price and liquidity info
        enhanced_tokens = []
        for token in tokens:
            try:
                # Get token price and liquidity
                price_data = get_token_price(token["address"])
                liquidity_data = get_token_liquidity(token["address"])
                
                # Add enhanced data
                enhanced_token = {
                    **token,
                    "price_eth": price_data["price_in_eth"],
                    "price_usd": price_data["price_in_usd"],
                    "eth_liquidity": liquidity_data["eth_liquidity"],
                    "token_liquidity": liquidity_data["token_liquidity"],
                    "liquidity_usd": liquidity_data["liquidity_usd"]
                }
                
                enhanced_tokens.append(enhanced_token)
            except Exception as e:
                logger.error(f"Error enhancing token data for {token['address']}: {str(e)}")
                # Still include the token, just without the enhanced data
                enhanced_tokens.append(token)
        
        return {
            "tokens": enhanced_tokens,
            "count": len(enhanced_tokens)
        }
    
    except Exception as e:
        logger.error(f"Error discovering trending tokens: {str(e)}")
        return {
            "error": "Error discovering trending tokens",
            "message": f"An error occurred: {str(e)}"
        }

async def search_for_tokens(query: str) -> Dict[str, Any]:
    """
    Search for Zora content tokens
    
    Args:
        query: Search query (name, symbol, or address)
        
    Returns:
        Dictionary containing search results
    """
    try:
        # Search for tokens
        tokens = search_tokens(query)
        
        # Enhance token data with price and liquidity info
        enhanced_tokens = []
        for token in tokens:
            try:
                # Get token price and liquidity
                price_data = get_token_price(token["address"])
                liquidity_data = get_token_liquidity(token["address"])
                
                # Add enhanced data
                enhanced_token = {
                    **token,
                    "price_eth": price_data["price_in_eth"],
                    "price_usd": price_data["price_in_usd"],
                    "eth_liquidity": liquidity_data["eth_liquidity"],
                    "token_liquidity": liquidity_data["token_liquidity"],
                    "liquidity_usd": liquidity_data["liquidity_usd"]
                }
                
                enhanced_tokens.append(enhanced_token)
            except Exception as e:
                logger.error(f"Error enhancing token data for {token['address']}: {str(e)}")
                # Still include the token, just without the enhanced data
                enhanced_tokens.append(token)
        
        return {
            "query": query,
            "tokens": enhanced_tokens,
            "count": len(enhanced_tokens)
        }
    
    except Exception as e:
        logger.error(f"Error searching for tokens: {str(e)}")
        return {
            "error": "Error searching for tokens",
            "message": f"An error occurred: {str(e)}"
        }

async def get_token_details(token_address: str) -> Dict[str, Any]:
    """
    Get detailed information about a token
    
    Args:
        token_address: Token address
        
    Returns:
        Dictionary containing token details
    """
    try:
        # Get token info
        token_info = get_token_info(token_address)
        
        # Get token price and liquidity
        price_data = get_token_price(token_address)
        liquidity_data = get_token_liquidity(token_address)
        
        # Combine all data
        token_details = {
            **token_info,
            "price_eth": price_data["price_in_eth"],
            "price_usd": price_data["price_in_usd"],
            "eth_liquidity": liquidity_data["eth_liquidity"],
            "token_liquidity": liquidity_data["token_liquidity"],
            "liquidity_usd": liquidity_data["liquidity_usd"]
        }
        
        # In a real implementation, you would also fetch:
        # - Creator information
        # - Historical price data
        # - Trading volume
        # - Number of holders
        # - Social metrics
        
        return token_details
    
    except Exception as e:
        logger.error(f"Error getting token details: {str(e)}")
        return {
            "error": "Error getting token details",
            "message": f"An error occurred: {str(e)}"
        } 