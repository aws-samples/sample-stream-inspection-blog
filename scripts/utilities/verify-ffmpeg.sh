#!/bin/bash

# FFmpeg Verification Script
# Checks FFmpeg installation and required capabilities

set -e

echo "🔍 FFmpeg Installation Verification"
echo "=================================="

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg not found"
    echo "Install with: conda env update -f environment.yml"
    exit 1
fi

# Check if ffplay is available
if ! command -v ffplay &> /dev/null; then
    echo "❌ ffplay not found"
    echo "Install with: conda env update -f environment.yml"
    exit 1
fi

# Get FFmpeg version
echo "✅ FFmpeg found:"
ffmpeg -version | head -1

echo ""
echo "✅ ffplay found:"
ffplay -version | head -1

echo ""
echo "🔍 Checking required codecs and formats..."

# Check for required video codecs
echo ""
echo "Video Codecs:"
if ffmpeg -codecs 2>/dev/null | grep -q "libx264"; then
    echo "  ✅ H.264 (libx264)"
else
    echo "  ❌ H.264 (libx264) - required for streaming"
fi

if ffmpeg -codecs 2>/dev/null | grep -q "libx265"; then
    echo "  ✅ H.265 (libx265)"
else
    echo "  ⚠️  H.265 (libx265) - optional"
fi

if ffmpeg -codecs 2>/dev/null | grep -q "libvpx"; then
    echo "  ✅ VP8/VP9 (libvpx)"
else
    echo "  ⚠️  VP8/VP9 (libvpx) - optional"
fi

# Check for required audio codecs
echo ""
echo "Audio Codecs:"
if ffmpeg -codecs 2>/dev/null | grep -q "aac"; then
    echo "  ✅ AAC"
else
    echo "  ❌ AAC - required for streaming"
fi

if ffmpeg -codecs 2>/dev/null | grep -q "libmp3lame"; then
    echo "  ✅ MP3 (libmp3lame)"
else
    echo "  ⚠️  MP3 (libmp3lame) - optional"
fi

if ffmpeg -codecs 2>/dev/null | grep -q "libopus"; then
    echo "  ✅ Opus (libopus)"
else
    echo "  ⚠️  Opus (libopus) - optional"
fi

# Check for required protocols
echo ""
echo "Network Protocols:"
if ffmpeg -protocols 2>/dev/null | grep -q "srt"; then
    echo "  ✅ SRT - required for MediaConnect streaming"
else
    echo "  ❌ SRT - required for MediaConnect streaming"
    echo "     Install FFmpeg with SRT support"
fi

if ffmpeg -protocols 2>/dev/null | grep -q "http"; then
    echo "  ✅ HTTP/HTTPS - required for HLS playback"
else
    echo "  ❌ HTTP/HTTPS - required for HLS playback"
fi

# Check for required filters
echo ""
echo "Video Filters:"
if ffmpeg -filters 2>/dev/null | grep -q "smptebars"; then
    echo "  ✅ SMPTE bars - required for test streams"
else
    echo "  ❌ SMPTE bars - required for test streams"
fi

if ffmpeg -filters 2>/dev/null | grep -q "sine"; then
    echo "  ✅ Sine wave generator - required for test audio"
else
    echo "  ❌ Sine wave generator - required for test audio"
fi

if ffmpeg -filters 2>/dev/null | grep -q "drawtext"; then
    echo "  ✅ Text overlay - optional for enhanced test streams"
else
    echo "  ⚠️  Text overlay - optional for enhanced test streams"
fi

echo ""
echo "🧪 Testing basic functionality..."

# Test SMPTE bars generation
echo "Testing SMPTE color bars generation..."
if ffmpeg -f lavfi -i smptebars=size=320x240:rate=1 -t 1 -f null - &>/dev/null; then
    echo "  ✅ SMPTE bars generation works"
else
    echo "  ❌ SMPTE bars generation failed"
fi

# Test sine wave generation
echo "Testing sine wave audio generation..."
if ffmpeg -f lavfi -i sine=frequency=1000:sample_rate=48000 -t 1 -f null - &>/dev/null; then
    echo "  ✅ Sine wave generation works"
else
    echo "  ❌ Sine wave generation failed"
fi

# Test H.264 encoding
echo "Testing H.264 encoding..."
if ffmpeg -f lavfi -i smptebars=size=320x240:rate=1 -t 1 -c:v libx264 -f null - &>/dev/null; then
    echo "  ✅ H.264 encoding works"
else
    echo "  ❌ H.264 encoding failed"
fi

# Test AAC encoding
echo "Testing AAC audio encoding..."
if ffmpeg -f lavfi -i sine=frequency=1000:sample_rate=48000 -t 1 -c:a aac -f null - &>/dev/null; then
    echo "  ✅ AAC encoding works"
else
    echo "  ❌ AAC encoding failed"
fi

echo ""
echo "📊 Summary:"
echo "==========="

# Count issues
ERRORS=0
WARNINGS=0

# Check critical components
if ! ffmpeg -codecs 2>/dev/null | grep -q "libx264"; then
    ((ERRORS++))
fi

if ! ffmpeg -codecs 2>/dev/null | grep -q "aac"; then
    ((ERRORS++))
fi

if ! ffmpeg -protocols 2>/dev/null | grep -q "srt"; then
    ((ERRORS++))
fi

if ! ffmpeg -filters 2>/dev/null | grep -q "smptebars"; then
    ((ERRORS++))
fi

if ! ffmpeg -filters 2>/dev/null | grep -q "sine"; then
    ((ERRORS++))
fi

if [[ $ERRORS -eq 0 ]]; then
    echo "✅ FFmpeg is properly configured for streaming operations"
    echo "   Ready to use run-test-stream.sh and other streaming scripts"
else
    echo "❌ FFmpeg has $ERRORS critical issues"
    echo "   Update conda environment: conda env update -f environment.yml"
fi

if [[ $WARNINGS -gt 0 ]]; then
    echo "⚠️  $WARNINGS optional features missing (non-critical)"
fi

echo ""
echo "🚀 To test your streaming setup:"
echo "   ./scripts/operations/run-test-stream.sh --help"
