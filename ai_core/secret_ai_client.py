from secret_ai_sdk import SecretAIClient
from langchain_core.messages import HumanMessage, SystemMessage

class ConfidentialWriter:
    def __init__(self, api_key: str):
        self.client = SecretAIClient(
            base_url="https://ai.scrt.network",
            api_key=api_key,
            encrypted_comms=True  # Enable native Secret encryption
        )
        
    def analyze_draft(self, text: str) -> str:
        """Securely analyze writing with confidential AI"""
        messages = [
            SystemMessage(content="You are a professional writing assistant. Provide detailed feedback on grammar, style, and narrative flow while keeping all content encrypted."),
            HumanMessage(content=text)
        ]
        response = self.client.invoke(messages, stream=False)
        return self._decrypt_response(response)

    def _decrypt_response(self, encrypted_data: bytes) -> str:
        """Use Secret Network's native decryption"""
        from secret_sdk.client.lcd import LCDClient
        secret = LCDClient(chain_id="secret-4", url="https://lcd.secret.express")
        return secret.encryption.decrypt(encrypted_data)