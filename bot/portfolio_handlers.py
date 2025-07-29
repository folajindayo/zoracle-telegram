import logging
from telegram import Update
from telegram.ext import ContextTypes

from trading.portfolio import get_user_portfolio, get_transaction_history, calculate_profit_loss

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

async def portfolio_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /portfolio command."""
    user = update.effective_user
    
    # Send a "loading" message
    message = await update.message.reply_text("📊 Loading your portfolio...")
    
    # Get user's portfolio
    portfolio = await get_user_portfolio(str(user.id))
    
    if "error" in portfolio:
        await message.edit_text(f"❌ {portfolio['message']}")
        return
    
    # Format portfolio message
    portfolio_text = f"📊 *Your Portfolio*\n\n"
    portfolio_text += f"💰 *ETH Balance:* {portfolio['eth_balance']:.6f} ETH (${portfolio['eth_value_usd']:.2f})\n\n"
    
    if portfolio['tokens']:
        portfolio_text += "*Tokens:*\n"
        for token in portfolio['tokens']:
            portfolio_text += f"• {token['symbol']} - {token['balance']:.4f} (${token['value_usd']:.2f})\n"
    else:
        portfolio_text += "No tokens in your portfolio yet.\n"
    
    portfolio_text += f"\n*Total Value:* ${portfolio['total_value_usd']:.2f}"
    
    # Edit the "loading" message with the portfolio information
    await message.edit_text(portfolio_text, parse_mode='Markdown')

async def transactions_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /transactions command."""
    user = update.effective_user
    
    # Get limit from arguments if provided
    limit = 5
    if context.args and context.args[0].isdigit():
        limit = min(int(context.args[0]), 20)  # Max 20 transactions
    
    # Send a "loading" message
    message = await update.message.reply_text("📜 Loading your transaction history...")
    
    # Get user's transaction history
    history = await get_transaction_history(str(user.id), limit)
    
    if "error" in history:
        await message.edit_text(f"❌ {history['message']}")
        return
    
    # Format transaction history message
    history_text = f"📜 *Your Transaction History*\n\n"
    
    if history['transactions']:
        for tx in history['transactions']:
            tx_type = "🟢 Buy" if tx['type'] == 'buy' else "🔴 Sell"
            history_text += f"{tx_type}: {tx['token_symbol']} - {tx['eth_amount']:.4f} ETH\n"
            history_text += f"Status: {tx['status'].upper()} | {tx['date']}\n"
            history_text += f"[View on Explorer](https://basescan.org/tx/{tx['hash']})\n\n"
    else:
        history_text += "No transactions yet."
    
    # Edit the "loading" message with the transaction history
    await message.edit_text(history_text, parse_mode='Markdown', disable_web_page_preview=True)

async def pnl_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle the /pnl command."""
    user = update.effective_user
    
    # Send a "loading" message
    message = await update.message.reply_text("💹 Calculating your profit/loss...")
    
    # Calculate user's profit/loss
    pnl = await calculate_profit_loss(str(user.id))
    
    if "error" in pnl:
        await message.edit_text(f"❌ {pnl['message']}")
        return
    
    # Format profit/loss message
    pnl_text = f"💹 *Your Profit/Loss*\n\n"
    
    if pnl['token_pnl']:
        for token in pnl['token_pnl']:
            emoji = "🟢" if token['unrealized_pnl_eth'] >= 0 else "🔴"
            pnl_text += f"{emoji} {token['symbol']}: {token['unrealized_pnl_eth']:.6f} ETH ({token['unrealized_pnl_percent']:.2f}%)\n"
            pnl_text += f"   Balance: {token['balance']:.4f} | Cost: {token['cost_basis']:.6f} ETH\n\n"
        
        # Add total P&L
        total_emoji = "🟢" if pnl['total_unrealized_pnl'] >= 0 else "🔴"
        pnl_text += f"*Total P&L:* {total_emoji} {pnl['total_unrealized_pnl']:.6f} ETH ({pnl['total_unrealized_pnl_percent']:.2f}%)"
    else:
        pnl_text += "No tokens to calculate P&L."
    
    # Edit the "loading" message with the profit/loss information
    await message.edit_text(pnl_text, parse_mode='Markdown')

def register_portfolio_handlers(application):
    """Register portfolio handlers."""
    application.add_handler(CommandHandler("portfolio", portfolio_command))
    application.add_handler(CommandHandler("transactions", transactions_command))
    application.add_handler(CommandHandler("pnl", pnl_command))
    
    return application
