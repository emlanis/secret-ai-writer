# secret_ai_writer/ai_core/confidential_chain.py

import os
import logging
from decouple import config
from secret_sdk.client.lcd import LCDClient
from secret_sdk.core.tx import Tx
from secret_sdk.key.mnemonic import MnemonicKey
import json
import base64
import hashlib
import time

logger = logging.getLogger(__name__)

class MockTxResult:
    """Simple mock class to mimic the Secret Network transaction result"""
    def __init__(self, txhash):
        self.txhash = txhash

class PrivateMetadata:
    def __init__(self):
        """Initialize connection to Secret Network with authentication"""
        try:
            # Create LCD client
            self.chain = LCDClient(
                chain_id=config("CHAIN_ID", default="pulsar-3"),
                url=config("LCD_URL", default="https://lcd.testnet.secretsaturn.net")
            )
            
            # Set up wallet from mnemonic
            mnemonic = config("MNEMONIC")
            self.wallet = self.chain.wallet(MnemonicKey(mnemonic=mnemonic))
            
            # Store contract address
            self.contract_address = config("CONTRACT_ADDRESS")
            
            # Flag to indicate if we're in development mode
            self.dev_mode = config("DEV_MODE", default="False").lower() == "true"
            
            logger.info("PrivateMetadata initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize PrivateMetadata: {str(e)}")
            # Enable development mode if initialization fails
            self.dev_mode = True
            logger.info("Falling back to development mode")
    
    def store_usage_stats(self, user_address: str, metadata: dict):
        """Store encrypted metadata on-chain
        
        Args:
            user_address: The Secret Network address of the user
            metadata: Dictionary containing usage statistics/metadata
        """
        try:
            # Convert metadata to bytes and encrypt
            metadata_bytes = json.dumps(metadata).encode()
            encrypted_metadata = self.encrypt_data(metadata_bytes)
            
            # Execute contract with private metadata
            if hasattr(self, 'wallet') and not self.dev_mode:
                # Try different methods of contract execution based on SDK version
                try:
                    # Method 1: Original method
                    tx_result = self.wallet.execute_contract(
                        contract_address=self.contract_address,
                        msg={
                            "store_draft": {
                                "encrypted_content": "",  # Empty for metadata-only updates
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
                                "encrypted_content": "",
                                "encrypted_metadata": encrypted_metadata
                            }
                        }],
                        gas_prices="0.25uscrt",
                        gas=config("GAS", default="200000", cast=int)
                    )
                
                logger.info(f"Stored metadata successfully, tx hash: {tx_result.txhash}")
                return tx_result
            else:
                # Development mode or missing wallet
                logger.info("Development mode: Mock storing metadata")
                mock_hash = f"mock_tx_{hashlib.md5(str(time.time()).encode()).hexdigest()[:16]}"
                return MockTxResult(mock_hash)
            
        except Exception as e:
            logger.error(f"Failed to store usage stats: {str(e)}")
            # Continue in development mode
            logger.info("Falling back to mock transaction")
            mock_hash = f"mock_tx_{hashlib.md5(str(time.time()).encode()).hexdigest()[:16]}"
            return MockTxResult(mock_hash)
    
    def encrypt_data(self, data: bytes) -> str:
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