#!/usr/bin/env python3
"""
Generate a secure encryption key for the Zoracle Telegram Bot.
"""
import os
import sys
from cryptography.fernet import Fernet

def generate_key():
    """Generate a Fernet key and print it."""
    key = Fernet.generate_key()
    print(f"Generated encryption key: {key.decode()}")
    print("Add this to your .env file as ENCRYPTION_KEY=<key>")

if __name__ == "__main__":
    generate_key() 