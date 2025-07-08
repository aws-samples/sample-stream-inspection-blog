# Utility Scripts

Helper scripts and utilities for various tasks in the Stream Intelligence Blog project, including analysis tools, deployment helpers, and debugging utilities.

## 📋 **Scripts Overview**

### **`analyze-latency-results.js`** - Latency Test Result Analysis

**Purpose**: Statistical analysis and comparison of latency test results with comprehensive reporting.

**Features**:
- ✅ **Statistical Analysis**: Mean, median, percentiles, standard deviation
- ✅ **Trend Analysis**: Performance trends over time
- ✅ **Comparison Tools**: Compare multiple test results
- ✅ **Visual Reports**: ASCII charts and graphs
- ✅ **Performance Insights**: Automated recommendations and insights
- ✅ **Export Formats**: JSON, CSV, and human-readable reports

**Usage**:
```bash
# Via npm scripts (recommended)
npm run latency:analyze results/test-results.json
npm run latency:compare results/test1.json results/test2.json

# Direct usage
node scripts/utilities/analyze-latency-results.js --file results/test-results.json
node scripts/utilities/analyze-latency-results.js --compare results/test1.json results/test2.json
node scripts/utilities/analyze-latency-results.js --directory results/ --trend
```

**Parameters**:
- `--file`: Single result file to analyze
- `--compare`: Compare multiple result files
- `--directory`: Analyze all results in directory
- `--trend`: Generate trend analysis
- `--format`: Output format (json|csv|text)
- `--output`: Output file name
- `--help`: Show usage information

**Analysis Features**:
- **Performance Metrics**: Latency, jitter, throughput, packet loss
- **Statistical Analysis**: Comprehensive statistical breakdown
- **Trend Detection**: Performance improvement/degradation over time
- **Threshold Validation**: Pass/fail analysis against defined thresholds
- **Recommendations**: Automated performance optimization suggestions

### **`get-ip.js`** - IP Address Detection Utility

**Purpose**: Detects current public IP address and formats it for AWS security group configuration.

**Features**:
- ✅ **Public IP Detection**: Automatically detects current public IP
- ✅ **CIDR Formatting**: Formats IP as CIDR block (/32)
- ✅ **Multiple Sources**: Uses multiple IP detection services for reliability
- ✅ **Validation**: Validates IP address format
- ✅ **Error Handling**: Graceful fallback if detection fails
- ✅ **Deployment Integration**: Used in deployment scripts for IP whitelisting

**Usage**:
```bash
# Get current IP as CIDR (most common usage)
node scripts/utilities/get-ip.js
# Output: 203.0.113.42/32

# Use in deployment
npx cdk deploy --parameters WhitelistCidr=$(node scripts/utilities/get-ip.js)

# Get raw IP without CIDR
node scripts/utilities/get-ip.js --raw
# Output: 203.0.113.42

# Verbose output with source information
node scripts/utilities/get-ip.js --verbose
```

**Parameters**:
- `--raw`: Return IP without /32 CIDR suffix
- `--verbose`: Show detailed information about IP detection
- `--timeout`: Timeout for IP detection requests (default: 5000ms)
- `--help`: Show usage information

**IP Detection Sources**:
- Primary: `https://api.ipify.org`
- Fallback 1: `https://icanhazip.com`
- Fallback 2: `https://ident.me`
- Local fallback: Network interface detection

### **`timecode-analyzer.js`** - Timecode Analysis Utility

**Purpose**: Analyzes video stream timecode information for debugging synchronization issues.

**Features**:
- ✅ **Timecode Parsing**: Parses various timecode formats (SMPTE, drop-frame, non-drop)
- ✅ **Synchronization Analysis**: Detects timing inconsistencies
- ✅ **Frame Rate Detection**: Identifies frame rate from timecode
- ✅ **Drift Analysis**: Measures timecode drift over time
- ✅ **Gap Detection**: Identifies missing or duplicate frames
- ✅ **Report Generation**: Detailed analysis reports

**Usage**:
```bash
# Analyze timecode from stream data
node scripts/utilities/timecode-analyzer.js --input stream-data.json

# Analyze timecode with specific frame rate
node scripts/utilities/timecode-analyzer.js --input data.json --framerate 29.97

# Generate detailed report
node scripts/utilities/timecode-analyzer.js --input data.json --report detailed.txt
```

**Parameters**:
- `--input`: Input file with timecode data
- `--framerate`: Expected frame rate (23.976|24|25|29.97|30|50|59.94|60)
- `--format`: Timecode format (smpte|drop|non-drop)
- `--report`: Output report file
- `--verbose`: Detailed analysis output
- `--help`: Show usage information

**Analysis Features**:
- **Timecode Validation**: Validates timecode format and consistency
- **Frame Analysis**: Frame-by-frame timecode progression analysis
- **Synchronization Check**: Detects audio/video sync issues
- **Performance Metrics**: Timing accuracy and stability metrics
- **Visual Timeline**: ASCII timeline representation of timecode progression

## 🔧 **Prerequisites**

### **System Requirements**
- **Node.js**: Version 18.x or later
- **Internet Access**: For IP detection utility
- **File System Access**: For reading/writing analysis results

### **Dependencies**
All utility scripts use built-in Node.js modules and project dependencies:
- `fs`: File system operations
- `https`: HTTP requests for IP detection
- `os`: Operating system utilities
- `path`: File path operations

### **Setup**
```bash
# Ensure project dependencies are installed
npm install

# Create directories for results and reports
mkdir -p results reports

# Set execute permissions (if needed)
chmod +x scripts/utilities/*.js
```

## 📊 **Usage Examples**

### **Latency Analysis Workflow**

#### **Single Test Analysis**
```bash
# Run a latency test
npm run latency:standard

# Analyze the results
npm run latency:analyze results/latency_test_standard_20250704_143000.json

# Sample output:
# Latency Analysis Report
# ======================
# Test: Standard Profile (2025-07-04 14:30:00)
# Duration: 60 seconds
# 
# Performance Metrics:
# - Average Latency: 45.2ms ✅
# - Median Latency: 42.1ms ✅
# - 95th Percentile: 67.8ms ✅
# - Jitter (StdDev): 12.4ms ✅
# - Packet Loss: 0.02% ✅
# 
# Result: PASSED - All metrics within thresholds
```

#### **Trend Analysis**
```bash
# Analyze all results in directory for trends
node scripts/utilities/analyze-latency-results.js --directory results/ --trend

# Sample output:
# Latency Trend Analysis
# =====================
# Period: 2025-07-01 to 2025-07-04 (7 tests)
# 
# Performance Trends:
# - Average Latency: 45.2ms → 42.8ms (↓ 5.3% improvement)
# - 95th Percentile: 67.8ms → 65.1ms (↓ 4.0% improvement)
# - Packet Loss: 0.02% → 0.01% (↓ 50% improvement)
# 
# Trend: ✅ IMPROVING - Performance getting better over time
```

#### **Comparison Analysis**
```bash
# Compare two test results
npm run latency:compare results/before-optimization.json results/after-optimization.json

# Sample output:
# Latency Comparison Report
# ========================
# 
# Before Optimization vs After Optimization
# 
# Latency Improvements:
# - Average: 52.3ms → 45.2ms (↓ 13.6% improvement)
# - P95: 78.9ms → 67.8ms (↓ 14.1% improvement)
# - Jitter: 18.7ms → 12.4ms (↓ 33.7% improvement)
# 
# Overall: ✅ SIGNIFICANT IMPROVEMENT
```

### **IP Detection for Deployment**

#### **Basic IP Detection**
```bash
# Get current IP for security group configuration
MY_IP=$(node scripts/utilities/get-ip.js)
echo "Current IP: $MY_IP"
# Output: Current IP: 203.0.113.42/32

# Use in CDK deployment
npx cdk deploy --parameters WhitelistCidr=$MY_IP
```

#### **Deployment Script Integration**
```bash
#!/bin/bash
# Automated deployment with IP whitelisting

echo "Detecting current IP address..."
CURRENT_IP=$(node scripts/utilities/get-ip.js)

if [ $? -eq 0 ]; then
    echo "Current IP: $CURRENT_IP"
    echo "Deploying with IP whitelist..."
    npx cdk deploy --parameters WhitelistCidr=$CURRENT_IP
else
    echo "Failed to detect IP address"
    echo "Please specify IP manually:"
    echo "npx cdk deploy --parameters WhitelistCidr=YOUR.IP.ADDRESS/32"
    exit 1
fi
```

### **Timecode Analysis for Debugging**

#### **Stream Synchronization Analysis**
```bash
# Analyze timecode from captured stream data
node scripts/utilities/timecode-analyzer.js --input captured-stream.json --framerate 29.97

# Sample output:
# Timecode Analysis Report
# =======================
# Input: captured-stream.json
# Frame Rate: 29.97 fps (NTSC)
# Duration: 00:05:30:15 (5 minutes, 30 seconds, 15 frames)
# 
# Timecode Validation:
# - Format: SMPTE Drop-Frame ✅
# - Continuity: 99.8% continuous ⚠️
# - Frame Accuracy: 99.9% accurate ✅
# 
# Issues Detected:
# - 2 frame drops at 00:02:15:08 and 00:04:22:12
# - Average drift: +0.03 frames/second
# 
# Recommendations:
# - Check network stability during capture
# - Verify source timecode generation
```

## 📈 **Advanced Features**

### **Batch Analysis**

#### **Automated Report Generation**
```bash
#!/bin/bash
# Generate comprehensive performance report

echo "Generating comprehensive performance report..."

# Analyze all latency test results
node scripts/utilities/analyze-latency-results.js \
    --directory results/ \
    --trend \
    --format json \
    --output reports/performance-summary.json

# Generate human-readable report
node scripts/utilities/analyze-latency-results.js \
    --directory results/ \
    --trend \
    --format text \
    --output reports/performance-report.txt

echo "Reports generated in reports/ directory"
```

#### **Performance Monitoring Integration**
```bash
#!/bin/bash
# Continuous performance monitoring

while true; do
    # Run latency test
    npm run latency:standard
    
    # Analyze results
    LATEST_RESULT=$(ls -t results/latency_test_*.json | head -1)
    ANALYSIS=$(node scripts/utilities/analyze-latency-results.js --file $LATEST_RESULT --format json)
    
    # Check if performance degraded
    RESULT=$(echo $ANALYSIS | jq -r '.result')
    if [ "$RESULT" != "PASSED" ]; then
        echo "Performance degradation detected!"
        # Send alert to monitoring system
        curl -X POST "https://monitoring.example.com/alert" \
             -d "Performance test failed: $ANALYSIS"
    fi
    
    # Wait 1 hour before next test
    sleep 3600
done
```

### **Custom Analysis Scripts**

#### **Performance Threshold Customization**
```javascript
// Custom analysis with specific thresholds
const analyzer = require('./scripts/utilities/analyze-latency-results.js');

const customThresholds = {
    latency: {
        average: 30,    // 30ms max average
        p95: 60,        // 60ms max 95th percentile
        p99: 100        // 100ms max 99th percentile
    },
    jitter: 15,         // 15ms max jitter
    packetLoss: 0.01    // 0.01% max packet loss
};

analyzer.analyzeWithThresholds('results/test.json', customThresholds);
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **IP Detection Failures**
```bash
Error: Unable to detect public IP address
Causes:
- No internet connectivity
- Firewall blocking HTTP requests
- All IP detection services unavailable

Solutions:
- Check internet connectivity
- Try with --verbose flag to see detailed error
- Manually specify IP: --ip 203.0.113.42
```

#### **Analysis Script Errors**
```bash
Error: Cannot read result file
Causes:
- File doesn't exist or is corrupted
- Insufficient file permissions
- Invalid JSON format

Solutions:
- Verify file path and existence
- Check file permissions
- Validate JSON format with: cat file.json | jq .
```

#### **Timecode Analysis Issues**
```bash
Error: Invalid timecode format
Causes:
- Unsupported timecode format
- Corrupted input data
- Missing frame rate information

Solutions:
- Specify frame rate with --framerate parameter
- Verify input data format
- Check timecode format specification
```

### **Debugging Tips**
1. **Use Verbose Mode**: Most scripts support `--verbose` for detailed output
2. **Check File Permissions**: Ensure scripts have read/write access to files
3. **Validate Input Data**: Use JSON validators for input files
4. **Test Network Connectivity**: For IP detection issues
5. **Review Error Messages**: Scripts provide detailed error information

## 📋 **Maintenance**

### **Regular Maintenance Tasks**
- **Clean Old Results**: Remove old test result files periodically
- **Update IP Detection**: Verify IP detection services are still available
- **Validate Analysis**: Ensure analysis scripts work with latest result formats
- **Performance Tuning**: Adjust thresholds based on actual requirements

### **Script Updates**
- **Version Compatibility**: Ensure scripts work with latest Node.js versions
- **Dependency Updates**: Keep dependencies current for security
- **Feature Enhancements**: Add new analysis features as needed
- **Bug Fixes**: Address any issues found during usage

---

**Last Updated**: 2025-07-04  
**Scripts Version**: 2.0  
**Utility Count**: 3 comprehensive utility scripts  
**Maintenance**: Regular updates recommended for optimal performance
