# ai_core/confidential_chain.py
from secret_ai_sdk import SecretChain

class PrivateMetadata:
    def __init__(self):
        self.chain = SecretChain("secret-4")
        
    def store_usage_stats(self, user: str, encrypted_metadata: bytes):
        """Store encrypted metadata on-chain"""
        self.chain.execute_contract(
            contract_addr=os.getenv("CONTRACT_ADDR"),
            msg={"store_metadata": {"user": user, "data": encrypted_metadata}},
            private=True  # Hide transaction details
        )