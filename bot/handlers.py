import os
import sys
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, ContextTypes, filters
)

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import TELEGRAM_BOT_TOKEN, BOT_VERSION
from database import (
    init_db, create_user, get_user_by_telegram_id, update_user_wallet,
    update_user_settings, create_transaction, get_user_transactions
)
from utils.wallet import (
    create_wallet, import_wallet_from_private_key, encrypt_private_key,
    decrypt_private_key, get_eth_balance, get_token_balance, validate_address
)
from utils.tokens import (
    get_token_info, get_token_price, get_zora_tokens, get_trending_tokens,
    search_tokens
)
from trading.swap import buy_token_with_eth, sell_token_for_eth, approve_token

from .portfolio_handlers import register_portfolio_handlers
from .discovery_handlers import register_discovery_handlers
from .alert_handlers import register_alert_handlers
from .copytrade_handlers import register_copytrade_handlers

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Conversation states
(
    WALLET_CHOICE, IMPORT_WALLET, WALLET_PIN, CONFIRM_WALLET_PIN,
    TOKEN_ADDRESS, TOKEN_AMOUNT, CONFIRM_TRADE, SLIPPAGE_AMOUNT
) = range(8)

# Command handlers
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a welcome message when the command /start is issued."""
    user = update.effective_user
    
    # Create user in database if not exists
    db_user = get_user_by_telegram_id(user.id)
    if not db_user:
        db_user = create_user(user.id, user.username, user.first_name)
    
    welcome_message = (
        f"👋 Welcome to Zoracle Bot!\n\n"
        f"I'm your assistant for trading Zora content tokens on Base blockchain.\n\n"
        f"🔑 First, you need to set up a wallet. Use /wallet to get started.\n\n"
        f"Need help? Type /help to see all available commands."
    )
    
    await update.message.reply_text(welcome_message)

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send a help message when the command /help is issued."""
    help_message = (
        f"🤖 Zoracle Bot - Help\n\n"
        f"🔑 *Wallet Commands*\n"
        f"/wallet - Manage your wallet\n"
        f"/balance - Check your ETH and token balances\n\n"
        
        f"💱 *Trading Commands*\n"
        f"/buy <token_address> <amount> - Buy tokens with ETH\n"
        f"/sell <token_address> <amount> - Sell tokens for ETH\n"
        f"/approve <token_address> - Approve token for trading\n\n"
        
        f"📊 *Discovery Commands*\n"
        f"/search <query> - Search for tokens\n"
        f"/trending - Show trending tokens\n"
        f"/new - Show newly created tokens\n\n"
        
        f"📈 *Portfolio Commands*\n"
        f"/portfolio - View your portfolio\n"
        f"/transactions - View your transaction history\n"
        f"/pnl - Calculate profit/loss\n\n"
        
        f"⚙️ *Settings Commands*\n"
        f"/settings - Configure bot settings\n"
        f"/slippage <percentage> - Set slippage tolerance\n\n"
        
        f"🔔 *Alert Commands*\n"
        f"/alerts - Manage your price alerts\n"
        f"/addalert <token_address> - Add a price alert\n\n"
        
        f"🔄 *Copy-Trading Commands*\n"
        f"/mirror <wallet_address> - Mirror another wallet's trades\n"
        f"/mirrors - List active mirrors\n\n"
        
        f"ℹ️ *Other Commands*\n"
        f"/help - Show this help message\n"
        f"/about - Show bot information"
    )
    
    await update.message.reply_text(help_message, parse_mode='Markdown')

async def about_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Send information about the bot when the command /about is issued."""
    about_message = (
        f"🤖 *Zoracle Bot*\n\n"
        f"A Telegram bot for trading Zora content tokens on Base blockchain.\n\n"
        f"*Features:*\n"
        f"- Wallet management\n"
        f"- In-chat swap engine\n"
        f"- Portfolio tracking\n"
        f"- Content discovery\n"
        f"- Alerts & notifications\n"
        f"- Watchlists & copy-trading\n\n"
        f"Built with ❤️ for the Base ecosystem"
    )
    
    await update.message.reply_text(about_message, parse_mode='Markdown')

# Wallet management
async def wallet_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle the /wallet command."""
    user = update.effective_user
    db_user = get_user_by_telegram_id(user.id)
    
    if db_user and db_user.wallet_address:
        # User already has a wallet
        keyboard = [
            [InlineKeyboardButton("View Balance", callback_data='wallet_balance')],
            [InlineKeyboardButton("Create New Wallet", callback_data='wallet_create')],
            [InlineKeyboardButton("Import Different Wallet", callback_data='wallet_import')]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            f"🔑 Your current wallet address:\n`{db_user.wallet_address}`\n\nWhat would you like to do?",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        return ConversationHandler.END
    else:
        # User doesn't have a wallet yet
        keyboard = [
            [InlineKeyboardButton("Create New Wallet", callback_data='wallet_create')],
            [InlineKeyboardButton("Import Existing Wallet", callback_data='wallet_import')]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "🔑 You don't have a wallet set up yet. Would you like to create a new one or import an existing one?",
            reply_markup=reply_markup
        )
        return WALLET_CHOICE

async def wallet_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle wallet button presses."""
    query = update.callback_query
    await query.answer()
    
    if query.data == 'wallet_create':
        # Create a new wallet
        new_wallet = create_wallet()
        context.user_data['temp_wallet'] = new_wallet
        
        await query.edit_message_text(
            f"🔑 I've generated a new wallet for you:\n\n"
            f"Address: `{new_wallet['address']}`\n\n"
            f"Private Key: `{new_wallet['private_key']}`\n\n"
            f"⚠️ **IMPORTANT**: Save this private key somewhere safe! "
            f"It will only be shown once and cannot be recovered if lost.\n\n"
            f"Please enter a PIN to encrypt your wallet (6 digits):",
            parse_mode='Markdown'
        )
        return WALLET_PIN
    
    elif query.data == 'wallet_import':
        # Import an existing wallet
        await query.edit_message_text(
            "🔑 Please enter your private key to import your wallet:\n\n"
            "⚠️ **IMPORTANT**: Never share your private key with anyone else!"
        )
        return IMPORT_WALLET
    
    elif query.data == 'wallet_balance':
        # Show wallet balance
        user = update.effective_user
        db_user = get_user_by_telegram_id(user.id)
        
        if db_user and db_user.wallet_address:
            eth_balance = get_eth_balance(db_user.wallet_address)
            
            await query.edit_message_text(
                f"💰 Wallet Balance\n\n"
                f"Address: `{db_user.wallet_address}`\n\n"
                f"ETH Balance: {eth_balance:.6f} ETH",
                parse_mode='Markdown'
            )
        else:
            await query.edit_message_text(
                "❌ You don't have a wallet set up yet. Use /wallet to set one up."
            )
        
        return ConversationHandler.END

async def import_wallet(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle private key import."""
    private_key = update.message.text
    
    # Delete the message containing the private key for security
    await update.message.delete()
    
    try:
        # Validate and import the wallet
        imported_wallet = import_wallet_from_private_key(private_key)
        context.user_data['temp_wallet'] = imported_wallet
        
        await update.message.reply_text(
            f"🔑 Wallet imported successfully!\n\n"
            f"Address: `{imported_wallet['address']}`\n\n"
            f"Please enter a PIN to encrypt your wallet (6 digits):",
            parse_mode='Markdown'
        )
        return WALLET_PIN
    
    except ValueError as e:
        await update.message.reply_text(
            f"❌ Error importing wallet: {str(e)}\n\n"
            f"Please try again with a valid private key."
        )
        return IMPORT_WALLET

async def wallet_pin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle wallet PIN entry."""
    pin = update.message.text
    
    # Delete the message containing the PIN for security
    await update.message.delete()
    
    # Validate PIN
    if not pin.isdigit() or len(pin) != 6:
        await update.message.reply_text(
            "❌ PIN must be 6 digits. Please try again:"
        )
        return WALLET_PIN
    
    # Store PIN temporarily
    context.user_data['temp_pin'] = pin
    
    await update.message.reply_text(
        "🔑 Please confirm your PIN:"
    )
    return CONFIRM_WALLET_PIN

async def confirm_wallet_pin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle wallet PIN confirmation."""
    confirm_pin = update.message.text
    
    # Delete the message containing the PIN for security
    await update.message.delete()
    
    # Check if PINs match
    if confirm_pin != context.user_data['temp_pin']:
        await update.message.reply_text(
            "❌ PINs do not match. Please start over with /wallet."
        )
        return ConversationHandler.END
    
    # Encrypt and store the wallet
    user = update.effective_user
    wallet = context.user_data['temp_wallet']
    
    # Encrypt the private key
    encrypted_key = encrypt_private_key(wallet['private_key'])
    
    # Update user in database
    update_user_wallet(user.id, wallet['address'], encrypted_key)
    
    # Clean up temporary data
    del context.user_data['temp_wallet']
    del context.user_data['temp_pin']
    
    await update.message.reply_text(
        f"✅ Wallet set up successfully!\n\n"
        f"Address: `{wallet['address']}`\n\n"
        f"Your wallet is now encrypted and ready to use. You can check your balance with /balance.",
        parse_mode='Markdown'
    )
    return ConversationHandler.END

async def balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /balance command."""
    user = update.effective_user
    db_user = get_user_by_telegram_id(user.id)
    
    if not db_user or not db_user.wallet_address:
        await update.message.reply_text(
            "❌ You don't have a wallet set up yet. Use /wallet to set one up."
        )
        return
    
    # Get ETH balance
    eth_balance = get_eth_balance(db_user.wallet_address)
    
    # Get token balances (in a real implementation, you would fetch all tokens owned by the user)
    # For now, we'll just show ETH balance
    
    await update.message.reply_text(
        f"💰 Wallet Balance\n\n"
        f"Address: `{db_user.wallet_address}`\n\n"
        f"ETH Balance: {eth_balance:.6f} ETH",
        parse_mode='Markdown'
    )

# Trading commands
async def buy_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle the /buy command."""
    user = update.effective_user
    db_user = get_user_by_telegram_id(user.id)
    
    if not db_user or not db_user.wallet_address:
        await update.message.reply_text(
            "❌ You don't have a wallet set up yet. Use /wallet to set one up."
        )
        return ConversationHandler.END
    
    # Check if arguments are provided
    if not context.args:
        await update.message.reply_text(
            "❌ Please specify a token address.\n\n"
            "Usage: /buy <token_address> [amount_in_eth]"
        )
        return ConversationHandler.END
    
    # Get token address from arguments
    token_address = context.args[0]
    
    # Validate token address
    if not validate_address(token_address):
        await update.message.reply_text(
            "❌ Invalid token address. Please provide a valid Ethereum address."
        )
        return ConversationHandler.END
    
    # Store token address in context
    context.user_data['buy_token_address'] = token_address
    
    # Try to get token info
    try:
        token_info = get_token_info(token_address)
        context.user_data['buy_token_info'] = token_info
        
        # If amount is provided in arguments
        if len(context.args) > 1:
            try:
                amount = float(context.args[1])
                if amount <= 0:
                    raise ValueError("Amount must be greater than 0")
                
                context.user_data['buy_amount'] = amount
                
                # Get ETH balance
                eth_balance = get_eth_balance(db_user.wallet_address)
                
                if amount > eth_balance:
                    await update.message.reply_text(
                        f"❌ Insufficient ETH balance. You have {eth_balance:.6f} ETH."
                    )
                    return ConversationHandler.END
                
                # Confirm the trade
                await update.message.reply_text(
                    f"🔄 You are about to buy {token_info['name']} ({token_info['symbol']}) with {amount} ETH.\n\n"
                    f"Do you want to proceed? (yes/no)"
                )
                return CONFIRM_TRADE
            
            except ValueError:
                await update.message.reply_text(
                    "❌ Invalid amount. Please provide a valid number."
                )
                return ConversationHandler.END
        
        # If amount is not provided, ask for it
        await update.message.reply_text(
            f"💰 How much ETH would you like to spend to buy {token_info['name']} ({token_info['symbol']})?\n\n"
            f"Please enter the amount in ETH:"
        )
        return TOKEN_AMOUNT
    
    except Exception as e:
        await update.message.reply_text(
            f"❌ Error fetching token info: {str(e)}\n\n"
            f"Please make sure the token address is correct and try again."
        )
        return ConversationHandler.END

async def token_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle token amount entry for buying."""
    try:
        amount = float(update.message.text)
        if amount <= 0:
            raise ValueError("Amount must be greater than 0")
        
        context.user_data['buy_amount'] = amount
        
        # Get user's ETH balance
        user = update.effective_user
        db_user = get_user_by_telegram_id(user.id)
        eth_balance = get_eth_balance(db_user.wallet_address)
        
        if amount > eth_balance:
            await update.message.reply_text(
                f"❌ Insufficient ETH balance. You have {eth_balance:.6f} ETH."
            )
            return ConversationHandler.END
        
        # Get token info from context
        token_info = context.user_data['buy_token_info']
        
        # Confirm the trade
        await update.message.reply_text(
            f"🔄 You are about to buy {token_info['name']} ({token_info['symbol']}) with {amount} ETH.\n\n"
            f"Do you want to proceed? (yes/no)"
        )
        return CONFIRM_TRADE
    
    except ValueError:
        await update.message.reply_text(
            "❌ Invalid amount. Please enter a valid number."
        )
        return TOKEN_AMOUNT

async def confirm_trade(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Handle trade confirmation."""
    response = update.message.text.lower()
    
    if response not in ['yes', 'y']:
        await update.message.reply_text(
            "❌ Trade cancelled."
        )
        return ConversationHandler.END
    
    # Get trade details from context
    token_address = context.user_data['buy_token_address']
    token_info = context.user_data['buy_token_info']
    amount = context.user_data['buy_amount']
    
    # Get user's wallet info
    user = update.effective_user
    db_user = get_user_by_telegram_id(user.id)
    wallet_address = db_user.wallet_address
    
    # In a real implementation, you would:
    # 1. Decrypt the private key using the user's PIN
    # 2. Execute the trade
    # 3. Store the transaction in the database
    
    # For now, we'll just simulate a successful trade
    await update.message.reply_text(
        f"🔄 Processing your trade...\n\n"
        f"Buying {token_info['name']} ({token_info['symbol']}) with {amount} ETH."
    )
    
    # Simulate a transaction hash
    tx_hash = f"0x{'0' * 64}"
    
    # Store transaction in database
    create_transaction(
        user.id,
        tx_hash,
        token_address,
        token_info['symbol'],
        0,  # Token amount (unknown until transaction is mined)
        amount,
        'buy'
    )
    
    await update.message.reply_text(
        f"✅ Trade submitted successfully!\n\n"
        f"Transaction Hash: `{tx_hash}`\n\n"
        f"You can check your portfolio with /portfolio.",
        parse_mode='Markdown'
    )
    
    return ConversationHandler.END

# Setup conversation handlers
def setup_handlers(application: Application):
    """Set up all handlers for the bot."""
    # Basic command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("about", about_command))
    
    # Register portfolio handlers
    register_portfolio_handlers(application)
    
    # Register discovery handlers
    register_discovery_handlers(application)
    
    # Register alert handlers
    register_alert_handlers(application)
    
    # Register copy-trade handlers
    register_copytrade_handlers(application)
    
    # Add any other handlers here
    
    return application 