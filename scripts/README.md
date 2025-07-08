# Scripts Documentation

This directory contains organized scripts for managing, testing, and securing the Stream Intelligence Blog project.

## Directory Structure

```
scripts/
├── core/                    # Core operational scripts
├── security/               # Security verification scripts
├── tests/                  # Testing and validation scripts
├── utilities/              # Utility and helper scripts
└── README.md              # This documentation
```

## Security Scripts (🔒 CRITICAL)

### Security Verification Scripts

These scripts verify that all wildcard IAM security vulnerabilities have been properly fixed:

#### `./security/verify-security-appliance-fix.sh`
**Purpose**: Verify Security Appliance IAM role security fix  
**Checks**: 8/8 security verification checks  
**Usage**: `./scripts/security/verify-security-appliance-fix.sh`

**Verifies**:
- ✅ No wildcard permissions for write operations
- ✅ Tag-based access control implementation
- ✅ Conditional IAM policies
- ✅ Resource-specific permissions
- ✅ TypeScript compilation
- ✅ CDK synthesis
- ✅ Security pattern validation
- ✅ Build integrity

#### `./security/verify-mediapackage-fix.sh`
**Purpose**: Verify MediaPackage Custom Resource security fix  
**Checks**: 12/12 security verification checks  
**Usage**: `./scripts/security/verify-mediapackage-fix.sh`

**Verifies**:
- ✅ Wildcard permissions elimination
- ✅ Resource-specific MediaPackage ARNs
- ✅ IAM security conditions
- ✅ Input validation in construct
- ✅ Lambda handler security improvements
- ✅ Malicious pattern detection
- ✅ HTTPS URL validation
- ✅ AWS domain validation
- ✅ TypeScript compilation
- ✅ CDK synthesis
- ✅ Security controls implementation
- ✅ Production readiness

#### `./security/verify-ott-medialive-fix.sh`
**Purpose**: Verify OTT MediaLive Role security fix  
**Checks**: 6/6 security verification checks  
**Usage**: `./scripts/security/verify-ott-medialive-fix.sh`

**Verifies**:
- ✅ Wildcard permissions removal
- ✅ Scoped CloudWatch logs permissions
- ✅ Scoped MediaPackage permissions
- ✅ Separate policy statements
- ✅ TypeScript compilation
- ✅ CDK synthesis

#### `./security/verify-medialive-vpc-fix.sh`
**Purpose**: Verify MediaLive VPC Role security fix  
**Checks**: 7/7 security verification checks  
**Usage**: `./scripts/security/verify-medialive-vpc-fix.sh`

**Verifies**:
- ✅ No wildcard permissions for write operations
- ✅ Separate read and write policy statements
- ✅ VPC-specific resource ARNs
- ✅ Subnet-specific resource ARNs
- ✅ Region conditions
- ✅ TypeScript compilation
- ✅ CDK synthesis

#### `./security/verify-mediaconnect-vpc-fix.sh`
**Purpose**: Verify MediaConnect VPC Role security fix  
**Checks**: 7/7 security verification checks  
**Usage**: `./scripts/security/verify-mediaconnect-vpc-fix.sh`

**Verifies**:
- ✅ No wildcard permissions for write operations
- ✅ Separate read and write policy statements
- ✅ VPC-specific resource ARNs
- ✅ Subnet-specific resource ARNs
- ✅ Region conditions
- ✅ TypeScript compilation
- ✅ CDK synthesis

### Security Verification Summary

**Total Security Checks**: **40/40 PASSED** ✅

| Script | Checks | Status |
|--------|--------|--------|
| Security Appliance | 8/8 | ✅ PASSED |
| MediaPackage | 12/12 | ✅ PASSED |
| OTT MediaLive | 6/6 | ✅ PASSED |
| MediaLive VPC | 7/7 | ✅ PASSED |
| MediaConnect VPC | 7/7 | ✅ PASSED |

### Run All Security Verifications

```bash
# Run all security verification scripts
./scripts/security/verify-security-appliance-fix.sh
./scripts/security/verify-mediapackage-fix.sh
./scripts/security/verify-ott-medialive-fix.sh
./scripts/security/verify-medialive-vpc-fix.sh
./scripts/security/verify-mediaconnect-vpc-fix.sh

# Expected result: All 40/40 security checks should pass ✅
```

## Core Scripts

### Stream Management

#### `./core/stream-manager.js`
**Purpose**: Main stream management utility for MediaConnect flows and MediaLive channels  
**Usage**: 
```bash
# Start all streaming resources
node scripts/operations/stream-manager.js start

# Stop all streaming resources  
node scripts/operations/stream-manager.js stop

# Check status of all resources
node scripts/operations/stream-manager.js status

# Restart all streaming resources
node scripts/operations/stream-manager.js restart
```

**Features**:
- Automatic resource discovery from CloudFormation stack
- Proper sequencing (MediaConnect flows first, then MediaLive channels)
- Real-time monitoring with colored status updates
- Error handling with detailed messages
- State management with proper wait conditions

#### `./core/stream-control.sh`
**Purpose**: Shell wrapper for stream management  
**Usage**: `./scripts/operations/stream-control.sh <action> [stack-name] [region]`

**Examples**:
```bash
# Start streams with default stack
./scripts/operations/stream-control.sh start

# Stop streams with custom stack and region
./scripts/operations/stream-control.sh stop MyStack us-west-2
```

## Test Scripts

### Stream Manager Testing

#### `./tests/test-stream-manager.js`
**Purpose**: Validation tests for stream manager functionality  
**Usage**: `node scripts/tests/test-stream-manager.js`

**Tests**:
- Resource discovery validation
- State management testing
- Error handling verification
- API response validation

### Latency Testing

#### `./tests/latency-test.js`
**Purpose**: Comprehensive end-to-end streaming latency testing  
**Usage**: 
```bash
# Quick test (30 seconds, 720p, 1Mbps)
node scripts/tests/latency-test.js --profile quick

# Standard test (1 minute, 720p, 2Mbps)
node scripts/tests/latency-test.js --profile standard

# Extended test (5 minutes, 1080p, 4Mbps)
node scripts/tests/latency-test.js --profile extended

# Stress test (10 minutes, 1080p, 8Mbps)
node scripts/tests/latency-test.js --profile stress
```

**Features**:
- Multiple test profiles for different scenarios
- Real-time latency measurements
- Comprehensive performance metrics
- JSON output for analysis
- Automated test report generation

#### `./tests/run-latency-test.sh`
**Purpose**: Shell wrapper for latency testing  
**Usage**: `./scripts/tests/run-latency-test.sh [profile]`

## Utility Scripts

### IP Detection

#### `./utilities/get-ip.js`
**Purpose**: Detect current public IP address and format as CIDR  
**Usage**: `node scripts/utilities/get-ip.js`

**Output**: `203.0.113.42/32` (your current IP as CIDR block)

**Use Case**: Automatically set WhitelistCidr parameter for secure deployments
```bash
# Use in CDK deployment
npx cdk deploy --parameters WhitelistCidr=$(node scripts/utilities/get-ip.js)
```

### Latency Analysis

#### `./utilities/analyze-latency-results.js`
**Purpose**: Analyze and report on latency test results  
**Usage**: `node scripts/utilities/analyze-latency-results.js <results-file>`

**Features**:
- Statistical analysis (min, max, average, percentiles)
- Performance trend analysis
- Bottleneck identification
- Detailed reporting

#### `./utilities/timecode-analyzer.js`
**Purpose**: Analyze timecode data for streaming accuracy  
**Usage**: `node scripts/utilities/timecode-analyzer.js <timecode-file>`

**Features**:
- Timecode accuracy validation
- Drift detection and analysis
- Frame accuracy reporting
- Synchronization validation

## NPM Script Integration

The scripts are integrated with NPM for easy execution:

### Security Commands
```bash
# Individual security verifications (run from project root)
npm run security:verify-appliance
npm run security:verify-mediapackage  
npm run security:verify-ott-medialive
npm run security:verify-medialive-vpc
npm run security:verify-mediaconnect-vpc
```

### Stream Management Commands
```bash
npm run stream:start      # Start all streaming resources
npm run stream:stop       # Stop all streaming resources
npm run stream:status     # Check status of all resources
npm run stream:restart    # Restart all streaming resources
npm run stream:test       # Test stream management utilities
```

### Latency Testing Commands
```bash
npm run latency:quick     # 30-second test (720p, 1Mbps)
npm run latency:standard  # 1-minute test (720p, 2Mbps)
npm run latency:extended  # 5-minute test (1080p, 4Mbps)
npm run latency:stress    # 10-minute stress test (1080p, 8Mbps)
npm run latency:analyze   # Analyze test results
npm run latency:compare   # Compare multiple test results
npm run latency:help      # Show latency testing help
```

## Best Practices

### Security Script Usage

1. **Always run security verification** before deployment
2. **All 40 checks must pass** before considering deployment
3. **Re-run after any IAM changes** to ensure security compliance
4. **Include in CI/CD pipeline** for automated security validation

### Stream Management

1. **Use stream manager** instead of manual AWS CLI commands
2. **Check status first** before starting/stopping resources
3. **Monitor logs** during stream operations
4. **Use proper sequencing** (MediaConnect before MediaLive)

### Testing

1. **Run latency tests** after deployment changes
2. **Use appropriate test profiles** for your use case
3. **Analyze results** to identify performance issues
4. **Compare results** over time to track performance trends

## Troubleshooting

### Security Script Issues

```bash
# If security scripts fail, check:
1. Run from project root directory
2. Ensure all files are present
3. Check TypeScript compilation: npm run build
4. Verify CDK synthesis: npx cdk synth
```

### Stream Management Issues

```bash
# If stream management fails, check:
1. AWS credentials are configured
2. Stack exists and is deployed
3. Resources are in expected state
4. Check CloudWatch logs for errors
```

### Permission Issues

```bash
# Make scripts executable
chmod +x scripts/security/*.sh
chmod +x scripts/operations/*.sh
chmod +x scripts/tests/*.sh
```

## Contributing

When adding new scripts:

1. **Follow naming conventions**: `verb-noun-action.js` or `verify-component-fix.sh`
2. **Add comprehensive documentation** in this README
3. **Include error handling** and user-friendly output
4. **Add NPM script integration** where appropriate
5. **Test thoroughly** before committing
6. **Update this documentation** with new script details

## Security Notice

🔒 **CRITICAL**: The security verification scripts are essential for maintaining the security posture of this project. Always ensure all 40/40 security checks pass before deployment to production environments.

**Security Status**: 🟢 **SECURE** - All critical vulnerabilities resolved  
**Last Verified**: 2024-12-19  
**Next Review**: 2025-01-19
