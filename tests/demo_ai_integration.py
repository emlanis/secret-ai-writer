# tests/demo_ai_integration.py
import os
import sys
import logging
import dotenv
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables
dotenv.load_dotenv()

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from secret_ai_writer.ai_core.ai_integration import SecretAIWriter
from secret_ai_writer.ai_core.secret_ai_client import ConfidentialWriter

def main():
    try:
        # Initialize the blockchain client
        logger.info("Initializing ConfidentialWriter...")
        secret_client = ConfidentialWriter()
        wallet_address = secret_client.get_wallet_address()
        
        logger.info("✅ Successfully connected to Secret Network")
        logger.info(f"Using wallet address: {wallet_address}")
        
        # Initialize the AI writer
        logger.info("Initializing SecretAIWriter...")
        ai_writer = SecretAIWriter()
        logger.info("✅ AI integration initialized successfully")
        
        # Demo the content generation
        prompt = "Write a short paragraph about the importance of privacy in AI"
        logger.info(f"Generating content for prompt: '{prompt}'")
        
        # Check for Ollama availability
        try:
            result = ai_writer.generate_content(
                prompt=prompt,
                user_address=wallet_address
            )
            
            # Display results
            logger.info("\n===== Generated Content =====")
            print(result["content"])
            logger.info("\n===== Content Metadata =====")
            print(f"Model: {result['metadata']['model']}")
            print(f"Processing time: {result['metadata']['processing_time']} seconds")
            print(f"Estimated tokens: {result['metadata']['estimated_tokens']}")
            
            if result['metadata']['tx_hash']:
                print(f"Metadata stored on Secret Network with tx: {result['metadata']['tx_hash']}")
            
            logger.info("Demo completed successfully! ✅")
            
        except Exception as e:
            logger.error(f"Demo failed: {str(e)}")
            logger.error("Demo failed! ❌")
            sys.exit(1)
        
    except Exception as e:
        logger.error(f"Setup failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()