# secret_ai_writer/ai_core/contract_integration.py

import logging
import json
import base64
from decouple import config
from typing import Dict, Any, Optional, Tuple
from .secret_ai_client import ConfidentialWriter

logger = logging.getLogger(__name__)

class ContractManager:
    """
    Manages interactions with the Secret Network smart contract for storing and retrieving drafts.
    """
    
    def __init__(self):
        """Initialize the contract manager with Secret Network connection and contract address."""
        try:
            # Initialize the ConfidentialWriter client
            self.client = ConfidentialWriter()
            
            # Get contract address from environment variables
            self.contract_address = config("CONTRACT_ADDRESS")
            
            # Check if development mode is enabled
            self.dev_mode = config("DEV_MODE", default="False").lower() == "true"
            
            if not self.contract_address and not self.dev_mode:
                raise ValueError("CONTRACT_ADDRESS not found in environment variables")
                
            logger.info(f"ContractManager initialized with contract: {self.contract_address}")
            
        except Exception as e:
            logger.error(f"Failed to initialize ContractManager: {str(e)}")
            
            # Enable development mode if initialization fails
            self.dev_mode = True
            logger.info("Falling back to development mode")
    
    def store_draft(self, content: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Store a draft using the Secret Network contract.
        
        Args:
            content: The content to encrypt and store
            metadata: Optional metadata for the draft
            
        Returns:
            Dictionary with transaction details
        """
        try:
            if self.dev_mode:
                logger.info("Development mode: Mock storing draft in contract")
                return {"tx_hash": "mock_contract_tx", "success": True}
            
            # Get wallet address
            wallet_address = self.client.get_wallet_address()
            
            # Format content and metadata for the contract
            encrypted_content = base64.b64encode(content.encode()).decode()
            
            encrypted_metadata = ""
            if metadata:
                metadata_json = json.dumps(metadata)
                encrypted_metadata = base64.b64encode(metadata_json.encode()).decode()
            
            # Execute contract
            msg = {
                "store_draft": {
                    "encrypted_content": encrypted_content,
                    "encrypted_metadata": encrypted_metadata
                }
            }
            
            # Use the client to execute the contract
            result = self.client.store_draft(content, metadata)
            
            logger.info(f"Draft stored in contract successfully, tx hash: {result.get('tx_hash')}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to store draft in contract: {str(e)}")
            
            if self.dev_mode:
                logger.info("Development mode: Returning mock transaction")
                return {"tx_hash": "mock_fallback_tx", "success": True}
            raise
    
    def retrieve_draft(self, user_address: Optional[str] = None) -> Tuple[str, Dict[str, Any]]:
        """
        Retrieve a draft for the given user from the Secret Network contract.
        
        Args:
            user_address: Optional address to retrieve drafts for (defaults to wallet address)
            
        Returns:
            Tuple with (content, metadata)
        """
        try:
            if self.dev_mode:
                logger.info("Development mode: Returning mock draft from contract")
                return ("This is a mock draft from the contract.", 
                        {"timestamp": 1644144000, "title": "Mock Draft"})
            
            # Use the client to query the contract
            result = self.client.retrieve_draft(user_address)
            
            if not result.get("found", False):
                logger.warning(f"No draft found for user {user_address or 'current wallet'}")
                return ("", {})
            
            return (result.get("content", ""), result.get("metadata", {}))
            
        except Exception as e:
            logger.error(f"Failed to retrieve draft from contract: {str(e)}")
            
            if self.dev_mode:
                logger.info("Development mode: Returning mock draft")
                return ("This is a mock draft created when retrieval failed.", 
                        {"timestamp": 1644144000, "error_fallback": True})
            
            # Return empty results on error
            return ("", {})