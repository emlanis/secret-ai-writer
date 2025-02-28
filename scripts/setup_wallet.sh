#!/bin/bash
set -e

# Configuration
WALLET_NAME="secret-writer-wallet"  # Change this to your preferred key name
KEYRING_BACKEND="test"  # Use "os" for more secure storage
NODE_URL="https://lcd.testnet.secretsaturn.net"  # Testnet node URL

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

# Check if wallet already exists
if secretcli keys show $WALLET_NAME --keyring-backend $KEYRING_BACKEND &> /dev/null; then
    log "Wallet '$WALLET_NAME' already exists."
    read -p "Do you want to overwrite it? (y/n): " OVERWRITE
    if [[ $OVERWRITE != "y" && $OVERWRITE != "Y" ]]; then
        log "Keeping existing wallet."
    else
        secretcli keys delete $WALLET_NAME --keyring-backend $KEYRING_BACKEND -y || error "Failed to delete existing wallet"
        log "Existing wallet deleted. Creating new one..."
        CREATE_NEW=true
    fi
else
    CREATE_NEW=true
fi

# Create a new wallet if needed
if [ "$CREATE_NEW" = true ]; then
    log "Creating new wallet '$WALLET_NAME'..."
    MNEMONIC=$(secretcli keys add $WALLET_NAME --keyring-backend $KEYRING_BACKEND --output json | jq -r '.mnemonic')
    
    if [ -z "$MNEMONIC" ]; then
        error "Failed to create wallet or extract mnemonic"
    fi
    
    success "Wallet created successfully!"
    
    # Save mnemonic to a file
    echo "$MNEMONIC" > "$WALLET_NAME.mnemonic"
    success "Mnemonic saved to $WALLET_NAME.mnemonic"
    log "IMPORTANT: Keep this file secure! Anyone with access to this mnemonic can control your funds."
fi

# Get the wallet address
ADDRESS=$(secretcli keys show $WALLET_NAME -a --keyring-backend $KEYRING_BACKEND)
success "Wallet address: $ADDRESS"

# Check wallet balance - using more compatible approach
log "Checking wallet balance..."
if ! BALANCE=$(secretcli q bank balances $ADDRESS --node $NODE_URL 2>/dev/null); then
    log "Could not query balance. This is likely due to a connection issue with the testnet."
    log "You can check your balance manually later with: secretcli q bank balances $ADDRESS --node $NODE_URL"
else
    echo "$BALANCE"
fi

# Instructions for getting testnet tokens
log "For testnet tokens, please visit the Secret Network Discord or use the faucet at https://faucet.pulsar.scrttestnet.com"

# Save wallet info to .env file
log "Updating .env file with wallet information..."
if [ -f "../secret_ai_writer/.env" ]; then
    # Create a backup of existing .env file
    cp ../secret_ai_writer/.env ../secret_ai_writer/.env.backup
    log "Backup of existing .env file created at .env.backup"
    
    # Update or add MNEMONIC in .env file
    if grep -q "^MNEMONIC=" ../secret_ai_writer/.env; then
        # If MNEMONIC exists, ask if user wants to update it
        read -p "MNEMONIC already exists in .env. Update it? (y/n): " UPDATE_MNEMONIC
        if [[ $UPDATE_MNEMONIC == "y" || $UPDATE_MNEMONIC == "Y" ]]; then
            # Get the mnemonic
            if [ -z "$MNEMONIC" ]; then
                log "Please enter your mnemonic phrase:"
                read -s MNEMONIC
            fi
            
            # Update MNEMONIC in .env
            sed -i.bak "s/^MNEMONIC=.*/MNEMONIC=$MNEMONIC/" ../secret_ai_writer/.env && rm -f ../secret_ai_writer/.env.bak
            success "MNEMONIC updated in .env file"
        fi
    else
        # If MNEMONIC doesn't exist, add it
        if [ -z "$MNEMONIC" ]; then
            log "Please enter your mnemonic phrase:"
            read -s MNEMONIC
        fi
        
        echo "MNEMONIC=$MNEMONIC" >> ../secret_ai_writer/.env
        success "MNEMONIC added to .env file"
    fi
else
    # Create a new .env file
    if [ -z "$MNEMONIC" ]; then
        log "Please enter your mnemonic phrase:"
        read -s MNEMONIC
    fi
    
    echo "MNEMONIC=$MNEMONIC" > ../secret_ai_writer/.env
    success "Created new .env file with MNEMONIC"
fi

# Add DEV_MODE=True to .env if not already present
if ! grep -q "^DEV_MODE=" ../secret_ai_writer/.env; then
    echo "DEV_MODE=True" >> ../secret_ai_writer/.env
    success "Added DEV_MODE=True to .env file"
fi

# Add CHAIN_ID to .env if not already present
if ! grep -q "^CHAIN_ID=" ../secret_ai_writer/.env; then
    echo "CHAIN_ID=pulsar-3" >> ../secret_ai_writer/.env
    success "Added CHAIN_ID=pulsar-3 to .env file"
fi

# Add LCD_URL to .env if not already present
if ! grep -q "^LCD_URL=" ../secret_ai_writer/.env; then
    echo "LCD_URL=https://lcd.testnet.secretsaturn.net" >> ../secret_ai_writer/.env
    success "Added LCD_URL=https://lcd.testnet.secretsaturn.net to .env file"
fi

log "Wallet setup complete! Use this wallet for deploying and testing your Secret AI Writer contract."