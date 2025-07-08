# Test Scripts

Testing and validation scripts for the Stream Intelligence Blog project, including stream management validation and comprehensive latency testing.

## 📋 **Scripts Overview**

### **`test-stream-manager.js`** - Stream Manager Validation

**Purpose**: Validates stream management functionality and AWS connectivity.

**Features**:
- ✅ **AWS Connectivity**: Tests AWS CLI configuration and permissions
- ✅ **Resource Discovery**: Validates CloudFormation stack and resource detection
- ✅ **Permission Validation**: Checks required IAM permissions
- ✅ **Function Testing**: Tests all stream manager operations
- ✅ **Error Simulation**: Tests error handling and recovery
- ✅ **Comprehensive Reporting**: Detailed test results and recommendations

**Usage**:
```bash
# Via npm script (recommended)
npm run stream:test

# Direct usage
node scripts/tests/test-stream-manager.js

# With custom parameters
node scripts/tests/test-stream-manager.js --stack-name MyStack --region us-west-2
```

**Test Categories**:
- **Configuration Tests**: AWS CLI, credentials, region
- **Permission Tests**: MediaConnect, MediaLive, CloudFormation permissions
- **Resource Tests**: Stack existence, resource discovery
- **Function Tests**: Start, stop, status operations (dry-run mode)
- **Error Tests**: Invalid parameters, missing resources

### **`latency-test.js`** - Comprehensive Latency Testing

**Purpose**: End-to-end streaming performance testing with detailed analysis.

**Features**:
- ✅ **Multiple Test Profiles**: Quick, standard, extended, and stress testing
- ✅ **Real-time Monitoring**: Live latency measurements during testing
- ✅ **Comprehensive Analysis**: Statistical analysis with percentiles and trends
- ✅ **Result Storage**: JSON format for analysis and comparison
- ✅ **Visual Reporting**: ASCII charts and detailed statistics
- ✅ **Automated Validation**: Pass/fail criteria based on performance thresholds

**Usage**:
```bash
# Via npm scripts (recommended)
npm run latency:test          # Interactive mode
npm run latency:quick         # 30-second test (720p, 1Mbps)
npm run latency:standard      # 1-minute test (720p, 2Mbps)
npm run latency:extended      # 5-minute test (1080p, 4Mbps)
npm run latency:stress        # 10-minute stress test (1080p, 8Mbps)

# Direct usage
node scripts/tests/latency-test.js --profile quick
node scripts/tests/latency-test.js --profile standard --output results/my-test.json
```

**Test Profiles**:
- **Quick**: 30 seconds, 720p, 1 Mbps - Basic validation
- **Standard**: 1 minute, 720p, 2 Mbps - Regular testing
- **Extended**: 5 minutes, 1080p, 4 Mbps - Comprehensive testing
- **Stress**: 10 minutes, 1080p, 8 Mbps - Performance limits

### **`run-latency-test.sh`** - Latency Test Runner

**Purpose**: Shell wrapper for latency testing with automated execution and result management.

**Features**:
- ✅ **Profile Management**: Predefined test profiles with optimal settings
- ✅ **Result Management**: Automatic result file naming and organization
- ✅ **Environment Validation**: Checks prerequisites before testing
- ✅ **Progress Monitoring**: Real-time test progress and status
- ✅ **Error Handling**: Graceful error handling and cleanup
- ✅ **Help System**: Comprehensive usage information

**Usage**:
```bash
# Via npm scripts (recommended)
npm run latency:quick         # Quick 30-second test
npm run latency:standard      # Standard 1-minute test
npm run latency:extended      # Extended 5-minute test
npm run latency:stress        # Stress 10-minute test
npm run latency:help          # Show help information

# Direct usage
./scripts/tests/run-latency-test.sh --profile quick
./scripts/tests/run-latency-test.sh --profile standard --output custom-results.json
./scripts/tests/run-latency-test.sh --help
```

**Parameters**:
- `--profile`: Test profile (quick|standard|extended|stress)
- `--output`: Custom output file name
- `--stack-name`: CloudFormation stack name
- `--region`: AWS region
- `--help`: Show usage information

## 🔧 **Prerequisites**

### **System Requirements**
- **Node.js**: Version 18.x or later
- **AWS CLI**: Version 2.x configured with credentials
- **Bash**: For shell script execution (Linux/macOS/WSL)
- **Network Access**: Internet connectivity for latency testing

### **AWS Permissions**
Test scripts require read-only permissions for validation:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mediaconnect:DescribeFlow",
        "mediaconnect:ListFlows",
        "medialive:DescribeChannel",
        "medialive:ListChannels",
        "cloudformation:DescribeStacks",
        "cloudformation:ListStackResources"
      ],
      "Resource": "*"
    }
  ]
}
```

### **Test Environment Setup**
```bash
# Ensure project dependencies are installed
npm install

# Verify AWS configuration
aws sts get-caller-identity

# Create results directory
mkdir -p test-results

# Set execute permissions for shell scripts
chmod +x scripts/tests/*.sh
```

## 📊 **Test Results and Analysis**

### **Stream Manager Test Results**

**Test Categories**:
- ✅ **AWS Configuration**: Credentials, region, CLI version
- ✅ **IAM Permissions**: MediaConnect, MediaLive, CloudFormation access
- ✅ **Resource Discovery**: Stack existence, resource enumeration
- ✅ **Function Validation**: Stream manager operations (dry-run)
- ✅ **Error Handling**: Invalid inputs, missing resources

**Sample Output**:
```
Stream Manager Validation Test Results
=====================================

✅ AWS Configuration Tests
   ✅ AWS CLI configured and accessible
   ✅ Valid AWS credentials found
   ✅ Region set to us-west-2
   ✅ Account ID: 123456789012

✅ Permission Tests
   ✅ MediaConnect permissions validated
   ✅ MediaLive permissions validated
   ✅ CloudFormation permissions validated

✅ Resource Discovery Tests
   ✅ Stack 'StreamInspectionBlogStack' found
   ✅ Found 2 MediaConnect flows
   ✅ Found 1 MediaLive channel

✅ Function Tests (Dry Run)
   ✅ Start operation validation passed
   ✅ Stop operation validation passed
   ✅ Status operation validation passed

Overall Result: ✅ ALL TESTS PASSED
```

### **Latency Test Results**

**Metrics Collected**:
- **Round-trip Latency**: End-to-end response times
- **Jitter**: Latency variation over time
- **Packet Loss**: Network reliability metrics
- **Throughput**: Data transfer rates
- **Connection Stability**: Connection drop/recovery events

**Sample Output**:
```
Latency Test Results - Standard Profile
======================================

Test Configuration:
- Profile: Standard (1 minute, 720p, 2 Mbps)
- Duration: 60 seconds
- Target Bitrate: 2,000,000 bps
- Resolution: 1280x720

Performance Metrics:
- Average Latency: 45.2ms
- Median Latency: 42.1ms
- 95th Percentile: 67.8ms
- 99th Percentile: 89.3ms
- Jitter (StdDev): 12.4ms
- Packet Loss: 0.02%
- Throughput: 1,987,432 bps (99.4% of target)

Test Result: ✅ PASSED
- All metrics within acceptable thresholds
- No significant packet loss detected
- Consistent performance throughout test
```

### **Result File Format**

Test results are saved in JSON format for analysis:

```json
{
  "testInfo": {
    "profile": "standard",
    "duration": 60,
    "timestamp": "2025-07-04T14:30:00Z",
    "testId": "latency_test_standard_20250704_143000"
  },
  "configuration": {
    "resolution": "1280x720",
    "bitrate": 2000000,
    "codec": "h264"
  },
  "metrics": {
    "latency": {
      "average": 45.2,
      "median": 42.1,
      "p95": 67.8,
      "p99": 89.3,
      "stddev": 12.4
    },
    "throughput": {
      "average": 1987432,
      "efficiency": 99.4
    },
    "reliability": {
      "packetLoss": 0.02,
      "connectionDrops": 0
    }
  },
  "result": "PASSED",
  "recommendations": []
}
```

## 🎯 **Test Profiles and Thresholds**

### **Performance Thresholds**

| Profile | Max Avg Latency | Max P95 Latency | Max Jitter | Max Packet Loss |
|---------|----------------|-----------------|------------|-----------------|
| **Quick** | 100ms | 200ms | 50ms | 0.1% |
| **Standard** | 80ms | 150ms | 30ms | 0.05% |
| **Extended** | 60ms | 120ms | 25ms | 0.02% |
| **Stress** | 50ms | 100ms | 20ms | 0.01% |

### **Test Profile Details**

#### **Quick Profile** (30 seconds)
- **Purpose**: Basic validation and smoke testing
- **Resolution**: 720p (1280x720)
- **Bitrate**: 1 Mbps
- **Use Case**: CI/CD pipeline validation, quick health checks

#### **Standard Profile** (1 minute)
- **Purpose**: Regular performance validation
- **Resolution**: 720p (1280x720)
- **Bitrate**: 2 Mbps
- **Use Case**: Daily operations, performance monitoring

#### **Extended Profile** (5 minutes)
- **Purpose**: Comprehensive performance analysis
- **Resolution**: 1080p (1920x1080)
- **Bitrate**: 4 Mbps
- **Use Case**: Weekly performance reviews, optimization

#### **Stress Profile** (10 minutes)
- **Purpose**: Performance limits and stability testing
- **Resolution**: 1080p (1920x1080)
- **Bitrate**: 8 Mbps
- **Use Case**: Capacity planning, stress testing

## 🚨 **Troubleshooting**

### **Common Test Issues**

#### **Stream Manager Test Failures**
```bash
# Permission errors
Error: Access denied for MediaConnect operations
Solution: Verify IAM permissions and AWS credentials

# Resource not found
Error: Stack 'MyStack' not found
Solution: Verify stack name and deployment status

# Network connectivity
Error: Unable to connect to AWS services
Solution: Check internet connectivity and AWS service status
```

#### **Latency Test Issues**
```bash
# High latency results
Warning: Average latency 150ms exceeds threshold
Solution: Check network conditions, AWS region proximity

# Packet loss detected
Warning: Packet loss 0.5% exceeds threshold
Solution: Investigate network stability, check AWS service health

# Test timeout
Error: Test timed out after 300 seconds
Solution: Check streaming infrastructure status, verify connectivity
```

### **Debugging Steps**
1. **Verify Prerequisites**: Check Node.js, AWS CLI, permissions
2. **Test AWS Connectivity**: `aws sts get-caller-identity`
3. **Check Stack Status**: `aws cloudformation describe-stacks`
4. **Validate Resources**: Use AWS Console to verify resource states
5. **Review Test Logs**: Check detailed output for specific errors
6. **Network Diagnostics**: Test network connectivity and latency

## 📈 **Performance Optimization**

### **Test Performance Tips**
- **Run from Same Region**: Execute tests from same AWS region as resources
- **Stable Network**: Use wired connection for consistent results
- **Resource Warm-up**: Ensure streaming resources are active before testing
- **Multiple Runs**: Run tests multiple times for statistical significance
- **Baseline Establishment**: Establish performance baselines for comparison

### **Result Analysis**
- **Trend Analysis**: Compare results over time to identify performance trends
- **Threshold Tuning**: Adjust thresholds based on actual performance requirements
- **Correlation Analysis**: Correlate test results with infrastructure changes
- **Performance Regression**: Identify performance regressions early
- **Capacity Planning**: Use stress test results for capacity planning

---

**Last Updated**: 2025-07-04  
**Scripts Version**: 2.0  
**Test Coverage**: Stream management validation + comprehensive latency testing  
**Maintenance**: Regular test execution recommended for performance monitoring
