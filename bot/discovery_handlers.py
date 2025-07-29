import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler, ConversationHandler, MessageHandler, filters

from trading.discovery import discover_new_tokens, discover_trending_tokens, search_for_tokens, get_token_details

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Conversation states
SEARCH_QUERY = 0

async def new_tokens_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /new command."""
    # Get limit from arguments if provided
    limit = 5
    if context.args and context.args[0].isdigit():
        limit = min(int(context.args[0]), 10)  # Max 10 tokens
    
    # Send a "loading" message
    message = await update.message.reply_text("🔍 Discovering new tokens...")
    
    # Get new tokens
    tokens = await discover_new_tokens(limit)
    
    if "error" in tokens:
        await message.edit_text(f"❌ {tokens['message']}")
        return
    
    # Format tokens message
    tokens_text = f"🆕 *New Zora Content Tokens*\n\n"
    
    if tokens['tokens']:
        for token in tokens['tokens']:
            tokens_text += f"• *{token['symbol']}* - {token['name']}\n"
            tokens_text += f"  Price: {token['price_eth']:.6f} ETH (${token['price_usd']:.2f})\n"
            tokens_text += f"  Liquidity: {token['eth_liquidity']:.2f} ETH\n"
            tokens_text += f"  Address: `{token['address']}`\n\n"
            
            # Add buy button
            context.user_data[f"token_{token['address']}"] = token
    else:
        tokens_text += "No new tokens found."
    
    # Create keyboard with buy buttons
    keyboard = []
    for token in tokens['tokens']:
        keyboard.append([
            InlineKeyboardButton(f"Buy {token['symbol']}", callback_data=f"buy_{token['address']}"),
            InlineKeyboardButton("Details", callback_data=f"details_{token['address']}")
        ])
    
    reply_markup = InlineKeyboardMarkup(keyboard) if keyboard else None
    
    # Edit the "loading" message with the tokens information
    await message.edit_text(tokens_text, parse_mode='Markdown', reply_markup=reply_markup)

async def trending_tokens_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /trending command."""
    # Get limit from arguments if provided
    limit = 5
    if context.args and context.args[0].isdigit():
        limit = min(int(context.args[0]), 10)  # Max 10 tokens
    
    # Send a "loading" message
    message = await update.message.reply_text("🔍 Discovering trending tokens...")
    
    # Get trending tokens
    tokens = await discover_trending_tokens(limit)
    
    if "error" in tokens:
        await message.edit_text(f"❌ {tokens['message']}")
        return
    
    # Format tokens message
    tokens_text = f"🔥 *Trending Zora Content Tokens*\n\n"
    
    if tokens['tokens']:
        for token in tokens['tokens']:
            tokens_text += f"• *{token['symbol']}* - {token['name']}\n"
            tokens_text += f"  Price: {token['price_eth']:.6f} ETH (${token['price_usd']:.2f})\n"
            tokens_text += f"  Volume Change: +{token['volume_change_24h']:.1f}% | Holders: +{token['holders_change_24h']:.1f}%\n"
            tokens_text += f"  Address: `{token['address']}`\n\n"
            
            # Add token to user data for buttons
            context.user_data[f"token_{token['address']}"] = token
    else:
        tokens_text += "No trending tokens found."
    
    # Create keyboard with buy buttons
    keyboard = []
    for token in tokens['tokens']:
        keyboard.append([
            InlineKeyboardButton(f"Buy {token['symbol']}", callback_data=f"buy_{token['address']}"),
            InlineKeyboardButton("Details", callback_data=f"details_{token['address']}")
        ])
    
    reply_markup = InlineKeyboardMarkup(keyboard) if keyboard else None
    
    # Edit the "loading" message with the tokens information
    await message.edit_text(tokens_text, parse_mode='Markdown', reply_markup=reply_markup)

async def search_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle the /search command."""
    # Check if query is provided in arguments
    if context.args:
        query = ' '.join(context.args)
        await do_search(update, context, query)
        return ConversationHandler.END
    
    # Ask for search query
    await update.message.reply_text(
        "🔍 What are you looking for? Enter a token name, symbol, or address:"
    )
    return SEARCH_QUERY

async def search_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle search query input."""
    query = update.message.text
    await do_search(update, context, query)
    return ConversationHandler.END

async def do_search(update: Update, context: ContextTypes.DEFAULT_TYPE, query: str) -> None:
    """Perform token search."""
    # Send a "loading" message
    message = await update.message.reply_text(f"🔍 Searching for '{query}'...")
    
    # Search for tokens
    results = await search_for_tokens(query)
    
    if "error" in results:
        await message.edit_text(f"❌ {results['message']}")
        return
    
    # Format results message
    results_text = f"🔍 *Search Results for '{query}'*\n\n"
    
    if results['tokens']:
        for token in results['tokens']:
            results_text += f"• *{token['symbol']}* - {token['name']}\n"
            results_text += f"  Price: {token['price_eth']:.6f} ETH (${token['price_usd']:.2f})\n"
            results_text += f"  Address: `{token['address']}`\n\n"
            
            # Add token to user data for buttons
            context.user_data[f"token_{token['address']}"] = token
    else:
        results_text += "No tokens found matching your query."
    
    # Create keyboard with buy buttons
    keyboard = []
    for token in results['tokens']:
        keyboard.append([
            InlineKeyboardButton(f"Buy {token['symbol']}", callback_data=f"buy_{token['address']}"),
            InlineKeyboardButton("Details", callback_data=f"details_{token['address']}")
        ])
    
    reply_markup = InlineKeyboardMarkup(keyboard) if keyboard else None
    
    # Edit the "loading" message with the search results
    await message.edit_text(results_text, parse_mode='Markdown', reply_markup=reply_markup)

async def token_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle token button presses."""
    query = update.callback_query
    await query.answer()
    
    # Get token address from callback data
    data = query.data
    
    if data.startswith("buy_"):
        token_address = data[4:]
        token = context.user_data.get(f"token_{token_address}")
        
        if not token:
            await query.edit_message_text(
                "❌ Token information not found. Please try again."
            )
            return
        
        # Redirect to buy command
        await query.edit_message_text(
            f"To buy {token['symbol']}, use the command:\n\n"
            f"`/buy {token_address} <amount_in_eth>`\n\n"
            f"Example: `/buy {token_address} 0.1`",
            parse_mode='Markdown'
        )
    
    elif data.startswith("details_"):
        token_address = data[8:]
        
        # Send a "loading" message
        await query.edit_message_text("🔍 Loading token details...")
        
        # Get token details
        details = await get_token_details(token_address)
        
        if "error" in details:
            await query.edit_message_text(f"❌ {details['message']}")
            return
        
        # Format details message
        details_text = f"📊 *Token Details*\n\n"
        details_text += f"*Name:* {details['name']}\n"
        details_text += f"*Symbol:* {details['symbol']}\n"
        details_text += f"*Address:* `{details['address']}`\n\n"
        details_text += f"*Price:* {details['price_eth']:.6f} ETH (${details['price_usd']:.2f})\n"
        details_text += f"*Liquidity:* {details['eth_liquidity']:.2f} ETH (${details['liquidity_usd']:.2f})\n"
        
        # Add buttons
        keyboard = [
            [InlineKeyboardButton(f"Buy {details['symbol']}", callback_data=f"buy_{token_address}")],
            [InlineKeyboardButton("View on BaseScan", url=f"https://basescan.org/token/{token_address}")]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        # Edit the message with the token details
        await query.edit_message_text(details_text, parse_mode='Markdown', reply_markup=reply_markup)

def register_discovery_handlers(application):
    """Register discovery handlers."""
    application.add_handler(CommandHandler("new", new_tokens_command))
    application.add_handler(CommandHandler("trending", trending_tokens_command))
    
    # Search conversation handler
    search_conv_handler = ConversationHandler(
        entry_points=[CommandHandler("search", search_command)],
        states={
            SEARCH_QUERY: [MessageHandler(filters.TEXT & ~filters.COMMAND, search_query)]
        },
        fallbacks=[CommandHandler("cancel", lambda u, c: ConversationHandler.END)]
    )
    application.add_handler(search_conv_handler)
    
    # Token button handler
    application.add_handler(CallbackQueryHandler(token_button, pattern=r"^(buy_|details_)"))
    
    return application
