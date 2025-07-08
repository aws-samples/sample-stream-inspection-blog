#!/bin/bash

# EC2 Key Pair Download Shell Wrapper
# Simple bash interface for download-keypair.ts

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/download-keypair.ts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage information
show_usage() {
    cat << EOF
EC2 Key Pair Download Script

Usage: $0 [options]

Options:
  --stack-name <name>    CloudFormation stack name (default: StreamInspectionBlogStack)
  --region <region>      AWS region (default: us-west-2)
  --output-dir <dir>     Output directory for key files (default: ./keys)
  --key-name <name>      Specific key pair name to download (optional)
  --help                 Show this help message

Examples:
  $0                                    # Download all keys from default stack
  $0 --stack-name MyStack               # Download from specific stack
  $0 --region us-east-1                 # Use different region
  $0 --output-dir ~/.ssh                # Save to SSH directory
  $0 --key-name my-keypair              # Download specific key pair

The script will:
1. Find EC2 key pairs from your CloudFormation stack
2. Download private keys from AWS Systems Manager Parameter Store
3. Save keys with proper SSH permissions (600)
4. Create output directory if needed

Note: Only key pairs created through AWS (after 2021) store private keys in Parameter Store.
Imported or externally created key pairs will not have downloadable private keys.

EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed or not in PATH"
        log_error "Please install Node.js version 18 or later"
        exit 1
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        log_error "Please install AWS CLI version 2.x"
        exit 1
    fi
    
    # Check Node script exists
    if [[ ! -f "$NODE_SCRIPT" ]]; then
        log_error "Node.js script not found: $NODE_SCRIPT"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Main execution
main() {
    # Handle help request
    for arg in "$@"; do
        if [[ "$arg" == "--help" || "$arg" == "-h" ]]; then
            show_usage
            exit 0
        fi
    done
    
    log_info "Starting EC2 key pair download..."
    
    # Check prerequisites
    check_prerequisites
    
    # Execute the TypeScript script with all arguments
    log_info "Executing key pair download..."
    
    if npx ts-node "$NODE_SCRIPT" "$@"; then
        log_success "Key pair download completed successfully"
        exit 0
    else
        exit_code=$?
        log_error "Key pair download failed with exit code: $exit_code"
        
        case $exit_code in
            1)
                log_error "General error occurred"
                ;;
            2)
                log_error "AWS configuration error - check credentials"
                ;;
            3)
                log_error "Key pairs not found in stack"
                ;;
            130)
                log_warning "Operation cancelled by user"
                ;;
            *)
                log_error "Unknown error occurred"
                ;;
        esac
        
        exit $exit_code
    fi
}

# Handle Ctrl+C gracefully
trap 'log_warning "Operation cancelled"; exit 130' INT
trap 'log_warning "Operation terminated"; exit 143' TERM

# Run main function
main "$@"
