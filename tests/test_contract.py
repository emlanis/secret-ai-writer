import sys
import logging
from secret_ai_writer.ai_core.secret_ai_client import ConfidentialWriter
from decouple import config, UndefinedValueError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_environment():
    """Verify all required environment variables are set"""
    required_vars = [
        "CHAIN_ID",
        "LCD_URL",
        "MNEMONIC",
        "CONTRACT_ADDRESS"
    ]
    
    missing_vars = []
    for var in required_vars:
        try:
            config(var)
        except UndefinedValueError:
            missing_vars.append(var)
    
    if missing_vars:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_vars)}")

def main():
    try:
        # First check environment
        check_environment()
        logger.info("Environment variables verified ✅")
        
        # Initialize client
        writer = ConfidentialWriter()
        logger.info("✅ SDK initialized successfully!")
        
        # Test connection
        writer.chain.tendermint.block_info()
        logger.info("✅ Successfully connected to Secret Network!")
        
    except EnvironmentError as e:
        logger.error(f"❌ Environment configuration error: {str(e)}")
        sys.exit(1)
    except ConnectionError as e:
        logger.error(f"❌ Network connection error: {str(e)}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Initialization failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()