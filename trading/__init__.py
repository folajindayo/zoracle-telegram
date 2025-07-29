from .swap import (
    buy_token_with_eth, 
    sell_token_for_eth, 
    approve_token, 
    check_token_allowance
)
from .portfolio import (
    get_user_portfolio,
    get_transaction_history,
    calculate_profit_loss
)
from .discovery import (
    discover_new_tokens,
    discover_trending_tokens,
    search_for_tokens,
    get_token_details
)
from .alerts import (
    add_price_alert,
    remove_price_alert,
    get_user_alerts,
    start_alert_monitoring
)
from .copytrade import (
    setup_copy_trading,
    update_copy_trading,
    get_copy_trading_configs,
    start_monitoring as start_copytrade_monitoring
)

__all__ = [
    # Swap functions
    'buy_token_with_eth', 
    'sell_token_for_eth', 
    'approve_token', 
    'check_token_allowance',
    
    # Portfolio functions
    'get_user_portfolio',
    'get_transaction_history',
    'calculate_profit_loss',
    
    # Discovery functions
    'discover_new_tokens',
    'discover_trending_tokens',
    'search_for_tokens',
    'get_token_details',
    
    # Alert functions
    'add_price_alert',
    'remove_price_alert',
    'get_user_alerts',
    'start_alert_monitoring',
    
    # Copy-trade functions
    'setup_copy_trading',
    'update_copy_trading',
    'get_copy_trading_configs',
    'start_copytrade_monitoring'
] 