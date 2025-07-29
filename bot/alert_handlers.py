import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler, ConversationHandler, MessageHandler, filters

from trading.alerts import add_price_alert, remove_price_alert, get_user_alerts
from database import get_user_watchlists, create_watchlist

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Conversation states
TOKEN_ADDRESS, PRICE_HIGH, PRICE_LOW, WATCHLIST_NAME, CONFIRM_ALERT = range(5)

async def alerts_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /alerts command."""
    user = update.effective_user
    
    # Send a "loading" message
    message = await update.message.reply_text("🔔 Loading your alerts...")
    
    # Get user's alerts
    alerts = await get_user_alerts(str(user.id))
    
    if "error" in alerts:
        await message.edit_text(f"❌ {alerts['message']}")
        return
    
    # Format alerts message
    alerts_text = f"🔔 *Your Price Alerts*\n\n"
    
    if alerts['alerts']:
        for alert in alerts['alerts']:
            alerts_text += f"• *{alert['token_symbol']}* - {alert['token_name']}\n"
            
            if alert['price_high']:
                alerts_text += f"  High: {alert['price_high']:.6f} ETH"
                if alert['current_price']:
                    alerts_text += f" (Current: {alert['current_price']:.6f} ETH)\n"
                else:
                    alerts_text += "\n"
            
            if alert['price_low']:
                alerts_text += f"  Low: {alert['price_low']:.6f} ETH"
                if alert['current_price']:
                    alerts_text += f" (Current: {alert['current_price']:.6f} ETH)\n"
                else:
                    alerts_text += "\n"
            
            alerts_text += f"  Address: `{alert['token_address']}`\n\n"
            
            # Store token address in context
            context.user_data[f"alert_token_{alert['token_address']}"] = alert
    else:
        alerts_text += "You don't have any price alerts set up yet.\n\nUse /addalert to add a new alert."
    
    # Create keyboard with remove buttons
    keyboard = []
    if alerts['alerts']:
        for alert in alerts['alerts']:
            keyboard.append([
                InlineKeyboardButton(
                    f"Remove {alert['token_symbol']} Alert", 
                    callback_data=f"remove_alert_{alert['token_address']}"
                )
            ])
    
    keyboard.append([InlineKeyboardButton("Add New Alert", callback_data="add_alert")])
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Edit the "loading" message with the alerts information
    await message.edit_text(alerts_text, parse_mode='Markdown', reply_markup=reply_markup)

async def add_alert_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle the /addalert command."""
    # Check if token address is provided in arguments
    if context.args:
        context.user_data['alert_token_address'] = context.args[0]
        await update.message.reply_text(
            f"Setting up alert for token address: `{context.args[0]}`\n\n"
            f"Please enter the high price threshold in ETH (or 'skip' to skip):",
            parse_mode='Markdown'
        )
        return PRICE_HIGH
    
    # Ask for token address
    await update.message.reply_text(
        "Please enter the token address you want to set an alert for:"
    )
    return TOKEN_ADDRESS

async def token_address_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle token address input."""
    token_address = update.message.text
    
    # Validate token address (simple validation)
    if not token_address.startswith("0x") or len(token_address) != 42:
        await update.message.reply_text(
            "❌ Invalid token address. Please enter a valid Ethereum address:"
        )
        return TOKEN_ADDRESS
    
    # Store token address
    context.user_data['alert_token_address'] = token_address
    
    # Ask for high price threshold
    await update.message.reply_text(
        "Please enter the high price threshold in ETH (or 'skip' to skip):"
    )
    return PRICE_HIGH

async def price_high_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle high price threshold input."""
    price_high = update.message.text.lower()
    
    if price_high == "skip":
        context.user_data['alert_price_high'] = None
    else:
        try:
            price_high = float(price_high)
            if price_high <= 0:
                raise ValueError("Price must be greater than 0")
            
            context.user_data['alert_price_high'] = price_high
        except ValueError:
            await update.message.reply_text(
                "❌ Invalid price. Please enter a valid number or 'skip':"
            )
            return PRICE_HIGH
    
    # Ask for low price threshold
    await update.message.reply_text(
        "Please enter the low price threshold in ETH (or 'skip' to skip):"
    )
    return PRICE_LOW

async def price_low_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle low price threshold input."""
    price_low = update.message.text.lower()
    
    if price_low == "skip":
        context.user_data['alert_price_low'] = None
    else:
        try:
            price_low = float(price_low)
            if price_low <= 0:
                raise ValueError("Price must be greater than 0")
            
            context.user_data['alert_price_low'] = price_low
        except ValueError:
            await update.message.reply_text(
                "❌ Invalid price. Please enter a valid number or 'skip':"
            )
            return PRICE_LOW
    
    # Check if at least one threshold is set
    if context.user_data['alert_price_high'] is None and context.user_data['alert_price_low'] is None:
        await update.message.reply_text(
            "❌ You must set at least one price threshold. Please enter the high price threshold:"
        )
        return PRICE_HIGH
    
    # Get user's watchlists
    user = update.effective_user
    watchlists = get_user_watchlists(str(user.id))
    
    if watchlists:
        # Ask if user wants to add to watchlist
        watchlist_text = "Do you want to add this token to a watchlist? Choose one or type a new watchlist name:\n\n"
        
        keyboard = []
        for watchlist in watchlists:
            keyboard.append([InlineKeyboardButton(watchlist.name, callback_data=f"watchlist_{watchlist.name}")])
        
        keyboard.append([InlineKeyboardButton("No Watchlist", callback_data="watchlist_none")])
        keyboard.append([InlineKeyboardButton("Create New Watchlist", callback_data="watchlist_new")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(watchlist_text, reply_markup=reply_markup)
        return WATCHLIST_NAME
    else:
        # No watchlists, ask if user wants to create one
        keyboard = [
            [InlineKeyboardButton("Yes, create watchlist", callback_data="watchlist_new")],
            [InlineKeyboardButton("No, skip watchlist", callback_data="watchlist_none")]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "You don't have any watchlists yet. Would you like to create one?",
            reply_markup=reply_markup
        )
        return WATCHLIST_NAME

async def watchlist_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle watchlist button presses."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data == "watchlist_none":
        # Skip watchlist
        context.user_data['alert_watchlist'] = None
        return await confirm_alert(update, context)
    
    elif data == "watchlist_new":
        # Ask for new watchlist name
        await query.edit_message_text(
            "Please enter a name for your new watchlist:"
        )
        return WATCHLIST_NAME
    
    elif data.startswith("watchlist_"):
        # Use existing watchlist
        watchlist_name = data[10:]
        context.user_data['alert_watchlist'] = watchlist_name
        return await confirm_alert(update, context)

async def watchlist_name_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle watchlist name input."""
    watchlist_name = update.message.text
    
    # Create new watchlist
    user = update.effective_user
    create_watchlist(str(user.id), watchlist_name)
    
    # Store watchlist name
    context.user_data['alert_watchlist'] = watchlist_name
    
    return await confirm_alert(update, context)

async def confirm_alert(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Confirm and create the alert."""
    # Get alert details
    token_address = context.user_data['alert_token_address']
    price_high = context.user_data['alert_price_high']
    price_low = context.user_data['alert_price_low']
    watchlist_name = context.user_data.get('alert_watchlist')
    
    # Create message
    if isinstance(update.callback_query, object):
        # If called from a button callback
        message_func = update.callback_query.edit_message_text
    else:
        # If called from a text message
        message_func = update.message.reply_text
    
    # Create the alert
    user = update.effective_user
    result = await add_price_alert(
        str(user.id),
        token_address,
        price_high,
        price_low,
        watchlist_name
    )
    
    if "error" in result:
        await message_func(f"❌ {result['message']}")
    else:
        confirm_text = f"✅ Alert added successfully!\n\n"
        confirm_text += f"*Token:* {result['token_symbol']} ({result['token_name']})\n"
        
        if price_high:
            confirm_text += f"*High Price:* {price_high} ETH\n"
        
        if price_low:
            confirm_text += f"*Low Price:* {price_low} ETH\n"
        
        if watchlist_name:
            confirm_text += f"*Watchlist:* {watchlist_name}\n"
        
        await message_func(confirm_text, parse_mode='Markdown')
    
    # Clear user data
    if 'alert_token_address' in context.user_data:
        del context.user_data['alert_token_address']
    
    if 'alert_price_high' in context.user_data:
        del context.user_data['alert_price_high']
    
    if 'alert_price_low' in context.user_data:
        del context.user_data['alert_price_low']
    
    if 'alert_watchlist' in context.user_data:
        del context.user_data['alert_watchlist']
    
    return ConversationHandler.END

async def alert_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle alert button presses."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data == "add_alert":
        # Start add alert conversation
        await query.edit_message_text(
            "Please enter the token address you want to set an alert for:"
        )
        return TOKEN_ADDRESS
    
    elif data.startswith("remove_alert_"):
        # Remove alert
        token_address = data[13:]
        
        # Remove the alert
        user = update.effective_user
        result = await remove_price_alert(str(user.id), token_address)
        
        if "error" in result:
            await query.edit_message_text(f"❌ {result['message']}")
        else:
            await query.edit_message_text(f"✅ {result['message']}")

def register_alert_handlers(application):
    """Register alert handlers."""
    application.add_handler(CommandHandler("alerts", alerts_command))
    
    # Add alert conversation handler
    add_alert_conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler("addalert", add_alert_command),
            CallbackQueryHandler(alert_button, pattern=r"^add_alert$")
        ],
        states={
            TOKEN_ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, token_address_input)],
            PRICE_HIGH: [MessageHandler(filters.TEXT & ~filters.COMMAND, price_high_input)],
            PRICE_LOW: [MessageHandler(filters.TEXT & ~filters.COMMAND, price_low_input)],
            WATCHLIST_NAME: [
                CallbackQueryHandler(watchlist_button, pattern=r"^watchlist_"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, watchlist_name_input)
            ],
            CONFIRM_ALERT: [MessageHandler(filters.TEXT & ~filters.COMMAND, confirm_alert)]
        },
        fallbacks=[CommandHandler("cancel", lambda u, c: ConversationHandler.END)]
    )
    application.add_handler(add_alert_conv_handler)
    
    # Alert button handler
    application.add_handler(CallbackQueryHandler(alert_button, pattern=r"^remove_alert_"))
    
    return application
