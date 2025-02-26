# secret_ai_writer/ai_core/ai_integration.py
import os
import json
import logging
import time
from typing import Dict, List, Optional, Any
from decouple import config
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from .confidential_chain import PrivateMetadata

logger = logging.getLogger(__name__)

class SecretAIWriter:
    def __init__(self):
        """Initialize the Secret AI Writer with AI service and blockchain integration"""
        try:
            # Try to set up Ollama
            ollama_base_url = config("OLLAMA_BASE_URL", default="http://localhost:11434")
            ollama_model = config("OLLAMA_MODEL", default="llama2")
            
            # Initialize Ollama
            self.llm = ChatOllama(
                base_url=ollama_base_url,
                model=ollama_model,
                temperature=0.7,
            )
            
            # Initialize blockchain connection
            self.metadata_handler = PrivateMetadata()
            
            logger.info(f"SecretAIWriter initialized successfully with Ollama model: {ollama_model}")
            
        except Exception as e:
            logger.error(f"Failed to initialize SecretAIWriter: {str(e)}")
            raise
    
    def generate_content(self, prompt: str, user_address: str, 
                        system_instruction: Optional[str] = None) -> Dict[str, Any]:
        """Generate AI content and store metadata on Secret Network
        
        Args:
            prompt: User's writing prompt
            user_address: Secret Network address for the user
            system_instruction: Optional custom system prompt
            
        Returns:
            Dictionary with generated content and metadata
        """
        try:
            start_time = time.time()
            
            # Default system instruction if none provided
            if not system_instruction:
                system_instruction = """You are a helpful AI writing assistant. 
                Provide creative, well-structured content while maintaining the user's privacy.
                Focus on clarity, engagement, and proper grammar."""
            
            # Create messages for the LLM
            messages = [
                SystemMessage(content=system_instruction),
                HumanMessage(content=prompt)
            ]
            
            # Generate content
            response = self.llm.invoke(messages)
            generated_content = response.content
            
            # Calculate metadata
            end_time = time.time()
            token_estimate = len(prompt.split()) + len(generated_content.split())
            
            # Create metadata object
            metadata = {
                "timestamp": int(time.time()),
                "prompt_length": len(prompt),
                "response_length": len(generated_content),
                "processing_time": round(end_time - start_time, 2),
                "estimated_tokens": token_estimate,
                "model": config("OLLAMA_MODEL", default="llama2"),
                "content_type": "text"
            }
            
            # Store metadata on Secret Network (privacy-preserving)
            try:
                tx_result = self.metadata_handler.store_usage_stats(
                    user_address=user_address,
                    metadata=metadata
                )
                metadata["tx_hash"] = tx_result.txhash
            except Exception as meta_err:
                logger.warning(f"Failed to store metadata, but content generation succeeded: {str(meta_err)}")
                metadata["tx_hash"] = None
            
            return {
                "content": generated_content,
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Content generation failed: {str(e)}")
            raise
    
    def enhance_writing(self, draft_text: str, enhancement_type: str, 
                       user_address: str) -> Dict[str, Any]:
        """Enhance existing writing with specific improvements
        
        Args:
            draft_text: Existing text to improve
            enhancement_type: Type of enhancement (grammar, creativity, conciseness, etc.)
            user_address: Secret Network address
            
        Returns:
            Enhanced content and metadata
        """
        enhancement_prompts = {
            "grammar": "Improve the grammar and correct any errors in this text while preserving meaning:",
            "creativity": "Make this text more creative and engaging while preserving key points:",
            "conciseness": "Make this text more concise without losing important information:",
            "professional": "Make this text more professional and formal:",
            "casual": "Make this text more casual and conversational:"
        }
        
        prompt = enhancement_prompts.get(
            enhancement_type, 
            "Improve this text while maintaining its core meaning:"
        )
        
        system_instruction = f"""You are a writing enhancement specialist focused on {enhancement_type}.
        Provide the improved version without explaining your changes unless asked."""
        
        return self.generate_content(
            prompt=f"{prompt}\n\n{draft_text}",
            user_address=user_address,
            system_instruction=system_instruction
        )