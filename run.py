#!/usr/bin/env python3
"""
Entry point for the Zoracle Telegram Bot.
"""
import os
import sys
from utils.check_config import check_config
from main import main

if __name__ == "__main__":
    # Check configuration
    if not check_config():
        print("\n❌ Configuration check failed. Please fix the issues above.")
        sys.exit(1)
    
    # Run the bot
    print("\n🚀 Starting Zoracle Telegram Bot...")
    main() 