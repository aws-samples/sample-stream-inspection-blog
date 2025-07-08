#!/bin/bash

# Stream Test Generator and Player

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_NAME="StreamInspectionBlogStack"
REGION="us-west-2"
VERBOSE=false
PLAY_OUTPUT=true  # Default to true - play output by default
DURATION=""

show_usage() {
    cat << EOF
Stream Test Generator and Player

Usage: $0 [OPTIONS]

Options:
    -s, --stack-name NAME    CloudFormation stack name (default: StreamInspectionBlogStack)
    -r, --region REGION      AWS region (default: us-west-2)
    -v, --verbose           Enable verbose logging
    --no-play               Disable HLS output playback (playback is enabled by default)
    -d, --duration SECONDS  Stream duration in seconds (default: continuous)
    -h, --help              Show this help

What this script does:
    1. Generates SMPTE color bars with 1kHz audio
    2. Streams to MediaConnect via SRT (from stack outputs)
    3. Plays the HLS output stream with ffplay (default behavior)

Examples:
    $0                      # Generate stream with HLS playback (default)
    $0 --no-play            # Generate stream without playback
    $0 --duration 300       # Generate 5-minute stream with playback
    $0 --verbose            # Generate with verbose output and playback

EOF
}

check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check FFmpeg
    if ! command -v ffmpeg &> /dev/null; then
        echo "Error: ffmpeg not found"
        echo "Install: brew install ffmpeg (macOS) or sudo apt-get install ffmpeg (Ubuntu)"
        exit 1
    fi
    
    # Check ffplay if needed
    if [[ "$PLAY_OUTPUT" == "true" ]]; then
        if ! command -v ffplay &> /dev/null; then
            echo "Warning: ffplay not found. Playback disabled."
            echo "Install: brew install ffmpeg (macOS) or sudo apt-get install ffmpeg (Ubuntu)"
            PLAY_OUTPUT=false
        fi
    fi
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo "Error: AWS CLI not found"
        echo "Install AWS CLI v2 and configure credentials"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js not found"
        echo "Install Node.js 18+ from nodejs.org"
        exit 1
    fi
    
    echo "✅ Prerequisites check passed"
}

get_stack_outputs() {
    echo "Getting stack outputs..."
    
    # Get SRT input URL
    SRT_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='SrtInputUrl'].OutputValue" \
        --output text 2>/dev/null)
    
    if [[ -z "$SRT_URL" || "$SRT_URL" == "None" ]]; then
        echo "Error: Could not get SRT input URL from stack $STACK_NAME"
        echo "Make sure the stack is deployed and contains SrtInputUrl output"
        exit 1
    fi
    
    # Always get playback URL since playback is default
    PLAYBACK_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='PlaybackUrl'].OutputValue" \
        --output text 2>/dev/null)
    
    if [[ -z "$PLAYBACK_URL" || "$PLAYBACK_URL" == "None" ]]; then
        echo "Warning: Could not get playback URL from stack"
        if [[ "$PLAY_OUTPUT" == "true" ]]; then
            echo "Playback will be disabled"
            PLAY_OUTPUT=false
        fi
    else
        echo "✅ Found playback URL: $PLAYBACK_URL"
    fi
    
    echo "✅ Found SRT URL: $SRT_URL"
}

start_playback() {
    if [[ "$PLAY_OUTPUT" == "true" && -n "$PLAYBACK_URL" ]]; then
        echo "Starting HLS playback..."
        echo "Opening playback window with ffplay..."
        
        # Start ffplay in background
        ffplay -i "$PLAYBACK_URL" \
            -window_title "Stream Output - $STACK_NAME" \
            -autoexit \
            -loglevel quiet &
        
        FFPLAY_PID=$!
        echo "✅ Playback started (PID: $FFPLAY_PID)"
        
        # Give ffplay time to start
        sleep 2
    fi
}

generate_stream() {
    echo "Starting stream generation..."
    echo "Resolution: 1080p, Bitrate: 1000kbps"
    echo "Target: $SRT_URL"
    
    if [[ -n "$DURATION" ]]; then
        echo "Duration: ${DURATION} seconds"
    else
        echo "Duration: Continuous (press Ctrl+C to stop)"
    fi
    
    # Build FFmpeg command
    FFMPEG_CMD="ffmpeg -y"
    FFMPEG_CMD="$FFMPEG_CMD -f lavfi -i smptebars=size=1920x1080:rate=30"
    FFMPEG_CMD="$FFMPEG_CMD -f lavfi -i sine=frequency=1000:sample_rate=48000"
    FFMPEG_CMD="$FFMPEG_CMD -c:v libx264 -preset veryfast -b:v 1000k"
    FFMPEG_CMD="$FFMPEG_CMD -c:a aac -b:a 128k -ar 48000 -ac 2"
    FFMPEG_CMD="$FFMPEG_CMD -f mpegts -map 0:v -map 1:a"
    
    # Add duration if specified
    if [[ -n "$DURATION" ]]; then
        FFMPEG_CMD="$FFMPEG_CMD -t $DURATION"
    fi
    
    # Add output URL
    FFMPEG_CMD="$FFMPEG_CMD \"$SRT_URL\""
    
    # Add logging level
    if [[ "$VERBOSE" == "true" ]]; then
        FFMPEG_CMD="$FFMPEG_CMD -loglevel info"
    else
        FFMPEG_CMD="$FFMPEG_CMD -loglevel warning"
    fi
    
    echo "Starting FFmpeg..."
    if [[ "$VERBOSE" == "true" ]]; then
        echo "Command: $FFMPEG_CMD"
    fi
    
    # Execute FFmpeg
    eval $FFMPEG_CMD
}

cleanup() {
    echo ""
    echo "Cleaning up..."
    
    # Kill ffplay if running
    if [[ -n "$FFPLAY_PID" ]]; then
        kill $FFPLAY_PID 2>/dev/null || true
        echo "Stopped playback"
    fi
    
    echo "Stream generation stopped"
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --no-play)
            PLAY_OUTPUT=false
            shift
            ;;
        -d|--duration)
            DURATION="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main execution
echo "🚀 Stream Test Generator and Player"
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo ""

check_prerequisites
get_stack_outputs

# Start playback if requested
start_playback

# Generate stream
generate_stream

# If we get here, stream finished normally
cleanup
