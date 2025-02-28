#!/bin/bash
set -e

# Configuration
CHAIN_ID="pulsar-3"  # Use "secret-4" for mainnet
NODE="https://lcd.testnet.secretsaturn.net"  # Use "https://lcd.secret.express" for mainnet
CONTRACT_NAME="secret_ai_writer"  # Note: using underscore instead of hyphen
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

# Check if the wallet exists
secretcli keys show $WALLET_NAME &> /dev/null || error "Wallet '$WALLET_NAME' not found. Create it first with 'secretcli keys add $WALLET_NAME'"

# Set the working directory to the contract folder
cd "$(dirname "$0")/../contracts"

# Build the contract
log "Building contract..."
cargo build --release --target wasm32-unknown-unknown

# Verify the WASM file exists
WASM_FILE="target/wasm32-unknown-unknown/release/${CONTRACT_NAME}.wasm"
if [ ! -f "$WASM_FILE" ]; then
    # Try alternate filename with hyphens instead of underscores
    CONTRACT_NAME_HYPHEN="secret-ai-writer"
    WASM_FILE="target/wasm32-unknown-unknown/release/${CONTRACT_NAME_HYPHEN}.wasm"
    
    if [ ! -f "$WASM_FILE" ]; then
        # List available wasm files to help debug
        log "Looking for any available WASM files..."
        find target/wasm32-unknown-unknown/release -name "*.wasm" -type f
        
        error "WASM file not found at $WASM_FILE. Check the CONTRACT_NAME and build output."
    else
        log "Found WASM file with hyphenated name: $WASM_FILE"
        CONTRACT_NAME="$CONTRACT_NAME_HYPHEN"
    fi
fi

# Optimize the wasm file if wasm-opt is available
log "Optimizing WASM..."
if command -v wasm-opt &> /dev/null; then
    mkdir -p artifacts
    wasm-opt -Oz "$WASM_FILE" -o "artifacts/${CONTRACT_NAME}.wasm" || error "Failed to optimize WASM"
else
    log "wasm-opt not found. Copying unoptimized WASM file."
    mkdir -p artifacts
    cp "$WASM_FILE" "artifacts/${CONTRACT_NAME}.wasm" || error "Failed to copy WASM file"
fi

success "WASM file prepared at artifacts/${CONTRACT_NAME}.wasm"

# Upload the contract to the network
log "Uploading contract to $CHAIN_ID..."
UPLOAD_RESULT=$(secretcli tx compute store "artifacts/${CONTRACT_NAME}.wasm" --from $WALLET_NAME --chain-id $CHAIN_ID --node $NODE --gas-prices 0.25uscrt --gas 3000000 -y)
echo "$UPLOAD_RESULT"

# Extract code ID - try different methods
CODE_ID=$(echo "$UPLOAD_RESULT" | jq -r '.logs[0].events[] | select(.type=="message") | .attributes[] | select(.key=="code_id") | .value' 2>/dev/null)
if [ -z "$CODE_ID" ]; then
    CODE_ID=$(echo "$UPLOAD_RESULT" | jq -r '.logs[0].events[] | select(.type=="store_code") | .attributes[] | select(.key=="code_id") | .value' 2>/dev/null)
fi
if [ -z "$CODE_ID" ]; then
    # If jq extraction failed, try grep
    CODE_ID=$(echo "$UPLOAD_RESULT" | grep -oP 'code_id: \K[0-9]+' | head -1)
fi

if [ -z "$CODE_ID" ]; then
    error "Failed to extract code ID from upload result"
fi

success "Contract uploaded with code ID: $CODE_ID"

# Instantiate the contract
log "Instantiating contract..."
INIT_RESULT=$(secretcli tx compute instantiate $CODE_ID '{"owner": null}' --from $WALLET_NAME --label "$CONTRACT_NAME-$(date +%s)" --chain-id $CHAIN_ID --node $NODE --gas-prices 0.25uscrt --gas 300000 -y)
echo "$INIT_RESULT"

# Extract contract address - try different methods
CONTRACT_ADDRESS=$(echo "$INIT_RESULT" | jq -r '.logs[0].events[] | select(.type=="message") | .attributes[] | select(.key=="contract_address") | .value' 2>/dev/null)
if [ -z "$CONTRACT_ADDRESS" ]; then
    CONTRACT_ADDRESS=$(echo "$INIT_RESULT" | jq -r '.logs[0].events[] | select(.type=="instantiate") | .attributes[] | select(.key=="contract_address") | .value' 2>/dev/null)
fi
if [ -z "$CONTRACT_ADDRESS" ]; then
    # If jq extraction failed, try grep
    CONTRACT_ADDRESS=$(echo "$INIT_RESULT" | grep -oP 'contract_address: \K[a-z0-9]+' | head -1)
fi

if [ -z "$CONTRACT_ADDRESS" ]; then
    error "Failed to extract contract address from instantiate result"
fi

success "Contract instantiated with address: $CONTRACT_ADDRESS"

# Save the contract address to the .env file
echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" > ../secret_ai_writer/.env_contract
success "Contract address saved to ../secret_ai_writer/.env_contract"

# Instructions for next steps
log "Deployment complete! To use this contract, add the CONTRACT_ADDRESS to your .env file:"
echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS"