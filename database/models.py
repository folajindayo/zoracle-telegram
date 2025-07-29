from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DATABASE_URL

# Create SQLAlchemy base
Base = declarative_base()

class User(Base):
    """User model for storing Telegram user data and wallet information"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    telegram_id = Column(String, unique=True, nullable=False)
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    wallet_address = Column(String, nullable=True)
    encrypted_private_key = Column(String, nullable=True)
    slippage = Column(Float, default=5.0)  # Default slippage percentage
    auto_buy = Column(Boolean, default=False)
    auto_buy_amount = Column(Float, default=0.0)  # ETH amount for auto-buy
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    watchlists = relationship("Watchlist", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    
    def __repr__(self):
        return f"<User(telegram_id='{self.telegram_id}', wallet_address='{self.wallet_address}')>"

class Watchlist(Base):
    """Watchlist model for storing user token watchlists"""
    __tablename__ = 'watchlists'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="watchlists")
    tokens = relationship("WatchlistToken", back_populates="watchlist")
    
    def __repr__(self):
        return f"<Watchlist(name='{self.name}', user_id='{self.user_id}')>"

class WatchlistToken(Base):
    """Model for tokens in a watchlist"""
    __tablename__ = 'watchlist_tokens'
    
    id = Column(Integer, primary_key=True)
    watchlist_id = Column(Integer, ForeignKey('watchlists.id'))
    token_address = Column(String, nullable=False)
    token_symbol = Column(String, nullable=True)
    alert_price_high = Column(Float, nullable=True)  # Price alert high threshold
    alert_price_low = Column(Float, nullable=True)   # Price alert low threshold
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    watchlist = relationship("Watchlist", back_populates="tokens")
    
    def __repr__(self):
        return f"<WatchlistToken(token_address='{self.token_address}', watchlist_id='{self.watchlist_id}')>"

class Transaction(Base):
    """Model for storing user transactions"""
    __tablename__ = 'transactions'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    transaction_hash = Column(String, nullable=False)
    token_address = Column(String, nullable=False)
    token_symbol = Column(String, nullable=True)
    amount = Column(Float, nullable=False)  # Token amount
    eth_amount = Column(Float, nullable=False)  # ETH amount
    transaction_type = Column(String, nullable=False)  # 'buy' or 'sell'
    status = Column(String, default='pending')  # 'pending', 'confirmed', 'failed'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="transactions")
    
    def __repr__(self):
        return f"<Transaction(hash='{self.transaction_hash}', type='{self.transaction_type}', status='{self.status}')>"

class CopyTradeConfig(Base):
    """Model for storing copy trading configurations"""
    __tablename__ = 'copy_trade_configs'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    target_wallet = Column(String, nullable=False)
    slippage_guard = Column(Float, default=5.0)  # Maximum allowed slippage
    active = Column(Boolean, default=True)
    sandbox_mode = Column(Boolean, default=False)  # Test mode without real transactions
    max_eth_per_trade = Column(Float, default=0.1)  # Maximum ETH per trade
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    def __repr__(self):
        return f"<CopyTradeConfig(target_wallet='{self.target_wallet}', active='{self.active}')>"

# Initialize database engine
engine = create_engine(DATABASE_URL)

# Create tables
def init_db():
    Base.metadata.create_all(engine)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Function to get a database session
def get_db_session():
    db = SessionLocal()
    try:
        return db
    finally:
        db.close() 