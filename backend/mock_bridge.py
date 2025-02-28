import sys
import json
import logging
import time
import random
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_mock_content(prompt, enhancement_type=None):
    """Generate mock content without using the problematic SecretAIWriter"""
    logger.info(f"Generating mock content for prompt: {prompt[:50]}...")
    
    if enhancement_type:
        # For enhancement requests
        templates = [
            f"This is the enhanced version with {enhancement_type} improvements:\n\n{prompt}\n\nThe above text has been refined to better communicate the core message while maintaining the original intent.",
            f"After applying {enhancement_type} enhancements:\n\n{prompt}\n\nThis improved version addresses the key requirements while ensuring clarity and effectiveness."
        ]
    else:
        # For generation requests
        templates = [
            f"Here is content about '{prompt}':\n\nThe {prompt} represents a significant aspect of modern technology and privacy. When considering its implications for Secret Network, we must evaluate both the benefits and potential challenges.\n\nSecret Network provides privacy-preserving smart contracts that allow for confidential computation. This is crucial for DeFi applications, private voting systems, and confidential AI solutions. By leveraging encryption technologies, Secret Network ensures that sensitive data remains protected while still enabling useful computations.\n\nThe integration of privacy features with decentralized AI (DeAI) creates a powerful combination that addresses many concerns in the current AI landscape. Traditional AI systems often collect vast amounts of user data without adequate protection, raising serious privacy concerns. Secret Network's approach allows for AI models to be trained and operated on encrypted data, ensuring user privacy is maintained throughout the process.",
            
            f"Analysis of {prompt}:\n\nThe Secret Network has emerged as a leading privacy-focused blockchain platform, offering a unique solution to the challenges faced by both users and developers in the Web3 space. Its implementation of confidential computing creates an environment where data can remain encrypted even during processing.\n\nWhen examining DeAI (Decentralized Artificial Intelligence) in the context of Secret Network, several advantages become apparent:\n\n1. Privacy-Preserving AI: Models can process sensitive data without exposing the underlying information\n2. Secure Data Marketplaces: Users can monetize their data without compromising privacy\n3. Transparent Governance: AI systems can be audited while protecting proprietary algorithms\n4. Reduced Data Silos: Data can be shared across organizations while maintaining confidentiality\n\nThese capabilities represent a paradigm shift in how AI systems can be designed and deployed, addressing many of the ethical and privacy concerns surrounding current AI implementations."
        ]
    
    # Random delay to simulate processing time
    process_time = random.uniform(2.0, 4.0)
    time.sleep(process_time)
    
    content = random.choice(templates)
    
    return {
        "content": content,
        "metadata": {
            "timestamp": int(time.time()),
            "prompt_length": len(prompt),
            "response_length": len(content),
            "processing_time": process_time,
            "estimated_tokens": random.randint(300, 600),
            "model": "mock-generation-model",
            "content_type": "text",
            "mock_generation": True
        }
    }

def main():
    try:
        # Read command line arguments
        action = sys.argv[1]
        data = json.loads(sys.argv[2])
        
        logger.info(f"Processing action: {action}")
        
        # Handle different actions
        if action == "generate":
            prompt = data.get("prompt", "")
            user_address = data.get("user_address", "dev_mode_address")
            
            result = generate_mock_content(prompt)
            print(json.dumps(result))
            
        elif action == "enhance":
            draft_text = data.get("draft_text", "")
            enhancement_type = data.get("enhancement_type", "grammar")
            
            result = generate_mock_content(draft_text, enhancement_type)
            print(json.dumps(result))
        
        elif action == "store" or action == "retrieve":
            # These actions are handled by mock_service.js in Node
            print(json.dumps({"success": True, "mock": True}))
            
        else:
            logger.error(f"Unknown action: {action}")
            print(json.dumps({"error": f"Unknown action: {action}"}))
            
    except Exception as e:
        logger.error(f"Error in mock bridge: {str(e)}")
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()