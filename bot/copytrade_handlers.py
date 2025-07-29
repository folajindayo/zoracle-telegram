import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes, CommandHandler, CallbackQueryHandler, ConversationHandler, MessageHandler, filters

from trading.copytrade import setup_copy_trading, update_copy_trading, get_copy_trading_configs
from utils.wallet import validate_address

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Conversation states
TARGET_WALLET, SLIPPAGE_GUARD, MAX_ETH, SANDBOX_MODE, CONFIRM_SETUP = range(5)

async def mirror_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle the /mirror command."""
    # Check if wallet address is provided in arguments
    if context.args:
        context.user_data['mirror_target_wallet'] = context.args[0]
        
        # Validate wallet address (simple validation)
        if not context.args[0].startswith("0x") or len(context.args[0]) != 42:
            await update.message.reply_text(
                "❌ Invalid wallet address. Please enter a valid Ethereum address:"
            )
            return TARGET_WALLET
        
        await update.message.reply_text(
            f"Setting up copy trading for wallet: `{context.args[0]}`\n\n"
            f"Please enter the maximum slippage percentage (default: 5.0):",
            parse_mode='Markdown'
        )
        return SLIPPAGE_GUARD
    
    # Ask for target wallet address
    await update.message.reply_text(
        "Please enter the wallet address you want to mirror trades from:"
    )
    return TARGET_WALLET

async def target_wallet_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle target wallet address input."""
    target_wallet = update.message.text
    
    # Validate wallet address (simple validation)
    if not target_wallet.startswith("0x") or len(target_wallet) != 42:
        await update.message.reply_text(
            "❌ Invalid wallet address. Please enter a valid Ethereum address:"
        )
        return TARGET_WALLET
    
    # Store target wallet
    context.user_data['mirror_target_wallet'] = target_wallet
    
    # Ask for slippage guard
    await update.message.reply_text(
        "Please enter the maximum slippage percentage (default: 5.0):"
    )
    return SLIPPAGE_GUARD

async def slippage_guard_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle slippage guard input."""
    slippage_text = update.message.text
    
    try:
        if slippage_text.strip() == "":
            # Use default
            context.user_data['mirror_slippage_guard'] = 5.0
        else:
            slippage = float(slippage_text)
            if slippage < 0.1 or slippage > 50:
                raise ValueError("Slippage must be between 0.1 and 50")
            
            context.user_data['mirror_slippage_guard'] = slippage
    except ValueError:
        await update.message.reply_text(
            "❌ Invalid slippage value. Please enter a number between 0.1 and 50:"
        )
        return SLIPPAGE_GUARD
    
    # Ask for max ETH per trade
    await update.message.reply_text(
        "Please enter the maximum ETH amount per trade (default: 0.1):"
    )
    return MAX_ETH

async def max_eth_input(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle max ETH input."""
    max_eth_text = update.message.text
    
    try:
        if max_eth_text.strip() == "":
            # Use default
            context.user_data['mirror_max_eth'] = 0.1
        else:
            max_eth = float(max_eth_text)
            if max_eth <= 0:
                raise ValueError("Max ETH must be greater than 0")
            
            context.user_data['mirror_max_eth'] = max_eth
    except ValueError:
        await update.message.reply_text(
            "❌ Invalid ETH amount. Please enter a positive number:"
        )
        return MAX_ETH
    
    # Ask for sandbox mode
    keyboard = [
        [InlineKeyboardButton("Yes (Recommended for testing)", callback_data="sandbox_yes")],
        [InlineKeyboardButton("No (Real trading)", callback_data="sandbox_no")]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "Do you want to enable sandbox mode? In sandbox mode, trades will be simulated but not executed.",
        reply_markup=reply_markup
    )
    return SANDBOX_MODE

async def sandbox_mode_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle sandbox mode button press."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data == "sandbox_yes":
        context.user_data['mirror_sandbox_mode'] = True
    else:
        context.user_data['mirror_sandbox_mode'] = False
    
    # Show confirmation
    target_wallet = context.user_data['mirror_target_wallet']
    slippage_guard = context.user_data['mirror_slippage_guard']
    max_eth = context.user_data['mirror_max_eth']
    sandbox_mode = context.user_data['mirror_sandbox_mode']
    
    confirm_text = f"📋 *Copy Trading Setup*\n\n"
    confirm_text += f"*Target Wallet:* `{target_wallet}`\n"
    confirm_text += f"*Max Slippage:* {slippage_guard}%\n"
    confirm_text += f"*Max ETH per Trade:* {max_eth} ETH\n"
    confirm_text += f"*Sandbox Mode:* {'Enabled' if sandbox_mode else 'Disabled'}\n\n"
    
    if not sandbox_mode:
        confirm_text += "⚠️ **WARNING**: Sandbox mode is disabled. Real trades will be executed with your funds.\n\n"
    
    confirm_text += "Do you want to proceed with this setup?"
    
    keyboard = [
        [InlineKeyboardButton("Yes, Enable Copy Trading", callback_data="confirm_mirror_yes")],
        [InlineKeyboardButton("No, Cancel", callback_data="confirm_mirror_no")]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(confirm_text, reply_markup=reply_markup, parse_mode='Markdown')
    return CONFIRM_SETUP

async def confirm_setup_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle confirmation button press."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data == "confirm_mirror_no":
        await query.edit_message_text("❌ Copy trading setup cancelled.")
        return ConversationHandler.END
    
    # Get setup details
    target_wallet = context.user_data['mirror_target_wallet']
    slippage_guard = context.user_data['mirror_slippage_guard']
    max_eth = context.user_data['mirror_max_eth']
    sandbox_mode = context.user_data['mirror_sandbox_mode']
    
    # Setup copy trading
    user = update.effective_user
    result = await setup_copy_trading(
        str(user.id),
        target_wallet,
        slippage_guard,
        max_eth,
        sandbox_mode
    )
    
    if "error" in result:
        await query.edit_message_text(f"❌ {result['message']}")
    else:
        success_text = f"✅ Copy trading set up successfully!\n\n"
        success_text += f"You are now mirroring trades from:\n`{target_wallet}`\n\n"
        
        if sandbox_mode:
            success_text += "🧪 Sandbox mode is enabled. Trades will be simulated but not executed.\n\n"
        else:
            success_text += "⚠️ Real trading mode is enabled. Trades will be executed with your funds.\n\n"
        
        success_text += "Use /mirrors to view and manage your copy trading configurations."
        
        await query.edit_message_text(success_text, parse_mode='Markdown')
    
    # Clear user data
    if 'mirror_target_wallet' in context.user_data:
        del context.user_data['mirror_target_wallet']
    
    if 'mirror_slippage_guard' in context.user_data:
        del context.user_data['mirror_slippage_guard']
    
    if 'mirror_max_eth' in context.user_data:
        del context.user_data['mirror_max_eth']
    
    if 'mirror_sandbox_mode' in context.user_data:
        del context.user_data['mirror_sandbox_mode']
    
    return ConversationHandler.END

async def mirrors_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /mirrors command."""
    user = update.effective_user
    
    # Send a "loading" message
    message = await update.message.reply_text("🔄 Loading your copy trading configurations...")
    
    # Get user's copy trading configs
    configs = await get_copy_trading_configs(str(user.id))
    
    if "error" in configs:
        await message.edit_text(f"❌ {configs['message']}")
        return
    
    # Format configs message
    configs_text = f"🔄 *Your Copy Trading Configurations*\n\n"
    
    if configs['configs']:
        for config in configs['configs']:
            status = "✅ Active" if config['active'] else "❌ Inactive"
            mode = "🧪 Sandbox" if config['sandbox_mode'] else "💰 Real Trading"
            
            configs_text += f"• *Config #{config['id']}*\n"
            configs_text += f"  Target: `{config['target_wallet']}`\n"
            configs_text += f"  Status: {status} | Mode: {mode}\n"
            configs_text += f"  Max Slippage: {config['slippage_guard']}% | Max ETH: {config['max_eth_per_trade']} ETH\n\n"
            
            # Store config in context
            context.user_data[f"mirror_config_{config['id']}"] = config
    else:
        configs_text += "You don't have any copy trading configurations set up yet.\n\nUse /mirror to set up copy trading."
    
    # Create keyboard with manage buttons
    keyboard = []
    if configs['configs']:
        for config in configs['configs']:
            if config['active']:
                keyboard.append([
                    InlineKeyboardButton(f"Pause #{config['id']}", callback_data=f"mirror_pause_{config['id']}")
                ])
            else:
                keyboard.append([
                    InlineKeyboardButton(f"Resume #{config['id']}", callback_data=f"mirror_resume_{config['id']}")
                ])
            
            keyboard.append([
                InlineKeyboardButton(f"{'Disable' if config['sandbox_mode'] else 'Enable'} Sandbox #{config['id']}", 
                                    callback_data=f"mirror_sandbox_{config['id']}")
            ])
    
    keyboard.append([InlineKeyboardButton("Add New Mirror", callback_data="mirror_add")])
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Edit the "loading" message with the configs information
    await message.edit_text(configs_text, parse_mode='Markdown', reply_markup=reply_markup)

async def mirror_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle mirror button presses."""
    query = update.callback_query
    await query.answer()
    
    data = query.data
    
    if data == "mirror_add":
        # Start mirror conversation
        await query.edit_message_text(
            "Please enter the wallet address you want to mirror trades from:"
        )
        return TARGET_WALLET
    
    elif data.startswith("mirror_pause_"):
        # Pause copy trading
        config_id = int(data[13:])
        
        # Update copy trading config
        user = update.effective_user
        result = await update_copy_trading(
            str(user.id),
            config_id,
            active=False
        )
        
        if "error" in result:
            await query.edit_message_text(f"❌ {result['message']}")
        else:
            await query.edit_message_text(f"✅ Copy trading paused for configuration #{config_id}.")
    
    elif data.startswith("mirror_resume_"):
        # Resume copy trading
        config_id = int(data[14:])
        
        # Update copy trading config
        user = update.effective_user
        result = await update_copy_trading(
            str(user.id),
            config_id,
            active=True
        )
        
        if "error" in result:
            await query.edit_message_text(f"❌ {result['message']}")
        else:
            await query.edit_message_text(f"✅ Copy trading resumed for configuration #{config_id}.")
    
    elif data.startswith("mirror_sandbox_"):
        # Toggle sandbox mode
        config_id = int(data[15:])
        config = context.user_data.get(f"mirror_config_{config_id}")
        
        if not config:
            await query.edit_message_text("❌ Configuration not found. Please try again.")
            return
        
        # Toggle sandbox mode
        new_sandbox_mode = not config['sandbox_mode']
        
        # Update copy trading config
        user = update.effective_user
        result = await update_copy_trading(
            str(user.id),
            config_id,
            sandbox_mode=new_sandbox_mode
        )
        
        if "error" in result:
            await query.edit_message_text(f"❌ {result['message']}")
        else:
            mode_text = "enabled" if new_sandbox_mode else "disabled"
            await query.edit_message_text(
                f"✅ Sandbox mode {mode_text} for configuration #{config_id}.\n\n"
                f"{'🧪 Trades will be simulated but not executed.' if new_sandbox_mode else '⚠️ Real trading mode enabled. Trades will be executed with your funds.'}"
            )

def register_copytrade_handlers(application):
    """Register copy-trade handlers."""
    # Mirror conversation handler
    mirror_conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler("mirror", mirror_command),
            CallbackQueryHandler(mirror_button, pattern=r"^mirror_add$")
        ],
        states={
            TARGET_WALLET: [MessageHandler(filters.TEXT & ~filters.COMMAND, target_wallet_input)],
            SLIPPAGE_GUARD: [MessageHandler(filters.TEXT & ~filters.COMMAND, slippage_guard_input)],
            MAX_ETH: [MessageHandler(filters.TEXT & ~filters.COMMAND, max_eth_input)],
            SANDBOX_MODE: [CallbackQueryHandler(sandbox_mode_button, pattern=r"^sandbox_")],
            CONFIRM_SETUP: [CallbackQueryHandler(confirm_setup_button, pattern=r"^confirm_mirror_")]
        },
        fallbacks=[CommandHandler("cancel", lambda u, c: ConversationHandler.END)]
    )
    application.add_handler(mirror_conv_handler)
    
    # Mirrors command
    application.add_handler(CommandHandler("mirrors", mirrors_command))
    
    # Mirror button handlers
    application.add_handler(CallbackQueryHandler(mirror_button, pattern=r"^mirror_(pause|resume|sandbox)_"))
    
    return application
