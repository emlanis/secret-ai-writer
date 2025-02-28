#!/bin/bash
set -e

# Configuration (should match deploy_contract.sh)
CHAIN_ID="pulsar-3"  # Use "secret-4" for mainnet
NODE="https://lcd.testnet.secretsaturn.net"  # Use "https://lcd.secret.express" for mainnet
WALLET_NAME="secret-writer-wallet"  # Change to your key name

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
function log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

function success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

function error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if the secretcli command is available
if ! command -v secretcli &> /dev/null; then
    error "secretcli is not installed. Please install Secret Network CLI first."
fi

# Load contract address from .env file
if [ -f "../secret_ai_writer/.env_contract" ]; then
    source "../secret_ai_writer/.env_contract"
    log "Loaded contract address: $CONTRACT_ADDRESS"
else
    # Try to load from .env file
    if [ -f "../secret_ai_writer/.env" ]; then
        source "../secret_ai_writer/.env"
        log "Loaded contract address from .env: $CONTRACT_ADDRESS"
    else
        error "Contract address not found. Please run deploy_contract.sh first or set CONTRACT_ADDRESS manually."
    fi
fi

if [ -z "$CONTRACT_ADDRESS" ]; then
    error "CONTRACT_ADDRESS is not set. Please run deploy_contract.sh first or set manually."
fi

# Test storing a draft
log "Testing store_draft function..."
ENCRYPTED_CONTENT=$(echo "This is a test draft" | base64)
ENCRYPTED_METADATA=$(echo '{"timestamp": '$(date +%s)', "title": "Test Draft"}' | base64)

STORE_RESULT=$(secretcli tx compute execute $CONTRACT_ADDRESS '{"store_draft": {"encrypted_content": "'$ENCRYPTED_CONTENT'", "encrypted_metadata": "'$ENCRYPTED_METADATA'"}}' --from $WALLET_NAME --chain-id $CHAIN_ID --node $NODE --gas-prices 0.25uscrt --gas 300000 -y)
echo "$STORE_RESULT"
success "Draft stored successfully"

# Get wallet address
WALLET_ADDRESS=$(secretcli keys show $WALLET_NAME -a)

# Test querying a draft
log "Testing get_draft function for address $WALLET_ADDRESS..."
QUERY_RESULT=$(secretcli query compute query $CONTRACT_ADDRESS '{"get_draft": {"address": "'$WALLET_ADDRESS'"}}')
echo "$QUERY_RESULT"

# Extract and decode the encrypted content
RETRIEVED_CONTENT=$(echo "$QUERY_RESULT" | jq -r '.encrypted_content' | base64 --decode 2>/dev/null || echo "Failed to decode content")
RETRIEVED_METADATA=$(echo "$QUERY_RESULT" | jq -r '.encrypted_metadata' | base64 --decode 2>/dev/null || echo "Failed to decode metadata")

log "Retrieved draft content: $RETRIEVED_CONTENT"
log "Retrieved draft metadata: $RETRIEVED_METADATA"

# Test config query
log "Testing get_config function..."
CONFIG_RESULT=$(secretcli query compute query $CONTRACT_ADDRESS '{"get_config": {}}')
echo "$CONFIG_RESULT"

# Test deleting a draft
log "Testing delete_draft function..."
DELETE_RESULT=$(secretcli tx compute execute $CONTRACT_ADDRESS '{"delete_draft": {}}' --from $WALLET_NAME --chain-id $CHAIN_ID --node $NODE --gas-prices 0.25uscrt --gas 300000 -y)
echo "$DELETE_RESULT"
success "Draft deleted successfully"

# Verify deletion
log "Verifying draft was deleted..."
QUERY_AFTER_DELETE=$(secretcli query compute query $CONTRACT_ADDRESS '{"get_draft": {"address": "'$WALLET_ADDRESS'"}}' 2>&1 || echo "Draft not found")
if [[ "$QUERY_AFTER_DELETE" == *"Draft not found"* ]]; then
    success "Deletion verified - draft no longer exists"
else
    error "Draft still exists after deletion"
fi

success "All tests completed successfully!"