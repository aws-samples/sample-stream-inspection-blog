#!/bin/bash

# Simple Stream Control Wrapper
# Basic interface for stream-manager.ts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/stream-manager.ts"

# Check if TypeScript script exists
if [[ ! -f "$NODE_SCRIPT" ]]; then
    echo "Error: stream-manager.ts not found"
    exit 1
fi

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js not found"
    exit 1
fi

# Check if ts-node is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found (needed for ts-node)"
    exit 1
fi

# Show usage if no arguments
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <command> [stack-name] [region]"
    echo ""
    echo "Commands:"
    echo "  start     Start streaming infrastructure"
    echo "  stop      Stop streaming infrastructure"
    echo "  status    Show current status"
    echo "  restart   Restart infrastructure"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 status MyStack us-east-1"
    exit 1
fi

# Execute the TypeScript script
exec npx ts-node "$NODE_SCRIPT" "$@"
