
import sys
import json
import os
import logging
import traceback
import hashlib
import pickle
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the parent directory to path so we can import the secret_ai_writer module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Simple cache implementation
class SimpleCache:
    def __init__(self, cache_dir=None):
        if cache_dir is None:
            cache_dir = os.path.join(os.path.dirname(__file__), 'cache')
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
    def _get_key(self, action, data):
        """Generate a unique key based on action and data"""
        key_data = json.dumps({"action": action, "data": data}, sort_keys=True).encode()
        return hashlib.md5(key_data).hexdigest()
    
    def get(self, action, data):
        """Get value from cache if it exists"""
        key = self._get_key(action, data)
        cache_file = self.cache_dir / f"{key}.pickle"
        
        if cache_file.exists():
            try:
                with open(cache_file, 'rb') as f:
                    logger.info(f"Cache hit for action: {action}")
                    return pickle.load(f)
            except Exception as e:
                logger.error(f"Error reading from cache: {e}")
        return None
    
    def set(self, action, data, result):
        """Save value to cache"""
        key = self._get_key(action, data)
        cache_file = self.cache_dir / f"{key}.pickle"
        
        try:
            with open(cache_file, 'wb') as f:
                pickle.dump(result, f)
            logger.info(f"Saved to cache: {action}")
        except Exception as e:
            logger.error(f"Error writing to cache: {e}")

# Initialize cache
cache = SimpleCache()

try:
    from secret_ai_writer.ai_core.ai_integration import SecretAIWriter
    from secret_ai_writer.ai_core.secret_ai_client import ConfidentialWriter
    logger.info("Successfully imported SecretAIWriter")
except ImportError as e:
    logger.error(f"Failed to import SecretAIWriter: {str(e)}")
    traceback.print_exc()
    print(json.dumps({"error": f"Import error: {str(e)}"}))
    sys.exit(1)

def main():
    try:
        # Read command line arguments
        action = sys.argv[1]
        data = json.loads(sys.argv[2])
        
        logger.info(f"Processing action: {action}")
        
        # Check cache for generate and enhance actions
        if action in ["generate", "enhance"]:
            cached_result = cache.get(action, data)
            if cached_result:
                print(json.dumps(cached_result))
                return
        
        # Handle different actions
        if action == "generate":
            # Initialize the AI writer
            writer = SecretAIWriter()
            logger.info(f"Initialized SecretAIWriter")
            
            prompt = data.get("prompt", "")
            user_address = data.get("user_address", "dev_mode_address")
            system_instruction = data.get("system_instruction")
            
            result = writer.generate_content(prompt, user_address, system_instruction)
            
            # Cache the result
            cache.set(action, data, result)
            
            print(json.dumps(result))
            
        elif action == "enhance":
            # Initialize the AI writer
            writer = SecretAIWriter()
            logger.info(f"Initialized SecretAIWriter")
            
            draft_text = data.get("draft_text", "")
            enhancement_type = data.get("enhancement_type", "grammar")
            user_address = data.get("user_address", "dev_mode_address")
            
            result = writer.enhance_writing(draft_text, enhancement_type, user_address)
            
            # Cache the result
            cache.set(action, data, result)
            
            print(json.dumps(result))
        
        elif action == "store":
            # Initialize the confidential writer
            writer = ConfidentialWriter()
            logger.info(f"Initialized ConfidentialWriter for storage")
            
            content = data.get("content", "")
            user_address = data.get("user_address", "dev_mode_address")
            metadata = data.get("metadata", {})
            
            result = writer.store_draft(content, metadata)
            print(json.dumps(result))
            
        elif action == "retrieve":
            # Initialize the confidential writer
            writer = ConfidentialWriter()
            logger.info(f"Initialized ConfidentialWriter for retrieval")
            
            user_address = data.get("user_address", "dev_mode_address")
            
            result = writer.retrieve_draft(user_address)
            print(json.dumps(result))
            
        else:
            logger.error(f"Unknown action: {action}")
            print(json.dumps({"error": f"Unknown action: {action}"}))
            
    except Exception as e:
        logger.error(f"Error in AI bridge: {str(e)}")
        traceback.print_exc()
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
  