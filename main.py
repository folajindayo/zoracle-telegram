#!/usr/bin/env python3
import os
import sys
import logging
import asyncio
import signal

# Add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bot.bot import run_bot

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

def handle_sigterm(signum, frame):
    """Handle SIGTERM signal"""
    logger.info("Received SIGTERM signal. Shutting down...")
    sys.exit(0)

def handle_sigint(signum, frame):
    """Handle SIGINT signal"""
    logger.info("Received SIGINT signal. Shutting down...")
    sys.exit(0)

def main():
    """Main function"""
    # Register signal handlers
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigint)
    
    # Run the bot
    run_bot()

if __name__ == "__main__":
    main() 