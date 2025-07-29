from .models import User, Watchlist, WatchlistToken, Transaction, CopyTradeConfig, get_db_session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, or_
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# User operations
def create_user(telegram_id, username=None, first_name=None):
    """Create a new user in the database"""
    db = get_db_session()
    try:
        user = User(
            telegram_id=str(telegram_id),
            username=username,
            first_name=first_name
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()
        return get_user_by_telegram_id(telegram_id)
    finally:
        db.close()

def get_user_by_telegram_id(telegram_id):
    """Get a user by Telegram ID"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        return user
    finally:
        db.close()

def update_user_wallet(telegram_id, wallet_address, encrypted_private_key):
    """Update a user's wallet information"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if user:
            user.wallet_address = wallet_address
            user.encrypted_private_key = encrypted_private_key
            db.commit()
            db.refresh(user)
            return user
        return None
    finally:
        db.close()

def update_user_settings(telegram_id, slippage=None, auto_buy=None, auto_buy_amount=None):
    """Update a user's settings"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if user:
            if slippage is not None:
                user.slippage = slippage
            if auto_buy is not None:
                user.auto_buy = auto_buy
            if auto_buy_amount is not None:
                user.auto_buy_amount = auto_buy_amount
            db.commit()
            db.refresh(user)
            return user
        return None
    finally:
        db.close()

# Watchlist operations
def create_watchlist(telegram_id, name):
    """Create a new watchlist for a user"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if not user:
            return None
        
        watchlist = Watchlist(
            user_id=user.id,
            name=name
        )
        db.add(watchlist)
        db.commit()
        db.refresh(watchlist)
        return watchlist
    finally:
        db.close()

def get_user_watchlists(telegram_id):
    """Get all watchlists for a user"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if not user:
            return []
        
        return db.query(Watchlist).filter(Watchlist.user_id == user.id).all()
    finally:
        db.close()

def add_token_to_watchlist(watchlist_id, token_address, token_symbol=None, alert_price_high=None, alert_price_low=None):
    """Add a token to a watchlist"""
    db = get_db_session()
    try:
        watchlist_token = WatchlistToken(
            watchlist_id=watchlist_id,
            token_address=token_address,
            token_symbol=token_symbol,
            alert_price_high=alert_price_high,
            alert_price_low=alert_price_low
        )
        db.add(watchlist_token)
        db.commit()
        db.refresh(watchlist_token)
        return watchlist_token
    finally:
        db.close()

def get_watchlist_tokens(watchlist_id):
    """Get all tokens in a watchlist"""
    db = get_db_session()
    try:
        return db.query(WatchlistToken).filter(WatchlistToken.watchlist_id == watchlist_id).all()
    finally:
        db.close()

# Transaction operations
def create_transaction(telegram_id, transaction_hash, token_address, token_symbol, amount, eth_amount, transaction_type):
    """Create a new transaction record"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if not user:
            return None
        
        transaction = Transaction(
            user_id=user.id,
            transaction_hash=transaction_hash,
            token_address=token_address,
            token_symbol=token_symbol,
            amount=amount,
            eth_amount=eth_amount,
            transaction_type=transaction_type
        )
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        return transaction
    finally:
        db.close()

def update_transaction_status(transaction_hash, status):
    """Update a transaction's status"""
    db = get_db_session()
    try:
        transaction = db.query(Transaction).filter(Transaction.transaction_hash == transaction_hash).first()
        if transaction:
            transaction.status = status
            db.commit()
            db.refresh(transaction)
            return transaction
        return None
    finally:
        db.close()

def get_user_transactions(telegram_id, limit=10):
    """Get a user's transactions"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if not user:
            return []
        
        return db.query(Transaction).filter(Transaction.user_id == user.id).order_by(Transaction.created_at.desc()).limit(limit).all()
    finally:
        db.close()

# Copy trade operations
def create_copy_trade_config(telegram_id, target_wallet, slippage_guard=5.0, active=True, sandbox_mode=False, max_eth_per_trade=0.1):
    """Create a new copy trade configuration"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if not user:
            return None
        
        config = CopyTradeConfig(
            user_id=user.id,
            target_wallet=target_wallet,
            slippage_guard=slippage_guard,
            active=active,
            sandbox_mode=sandbox_mode,
            max_eth_per_trade=max_eth_per_trade
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config
    finally:
        db.close()

def update_copy_trade_config(config_id, active=None, slippage_guard=None, sandbox_mode=None, max_eth_per_trade=None):
    """Update a copy trade configuration"""
    db = get_db_session()
    try:
        config = db.query(CopyTradeConfig).filter(CopyTradeConfig.id == config_id).first()
        if config:
            if active is not None:
                config.active = active
            if slippage_guard is not None:
                config.slippage_guard = slippage_guard
            if sandbox_mode is not None:
                config.sandbox_mode = sandbox_mode
            if max_eth_per_trade is not None:
                config.max_eth_per_trade = max_eth_per_trade
            db.commit()
            db.refresh(config)
            return config
        return None
    finally:
        db.close()

def get_user_copy_trade_configs(telegram_id):
    """Get a user's copy trade configurations"""
    db = get_db_session()
    try:
        user = db.query(User).filter(User.telegram_id == str(telegram_id)).first()
        if not user:
            return []
        
        return db.query(CopyTradeConfig).filter(CopyTradeConfig.user_id == user.id).all()
    finally:
        db.close() 