import os
import sys
import logging
import asyncio
from telegram.ext import Application

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import TELEGRAM_BOT_TOKEN, BOT_VERSION
from database import init_db
from .handlers import setup_handlers
from trading.copytrade import start_monitoring as start_copytrade_monitoring
from trading.alerts import start_alert_monitoring

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

async def main():
    """Start the bot."""
    # Initialize database
    init_db()
    
    # Create the Application
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Setup handlers
    setup_handlers(application)
    
    # Start the Bot
    logger.info(f"Starting Zoracle Bot v{BOT_VERSION}...")
    await application.initialize()
    await application.start_polling()
    
    # Start monitoring services
    asyncio.create_task(start_copytrade_monitoring())
    asyncio.create_task(start_alert_monitoring(application.bot))
    
    logger.info("Bot is running. Press Ctrl+C to stop.")
    
    # Run the bot until the user presses Ctrl-C
    try:
        await application.updater.start_polling()
    finally:
        await application.updater.stop()
        await application.stop()

def run_bot():
    """Run the bot."""
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Bot stopped by user.")
    except Exception as e:
        logger.error(f"Error running bot: {str(e)}")

if __name__ == '__main__':
    run_bot() 