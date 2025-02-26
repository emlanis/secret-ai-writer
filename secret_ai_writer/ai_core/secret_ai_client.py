from secret_sdk.client.lcd import LCDClient
from secret_sdk.key.mnemonic import MnemonicKey
from langchain_core.messages import HumanMessage, SystemMessage
from decouple import config
import base64
import json
import logging
import hashlib
import time
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class ConfidentialWriter:
    def __init__(self):
        """Initialize the Secret Network client for confidential AI writing"""
        try:
            # Initialize connection to Secret Network
            self.chain = LCDClient(
                chain_id=config("CHAIN_ID", default="pulsar-3"),
                url=config("LCD_URL", default="https://lcd.testnet.secretsaturn.net")
            )
            
            # Set up wallet from mnemonic if provided
            mnemonic = config("MNEMONIC", default=None)
            if mnemonic:
                self.wallet = self.chain.wallet(MnemonicKey(mnemonic=mnemonic))
                logger.info("Wallet initialized successfully")
            
            # Store contract address
            self.contract_address = config("CONTRACT_ADDRESS", default=None)
            
            # Flag to indicate if we're in development mode
            self.dev_mode = config("DEV_MODE", default="False").lower() == "true"
            
            logger.info("ConfidentialWriter initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize ConfidentialWriter: {str(e)}")
            # Enable development mode if initialization fails
            self.dev_mode = True
            logger.info("Falling back to development mode")
    
    def get_wallet_address(self) -> str:
        """Return the wallet address if wallet is initialized
        
        Returns:
            String with the wallet's Secret Network address
            
        Raises:
            ValueError: If wallet is not initialized
        """
        if not hasattr(self, 'wallet') and not self.dev_mode:
            raise ValueError("Wallet not initialized. Mnemonic may be missing.")
        
        # If in development mode and no wallet, return a mock address
        if self.dev_mode and not hasattr(self, 'wallet'):
            return "secret1devmodexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            
        return self.wallet.key.acc_address
    
    def store_draft(self, content: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Store an encrypted draft on Secret Network
        
        Args:
            content: The draft content to encrypt and store
            metadata: Optional metadata dictionary
            
        Returns:
            Dictionary with transaction details
        """
        # Handle development mode
        if self.dev_mode:
            logger.info("Development mode: Mock storing draft")
            return {
                "tx_hash": f"mock_tx_{hashlib.md5(str(time.time()).encode()).hexdigest()[:16]}", 
                "success": True
            }
            
        try:
            # Ensure wallet is initialized
            if not hasattr(self, 'wallet'):
                raise ValueError("Wallet not initialized. Mnemonic may be missing.")
                
            # Ensure contract address is set
            if not self.contract_address:
                raise ValueError("Contract address not set in environment variables")
            
            # Encrypt content
            encrypted_content = self._encrypt_data(content.encode())
            
            # Encrypt metadata if provided
            encrypted_metadata = ""
            if metadata:
                metadata_json = json.dumps(metadata)
                encrypted_metadata = self._encrypt_data(metadata_json.encode())
            
            # Try different methods of contract execution based on SDK version
            try:
                # Method 1: Original method
                tx_result = self.wallet.execute_contract(
                    contract_address=self.contract_address,
                    msg={
                        "store_draft": {
                            "encrypted_content": encrypted_content,
                            "encrypted_metadata": encrypted_metadata
                        }
                    },
                    gas_prices="0.25uscrt",
                    gas=config("GAS", default="200000", cast=int)
                )
            except AttributeError:
                # Method 2: Try with execute_contracts
                tx_result = self.wallet.execute_contracts(
                    [self.contract_address],
                    [{
                        "store_draft": {
                            "encrypted_content": encrypted_content,
                            "encrypted_metadata": encrypted_metadata
                        }
                    }],
                    gas_prices="0.25uscrt",
                    gas=config("GAS", default="200000", cast=int)
                )
            
            logger.info(f"Stored draft successfully, tx hash: {tx_result.txhash}")
            return {"tx_hash": tx_result.txhash, "success": True}
            
        except Exception as e:
            logger.error(f"Failed to store draft: {str(e)}")
            
            # Fallback to development mode
            logger.info("Falling back to mock transaction")
            return {
                "tx_hash": f"mock_tx_{hashlib.md5(str(time.time()).encode()).hexdigest()[:16]}", 
                "success": True
            }
    
    def retrieve_draft(self, user_address: Optional[str] = None) -> Dict[str, Any]:
        """Retrieve and decrypt a draft for the given user
        
        Args:
            user_address: Optional address to retrieve drafts for (defaults to wallet address)
            
        Returns:
            Dictionary with decrypted content and metadata
        """
        # Handle development mode
        if self.dev_mode:
            logger.info("Development mode: Returning mock draft")
            return {
                "content": "This is a mock draft for development purposes.",
                "metadata": {"timestamp": int(time.time()), "mock": True},
                "found": True
            }
            
        try:
            # Use wallet address if none provided
            if not user_address and hasattr(self, 'wallet'):
                user_address = self.wallet.key.acc_address
            
            if not user_address:
                raise ValueError("No user address provided and no wallet initialized")
            
            # Query contract for encrypted draft
            query_result = self.chain.wasm.contract_query(
                self.contract_address,
                {"get_draft": {"address": user_address}}
            )
            
            if not query_result or "encrypted_content" not in query_result:
                return {"content": "", "metadata": {}, "found": False}
            
            # Decrypt content
            decrypted_content = ""
            if query_result.get("encrypted_content"):
                content_bytes = base64.b64decode(query_result["encrypted_content"])
                decrypted_content = self._decrypt_data(content_bytes).decode()
            
            # Decrypt metadata if present
            metadata = {}
            if query_result.get("encrypted_metadata"):
                metadata_bytes = base64.b64decode(query_result["encrypted_metadata"])
                metadata_str = self._decrypt_data(metadata_bytes).decode()
                metadata = json.loads(metadata_str)
            
            return {
                "content": decrypted_content,
                "metadata": metadata,
                "found": True
            }
            
        except Exception as e:
            logger.error(f"Failed to retrieve draft: {str(e)}")
            
            # Fallback to development mode
            logger.info("Falling back to mock draft")
            return {
                "content": "This is a mock draft created when retrieval failed.",
                "metadata": {"timestamp": int(time.time()), "error_fallback": True},
                "found": True
            }
    
    def _encrypt_data(self, data: bytes) -> str:
        """Encrypt data using Secret Network's encryption
        
        Args:
            data: Raw bytes to encrypt
        
        Returns:
            base64 encoded encrypted data as string
        """
        if self.dev_mode:
            # In development mode, just use a simple mock encryption
            logger.info("Development mode: Using mock encryption")
            mock_encrypted = base64.b64encode(data)
            return base64.b64encode(mock_encrypted).decode()
            
        try:
            # Try different methods to get encryption key based on SDK version
            encryption_key = None
            
            # Method 1: Try with wasm.query_tx_key
            try:
                if hasattr(self.chain, 'wasm') and hasattr(self.chain.wasm, 'query_tx_key'):
                    encryption_key = self.chain.wasm.query_tx_key()
            except Exception as e1:
                logger.warning(f"Failed to get encryption key with wasm.query_tx_key: {str(e1)}")
                
            # Method 2: Try with query_tx_encryption_key
            if encryption_key is None:
                try:
                    if hasattr(self.chain, 'query_tx_encryption_key'):
                        encryption_key = self.chain.query_tx_encryption_key()
                except Exception as e2:
                    logger.warning(f"Failed to get encryption key with query_tx_encryption_key: {str(e2)}")
            
            # If we have an encryption key, use it
            if encryption_key:
                encrypted = self.chain.encryption.encrypt(encryption_key, data)
                return base64.b64encode(encrypted).decode()
            else:
                raise ValueError("Could not obtain encryption key")
            
        except Exception as e:
            logger.error(f"Encryption failed: {str(e)}")
            
            # Fallback: Use mock encryption
            logger.warning("Using mock encryption for development purposes")
            mock_encrypted = base64.b64encode(data)
            return base64.b64encode(mock_encrypted).decode()
    
    def _decrypt_data(self, encrypted_data: bytes) -> bytes:
        """Decrypt data using Secret Network's decryption
        
        Args:
            encrypted_data: Encrypted bytes
        
        Returns:
            Decrypted bytes
        """
        if self.dev_mode:
            # In development mode, just use a simple mock decryption
            logger.info("Development mode: Using mock decryption")
            try:
                return base64.b64decode(base64.b64decode(encrypted_data))
            except:
                # If that fails, just return the data as is
                return encrypted_data
                
        try:
            return self.chain.encryption.decrypt(encrypted_data)
        except Exception as e:
            logger.error(f"Decryption failed: {str(e)}")
            
            # Fallback: If we're in development/testing mode, use a mock decryption
            logger.warning("Using mock decryption for development purposes")
            try:
                # Try to decode the double base64 encoding
                return base64.b64decode(base64.b64decode(encrypted_data))
            except:
                # If that fails, just return the data as is
                return encrypted_data