#!/bin/bash

# End-to-End Latency Test Runner
# Wrapper script for running latency tests with predefined profiles

set -e

# Default values
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_DIR/config/latency-test-config.json"
RESULTS_DIR="$PROJECT_DIR/test-results"
CONFIGURATION="standard"
STACK_NAME="StreamInspectionBlogStack"
REGION="us-west-2"
VERBOSE=false
DRY_RUN=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
End-to-End Latency Test Runner

Usage: $0 [OPTIONS]

Options:
    -c, --configuration CONFIG  Test configuration: quick|standard|extended|stress (default: standard)
    -s, --stack-name NAME       CloudFormation stack name (default: StreamInspectionBlogStack)
    -r, --region REGION         AWS region (default: us-west-2)
    -o, --output-dir DIR        Output directory for results (default: test-results)
    -v, --verbose               Enable verbose logging
    -d, --dry-run              Show commands without executing
    -h, --help                 Show this help message

Test Configurations:
    quick      - 30-second test with 720p/1Mbps
    standard   - 1-minute test with 720p/2Mbps  
    extended   - 5-minute test with 1080p/4Mbps
    stress     - 10-minute test with 1080p/8Mbps

Examples:
    $0 --configuration quick --verbose
    $0 --configuration extended --stack-name MyStack --region us-east-1
    $0 --configuration stress --output-dir ./results --dry-run

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_color $BLUE "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_color $RED "Error: Node.js is not installed"
        exit 1
    fi
    
    # Check if FFmpeg is available
    if ! command -v ffmpeg &> /dev/null; then
        print_color $RED "Error: FFmpeg is not installed"
        print_color $YELLOW "Please install FFmpeg to run latency tests"
        print_color $YELLOW "macOS: brew install ffmpeg"
        print_color $YELLOW "Ubuntu: sudo apt-get install ffmpeg"
        exit 1
    fi
    
    # Check if FFprobe is available
    if ! command -v ffprobe &> /dev/null; then
        print_color $RED "Error: FFprobe is not installed (usually comes with FFmpeg)"
        exit 1
    fi
    
    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        print_color $RED "Error: AWS CLI is not installed"
        exit 1
    fi
    
    # Check if config file exists
    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_color $RED "Error: Configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    
    # Check if latency test script exists
    if [[ ! -f "$SCRIPT_DIR/latency-test.js" ]]; then
        print_color $RED "Error: Latency test script not found: $SCRIPT_DIR/latency-test.js"
        exit 1
    fi
    
    print_color $GREEN "Prerequisites check passed"
}

# Function to create results directory
create_results_dir() {
    if [[ ! -d "$RESULTS_DIR" ]]; then
        mkdir -p "$RESULTS_DIR"
        print_color $BLUE "Created results directory: $RESULTS_DIR"
    fi
}

# Function to get configuration settings
get_configuration_settings() {
    local configuration=$1
    
    if ! command -v jq &> /dev/null; then
        print_color $YELLOW "Warning: jq not found, using default values"
        return
    fi
    
    if ! jq -e ".testProfiles.$configuration" "$CONFIG_FILE" &> /dev/null; then
        print_color $RED "Error: Configuration '$configuration' not found in configuration"
        print_color $YELLOW "Available configurations:"
        jq -r '.testProfiles | keys[]' "$CONFIG_FILE" 2>/dev/null || echo "  quick, standard, extended, stress"
        exit 1
    fi
    
    # Extract configuration values
    DURATION=$(jq -r ".testProfiles.$configuration.duration" "$CONFIG_FILE" 2>/dev/null || echo "60")
    PATTERN=$(jq -r ".testProfiles.$configuration.pattern" "$CONFIG_FILE" 2>/dev/null || echo "clock")
    RESOLUTION=$(jq -r ".testProfiles.$configuration.resolution" "$CONFIG_FILE" 2>/dev/null || echo "720p")
    BITRATE=$(jq -r ".testProfiles.$configuration.bitrate" "$CONFIG_FILE" 2>/dev/null || echo "2000")
    DESCRIPTION=$(jq -r ".testProfiles.$configuration.description" "$CONFIG_FILE" 2>/dev/null || echo "Standard test")
    
    print_color $CYAN "Configuration: $configuration - $DESCRIPTION"
    print_color $CYAN "Duration: ${DURATION}s, Pattern: $PATTERN, Resolution: $RESOLUTION, Bitrate: ${BITRATE}kbps"
}

# Function to run the latency test
run_latency_test() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local output_file="$RESULTS_DIR/latency_test_${PROFILE}_${timestamp}.json"
    
    print_color $BLUE "Starting latency test..."
    print_color $CYAN "Output file: $output_file"
    
    # Build command arguments
    local cmd_args=(
        "--stack-name" "$STACK_NAME"
        "--region" "$REGION"
        "--duration" "$DURATION"
        "--pattern" "$PATTERN"
        "--resolution" "$RESOLUTION"
        "--bitrate" "$BITRATE"
        "--output-file" "$output_file"
    )
    
    if [[ "$VERBOSE" == "true" ]]; then
        cmd_args+=("--verbose")
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        cmd_args+=("--dry-run")
    fi
    
    # Run the test
    if [[ "$DRY_RUN" == "true" ]]; then
        print_color $YELLOW "[DRY RUN] Would execute:"
        print_color $YELLOW "node $SCRIPT_DIR/latency-test.js ${cmd_args[*]}"
    else
        print_color $BLUE "Executing latency test..."
        node "$SCRIPT_DIR/latency-test.js" "${cmd_args[@]}"
        
        if [[ $? -eq 0 ]]; then
            print_color $GREEN "Latency test completed successfully"
            print_color $CYAN "Results saved to: $output_file"
            
            # Show quick summary if jq is available
            if command -v jq &> /dev/null && [[ -f "$output_file" ]]; then
                print_color $BLUE "\nQuick Summary:"
                echo "  Average Latency: $(jq -r '.statistics.averageLatency // "N/A"' "$output_file")s"
                echo "  Total Frames: $(jq -r '.statistics.totalFrames // "N/A"' "$output_file")"
                echo "  Errors: $(jq -r '.errors | length' "$output_file" 2>/dev/null || echo "N/A")"
            fi
        else
            print_color $RED "Latency test failed"
            exit 1
        fi
    fi
}

# Function to show system information
show_system_info() {
    print_color $BLUE "System Information:"
    echo "  OS: $(uname -s) $(uname -r)"
    echo "  Node.js: $(node --version 2>/dev/null || echo "Not found")"
    echo "  FFmpeg: $(ffmpeg -version 2>/dev/null | head -n1 | cut -d' ' -f3 || echo "Not found")"
    echo "  AWS CLI: $(aws --version 2>/dev/null || echo "Not found")"
    echo "  Date: $(date)"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--configuration)
            CONFIGURATION="$2"
            shift 2
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -o|--output-dir)
            RESULTS_DIR="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_color $RED "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_color $GREEN "Stream Intelligence Blog - End-to-End Latency Test"
    print_color $GREEN "=================================================="
    
    if [[ "$VERBOSE" == "true" ]]; then
        show_system_info
    fi
    
    check_prerequisites
    get_profile_config "$PROFILE"
    create_results_dir
    run_latency_test
    
    print_color $GREEN "\nTest execution completed!"
}

# Run main function
main "$@"
