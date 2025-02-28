#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Print colored output
function log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

function success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

function warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

function error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if secretcli is installed
if ! command -v secretcli &> /dev/null; then
    error "secretcli is not installed. Please install Secret Network CLI first."
    exit 1
fi

# Print secretcli version
log "Checking secretcli version:"
secretcli version

# List of testnet endpoints to try
ENDPOINTS=(
    "https://lcd.testnet.secretsaturn.net"
    "https://pulsar-2.api.trivium.network:1317"
    "https://api.pulsar.scrttestnet.com"
    "https://test-secret-4.api.consensus.one/lcd"
    "https://testnet.securesecrets.org:1317"
)

log "Testing connectivity to Secret Network testnet nodes..."

# Test each endpoint
for ENDPOINT in "${ENDPOINTS[@]}"; do
    log "Testing $ENDPOINT..."
    
    # First try to get node status
    if curl -s --connect-timeout 5 "$ENDPOINT/node_info" > /dev/null; then
        success "✅ Successfully connected to $ENDPOINT"
        
        # Try chain ID lookup
        CHAIN_ID=$(curl -s "$ENDPOINT/node_info" | jq -r '.node_info.network' 2>/dev/null || echo "unknown")
        if [ "$CHAIN_ID" != "unknown" ] && [ ! -z "$CHAIN_ID" ]; then
            success "✅ Chain ID: $CHAIN_ID"
        else
            warning "⚠️ Could not determine chain ID"
        fi
        
        # Try a simple secretcli query
        log "Testing secretcli query with this endpoint..."
        if secretcli q staking validators --node $ENDPOINT --limit 1 2>/dev/null; then
            success "✅ secretcli query successful!"
            echo "WORKING_ENDPOINT=$ENDPOINT" > testnet_endpoint.env
            echo "CHAIN_ID=$CHAIN_ID" >> testnet_endpoint.env
            log "Saved working endpoint to testnet_endpoint.env"
            log "For deployment, use:"
            echo "secretcli tx compute store [...] --node $ENDPOINT --chain-id $CHAIN_ID"
            exit 0
        else
            warning "⚠️ secretcli query failed for this endpoint"
        fi
    else
        error "❌ Failed to connect to $ENDPOINT"
    fi
    
    echo "-----------------------------------"
done

log "Testing secretcli configuration..."
secretcli config
echo "-----------------------------------"

error "❌ Could not connect to any Secret Network testnet node."
log "The testnet may be temporarily unavailable or undergoing maintenance."
log "You can continue with local development using:"
echo "./deploy_contract.sh"
log "Try again later for testnet deployment."