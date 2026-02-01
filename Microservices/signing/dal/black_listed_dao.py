from helpers.redis_client import redis_client
from helpers.config import EXPIRE_TIME, logger

# We can ignore the session argument to maintain backward compatibility if needed, 
# or prefer to remove it from the caller. 
# For now, let's allow it but not use it, or just remove it if we update the controller (preferred).

def is_blacklist_token(token: str) -> bool:
    try:
        client = redis_client.get_client()
        if client and client.exists(token):
            return True
    except Exception as e:
        logger.error(f"Error checking blacklist in Redis: {e}")
    return False

def add_token_to_blacklist(token: str, expiration_minutes: int = int(EXPIRE_TIME)) -> bool:
    try:
        client = redis_client.get_client()
        if client:
            # Set key with expiration
            # Value can be anything, e.g., "revoked"
            client.setex(token, expiration_minutes * 60, "revoked")
            return True
    except Exception as e:
        logger.error(f"Error adding token to blacklist in Redis: {e}")
    return False
