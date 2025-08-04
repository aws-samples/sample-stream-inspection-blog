# Operations Scripts

This directory contains operational scripts for managing the Stream Inspection Blog infrastructure with comprehensive AWS resource management, stream generation, and cleanup capabilities.

## 📋 Script Overview

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `stream-manager.ts` | Stream lifecycle management | GWLB ASG + MediaConnect + MediaLive orchestration |
| `test-stream.ts` | Professional test stream generation | SMPTE bars + LTC audio + x264 encoding |
| `cleanup-residual.sh` | Comprehensive resource cleanup | Dry-run mode + 10+ AWS service coverage |
| `verify-cleanup.sh` | Cleanup verification | Exit codes + verbose reporting |
| `download-keypair.ts` | EC2 key pair management | SSM Parameter Store integration |

## 🎬 Stream Management

### stream-manager.ts
**Enterprise-grade stream lifecycle management** with proper resource sequencing and health monitoring.

**Architecture Integration:**
- **Gateway Load Balancer**: Auto Scaling Group management (scale up/down)
- **MediaConnect**: Flow lifecycle (start/stop with health checks)
- **MediaLive**: Channel and input management (proper state transitions)
- **CloudFormation**: Automatic resource discovery from stack outputs

**Features:**
- ✅ **Proper Sequencing**: GWLB ASG → MediaConnect flows → MediaLive channels
- ✅ **Health Monitoring**: Waits for GWLB targets to be healthy before proceeding
- ✅ **Resource Discovery**: Automatically finds all resources from CloudFormation stack
- ✅ **Status Reporting**: Real-time status with colored output and progress indicators
- ✅ **Error Handling**: Robust error handling with detailed messages and graceful degradation
- ✅ **TypeScript**: Type-safe implementation with comprehensive interfaces

**Usage:**
```bash
# Recommended: Use npm scripts
npm run stream:start    # Scale GWLB ASG → start MediaConnect flows → start MediaLive channels
npm run stream:stop     # Stop MediaLive channels → stop MediaConnect flows → scale down GWLB ASG
npm run stream:status   # Check status of GWLB targets, flows, and channels
npm run stream:restart  # Complete restart with proper sequencing

# Direct usage with custom parameters
npx ts-node scripts/operations/stream-manager.ts start --stack-name MyStack --region us-west-2
npx ts-node scripts/operations/stream-manager.ts stop
npx ts-node scripts/operations/stream-manager.ts status
```

**Parameters:**
- `--stack-name`: CloudFormation stack name (default: StreamInspectionBlogStack)
- `--region`: AWS region (default: us-west-2)

**Exit Codes:**
- `0`: Success
- `1`: Error occurred

### stream-control.sh
**Shell wrapper** for stream-manager.ts with simplified command-line interface for automation.

**Usage:**
```bash
./scripts/operations/stream-control.sh start [stack-name] [region]
./scripts/operations/stream-control.sh stop [stack-name] [region]
./scripts/operations/stream-control.sh status [stack-name] [region]
```

## 🎥 Test Stream Generation

### test-stream.ts
**Professional broadcast test stream generator** with SMPTE standards compliance and LTC audio timecode.

**Broadcast Features:**
- 🎨 **SMPTE Color Bars**: Industry-standard test pattern
- 🎵 **LTC Audio Channel**: Linear Timecode audio signal (1200Hz carrier)
- 📺 **x264 Professional Encoding**: Broadcast-standard settings with constant frame rate
- ⏰ **Visual Timecode Overlay**: System timestamp for monitoring
- 🔊 **Audio Monitoring**: 1kHz sine tone mixed with LTC signal
- 📡 **SRT Transport**: Reliable streaming over SRT protocol

**Technical Specifications:**
- **Video**: SMPTE color bars, 720p/1080p/4K, x264 encoding
- **Audio**: Stereo mix (1kHz tone + 1200Hz LTC signal)
- **Timecode**: System time embedded as SMPTE timecode
- **Transport**: SRT with automatic stack resource discovery
- **Monitoring**: Optional HLS playback with ffplay

**Usage:**
```bash
# Generate continuous test stream with LTC audio
npm run stream:generate
npx ts-node scripts/operations/test-stream.ts

# Generate 5-minute test stream
npx ts-node scripts/operations/test-stream.ts --duration 300

# Generate stream without playback monitoring
npx ts-node scripts/operations/test-stream.ts --no-play

# Custom resolution and bitrate
npx ts-node scripts/operations/test-stream.ts --resolution 720p --bitrate 4000

# Help and all options
npx ts-node scripts/operations/test-stream.ts --help
```

**Options:**
- `--stack-name NAME`: CloudFormation stack name (default: StreamInspectionBlogStack)
- `--region REGION`: AWS region (default: from AWS config)
- `--resolution RES`: Video resolution: 720p, 1080p, 4k (default: 1080p)
- `--bitrate KBPS`: Video bitrate in kbps (default: 8000)
- `--duration SECONDS`: Stream duration in seconds (default: continuous)
- `--no-play`: Disable automatic playback with ffplay

**LTC Audio Technical Details:**
- **Frequency**: 1200Hz carrier (within SMPTE LTC range)
- **Volume**: 30% to avoid overpowering main audio
- **Sample Rate**: 48kHz (broadcast standard)
- **Encoding**: Mixed with main audio in stereo output
- **Compatibility**: Works with professional timecode readers

## 🧹 Infrastructure Cleanup

### cleanup-residual.sh
**Comprehensive cleanup script** for removing AWS resources that may not be automatically cleaned up by CDK destroy.

**Safety Features:**
- 🔍 **Dry-run mode** to preview deletions without executing
- ⚠️ **Interactive confirmation** prompts for destructive operations
- 🎯 **Dependency ordering** for safe resource deletion
- 🎨 **Colored output** with clear progress indicators
- 🛡️ **Error handling** that continues processing if individual resources fail

**Resources Cleaned (10+ AWS Services):**
- **Media Services**: MediaConnect flows, MediaLive channels/inputs, MediaPackage channels/endpoints
- **Compute**: EC2 instances, Auto Scaling Groups, Launch Templates, Key Pairs
- **Networking**: Gateway Load Balancers, Target Groups, VPC Endpoints, Security Groups
- **Storage**: S3 buckets (including GWLB access logs)
- **Monitoring**: CloudWatch Log Groups
- **All resources**: Tagged with 'StreamInspection' or matching naming patterns

**Usage:**
```bash
# Interactive cleanup with confirmation
npm run cleanup:residual
./scripts/operations/cleanup-residual.sh

# Safe preview mode (recommended first step)
./scripts/operations/cleanup-residual.sh --dry-run

# Clean up specific stack and region
./scripts/operations/cleanup-residual.sh --stack-name MyStack --region us-east-1

# Environment variable configuration
STACK_NAME=MyStack DRY_RUN=true ./scripts/operations/cleanup-residual.sh
```

**Options:**
- `--dry-run`: Show what would be deleted without actually deleting
- `--stack-name NAME`: Specify stack name (default: StreamInspectionBlogStack)
- `--region REGION`: Specify AWS region (default: from AWS config)
- `--help`: Show detailed help message

**Cleanup Sequence:**
1. MediaConnect flows (stop → delete)
2. MediaLive resources (stop channels → delete channels → delete inputs)
3. MediaPackage resources (delete endpoints → delete channels)
4. Auto Scaling Groups (scale to 0 → delete)
5. Launch Templates and Load Balancers
6. Security Groups and Key Pairs
7. VPC Endpoints
8. CloudWatch Log Groups
9. S3 Buckets (empty → delete)

### verify-cleanup.sh
**Verification script** to ensure all resources have been properly cleaned up after stack destruction.

**Verification Features:**
- 📊 **Comprehensive checking** across all AWS services used by the stack
- 🔍 **Verbose mode** for detailed resource information
- 🚦 **Exit codes** for automation (0 = clean, >0 = issues found)
- 📈 **Resource counting** and summary reporting
- 💡 **Actionable recommendations** for remaining resources

**Resources Verified (10+ AWS Services):**
- **CloudFormation**: Main and nested stacks
- **Media Services**: MediaConnect, MediaLive, MediaPackage
- **Compute**: EC2 instances, ASGs, Launch Templates, Key Pairs
- **Networking**: Load Balancers, Target Groups, VPCs, Security Groups, VPC Endpoints
- **Serverless**: Lambda functions
- **Monitoring**: CloudWatch Log Groups
- **Storage**: S3 Buckets

**Usage:**
```bash
# Basic verification
npm run cleanup:verify
./scripts/operations/verify-cleanup.sh

# Detailed verification with resource information
./scripts/operations/verify-cleanup.sh --verbose

# Verify specific stack
./scripts/operations/verify-cleanup.sh --stack-name MyStack --region us-east-1

# Use in automation scripts
if ./scripts/operations/verify-cleanup.sh; then
    echo "✅ All resources cleaned up successfully"
else
    echo "⚠️ Issues found - cleanup incomplete"
    exit 1
fi
```

**Options:**
- `--verbose`: Show detailed information about found resources
- `--stack-name NAME`: Specify stack name (default: StreamInspectionBlogStack)
- `--region REGION`: Specify AWS region (default: from AWS config)
- `--help`: Show detailed help message

**Exit Codes:**
- `0`: All resources cleaned up successfully
- `>0`: Number of issues found (resources still exist)

**Sample Output:**
```
🔍 Stream Inspection Stack - Cleanup Verification
📍 Stack: StreamInspectionBlogStack
📍 Region: us-west-2

🚀 Starting comprehensive cleanup verification...

✅ Main stack successfully deleted
✅ No MediaConnect flows remaining
✅ No MediaLive channels remaining
⚠️  CloudWatch log groups still exist: /aws/lambda/StreamInspection-CustomResource

📊 Verification Summary:
   Resources checked: 15
⚠️  Cleanup verification found 1 potential issues
💡 Consider running 'npm run cleanup:residual' to clean up remaining resources
```

## 🔑 Key Management

### download-keypair.ts / download-keypair.sh
**Secure key pair management** utilities for downloading EC2 key pairs from AWS Systems Manager Parameter Store.

**Security Features:**
- 🔐 **SSM Parameter Store**: Secure storage and retrieval
- 🔒 **Proper file permissions** (600) for SSH keys
- 🎯 **Automatic discovery** from CloudFormation stack
- 📁 **Custom output directories** support
- 📦 **Batch download** of multiple key pairs

**Usage:**
```bash
# Download all key pairs from stack
npm run keypair:download
npx ts-node scripts/operations/download-keypair.ts

# Download to specific directory (e.g., ~/.ssh)
./scripts/operations/download-keypair.sh --output-dir ~/.ssh

# Download specific key pair
./scripts/operations/download-keypair.sh --key-name my-key
```

## 🏗️ Best Practices

### Resource Management Workflow

**1. Pre-Deployment Verification**
```bash
# Verify no existing resources that could conflict
npm run cleanup:verify
```

**2. Development Workflow**
```bash
# Start streaming infrastructure for testing
npm run stream:start

# Generate test streams with LTC audio
npm run stream:generate

# Stop resources when done (saves costs)
npm run stream:stop
```

**3. Pre-Destruction Workflow (CRITICAL)**
```bash
# MUST stop all streaming resources before destroying stack
npm run stream:stop

# Verify all resources are stopped
npm run stream:status

# Only then destroy the stack
npx cdk destroy StreamInspectionBlogStack
```

**4. Post-Destruction Cleanup**
```bash
# Preview what residual resources exist
./scripts/operations/cleanup-residual.sh --dry-run

# Clean up any residual resources
npm run cleanup:residual

# Verify complete cleanup
npm run cleanup:verify
```

### Environment Variables

All scripts support these environment variables for customization:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `STACK_NAME` | CloudFormation stack name | StreamInspectionBlogStack | MyCustomStack |
| `AWS_DEFAULT_REGION` | AWS region for operations | us-west-2 | us-east-1 |
| `VERBOSE` | Enable verbose output | false | true |
| `DRY_RUN` | Enable dry-run mode for cleanup | false | true |

**Usage:**
```bash
# Set environment variables
export STACK_NAME=MyCustomStack
export AWS_DEFAULT_REGION=us-east-1
export VERBOSE=true

# Or use inline
STACK_NAME=MyStack VERBOSE=true npm run stream:status
```

### Error Handling & Safety

All scripts implement enterprise-grade error handling:

- **🛡️ Graceful failures**: Scripts continue processing other resources if one fails
- **📝 Clear error messages**: Detailed information about what went wrong and how to fix it
- **🚦 Exit codes**: Proper exit codes for automation and CI/CD integration
- **🔍 Rollback safety**: Dry-run modes to preview changes before execution
- **⚠️ Confirmation prompts**: Interactive confirmation for destructive operations

### Security Considerations

- **🔐 Least privilege**: Scripts only request necessary AWS permissions
- **🚫 No hardcoded credentials**: Uses AWS CLI configuration and IAM roles
- **🛡️ Safe defaults**: Conservative settings to prevent accidental deletions
- **📋 Confirmation prompts**: Interactive confirmation for destructive operations
- **📊 Audit logging**: All operations logged to CloudWatch where applicable

## 🔧 Troubleshooting

### Common Issues & Solutions

**1. AWS CLI not configured**
```bash
# Configure AWS CLI
aws configure

# Or set region via environment variable
export AWS_DEFAULT_REGION=us-west-2
```

**2. Permission denied on scripts**
```bash
# Make scripts executable
chmod +x scripts/operations/*.sh
```

**3. Resources still exist after cleanup**
```bash
# Use verbose mode to see details
./scripts/operations/verify-cleanup.sh --verbose

# Preview what would be cleaned up
./scripts/operations/cleanup-residual.sh --dry-run

# Clean up residual resources
./scripts/operations/cleanup-residual.sh
```

**4. Stream resources won't start**
```bash
# Check GWLB Auto Scaling Group status first
npm run stream:status

# Ensure proper sequencing with restart
npm run stream:stop
sleep 30
npm run stream:start
```

**5. FFmpeg SRT protocol not supported**
```bash
# Verify FFmpeg has SRT support
ffmpeg -protocols | grep srt

# Install FFmpeg with SRT support (macOS)
brew install ffmpeg

# See docs/FFMPEG_INSTALLATION.md for other platforms
```

### Getting Help

Each script includes comprehensive help documentation:

```bash
# Stream management help
npx ts-node scripts/operations/stream-manager.ts --help

# Test stream generation help
npx ts-node scripts/operations/test-stream.ts --help

# Cleanup scripts help
./scripts/operations/cleanup-residual.sh --help
./scripts/operations/verify-cleanup.sh --help
```

### Debug Mode

Enable verbose output for troubleshooting:

```bash
# Enable verbose mode for all scripts
export VERBOSE=true

# Or use inline for specific commands
VERBOSE=true npm run stream:status
VERBOSE=true ./scripts/operations/verify-cleanup.sh
```

## 📚 Additional Resources

- **Main Documentation**: [../../README.md](../../README.md)
- **Architecture Guide**: [../../ARCHITECTURE.md](../../ARCHITECTURE.md)
- **FFmpeg Installation**: [../../docs/FFMPEG_INSTALLATION.md](../../docs/FFMPEG_INSTALLATION.md)
- **Cost Estimation**: [../../docs/COST_ESTIMATION.md](../../docs/COST_ESTIMATION.md)

## 🤝 Contributing

When contributing to operations scripts:

1. **Follow TypeScript best practices** for .ts files
2. **Add comprehensive error handling** for all AWS API calls
3. **Include help text** and parameter validation
4. **Test with dry-run modes** where applicable
5. **Update this README** with new features
6. **Add unit tests** for new functionality
7. **Follow security best practices** (no hardcoded credentials, least privilege)

---

**⚠️ Important**: Always run `npm run stream:stop` before destroying the CDK stack to avoid orphaned resources and unexpected charges.
- SMPTE color bars test pattern
- x264 professional encoding with broadcast-standard settings
- Visual timecode overlays for verification
- LTC (Linear Timecode) audio channel with SMPTE timecode signal
- System timestamp for monitoring
- Automatic stack resource discovery
- HLS playback monitoring with ffplay

**Usage:**
```bash
# Generate continuous test stream
npm run stream:generate
npx ts-node scripts/operations/test-stream.ts

# Generate 5-minute test stream
npx ts-node scripts/operations/test-stream.ts --duration 300

# Generate stream without playback monitoring
npx ts-node scripts/operations/test-stream.ts --no-play

# Custom resolution and bitrate
npx ts-node scripts/operations/test-stream.ts --resolution 720p --bitrate 4000

# Help and options
npx ts-node scripts/operations/test-stream.ts --help
```

**Options:**
- `--stack-name NAME`: CloudFormation stack name (default: StreamInspectionBlogStack)
- `--region REGION`: AWS region (default: from AWS config)
- `--resolution RES`: Video resolution: 720p, 1080p, 4k (default: 1080p)
- `--bitrate KBPS`: Video bitrate in kbps (default: 8000)
- `--duration SECONDS`: Stream duration in seconds (default: continuous)
- `--no-play`: Disable automatic playback with ffplay

## Infrastructure Cleanup

### cleanup-residual.sh
Comprehensive cleanup script for removing AWS resources that may not be automatically cleaned up by CDK destroy.

**Features:**
- Dry-run mode to preview what would be deleted
- Comprehensive resource coverage (MediaConnect, MediaLive, MediaPackage, EC2, Load Balancers, etc.)
- Proper dependency ordering for safe deletion
- Colored output with progress indicators
- Error handling and graceful failures
- Command-line options for customization

**Resources Cleaned:**
- MediaConnect flows
- MediaLive channels and inputs
- MediaPackage channels and origin endpoints
- Auto Scaling Groups and Launch Templates
- Gateway Load Balancers and Target Groups
- Security Groups and Key Pairs
- VPC Endpoints
- CloudWatch Log Groups
- S3 Buckets (including GWLB access logs)

**Usage:**
```bash
# Clean up residual resources (interactive)
npm run cleanup:residual
./scripts/operations/cleanup-residual.sh

# Dry run to see what would be deleted
./scripts/operations/cleanup-residual.sh --dry-run

# Clean up specific stack
./scripts/operations/cleanup-residual.sh --stack-name MyStack --region us-east-1

# Environment variable configuration
STACK_NAME=MyStack DRY_RUN=true ./scripts/operations/cleanup-residual.sh
```

**Options:**
- `--dry-run`: Show what would be deleted without actually deleting
- `--stack-name NAME`: Specify stack name (default: StreamInspectionBlogStack)
- `--region REGION`: Specify AWS region (default: from AWS config)
- `--help`: Show help message

### verify-cleanup.sh
Verification script to ensure all resources have been properly cleaned up after stack destruction.

**Features:**
- Comprehensive resource verification across all AWS services
- Verbose mode for detailed resource information
- Exit codes for automation (0 = clean, >0 = issues found)
- Colored output with clear status indicators
- Resource counting and summary reporting
- Actionable recommendations for remaining resources

**Resources Verified:**
- CloudFormation stacks (main and nested)
- MediaConnect flows
- MediaLive channels and inputs
- MediaPackage channels and origin endpoints
- EC2 instances, Auto Scaling Groups, Launch Templates, Key Pairs
- Gateway Load Balancers and Target Groups
- VPCs, Security Groups, VPC Endpoints
- Lambda functions
- CloudWatch Log Groups
- S3 Buckets

**Usage:**
```bash
# Verify cleanup completion
npm run cleanup:verify
./scripts/operations/verify-cleanup.sh

# Verbose output with detailed resource information
./scripts/operations/verify-cleanup.sh --verbose

# Verify specific stack
./scripts/operations/verify-cleanup.sh --stack-name MyStack --region us-east-1

# Use in automation (check exit code)
if ./scripts/operations/verify-cleanup.sh; then
    echo "Cleanup verified successfully"
else
    echo "Issues found - cleanup incomplete"
fi
```

**Options:**
- `--verbose`: Show detailed information about found resources
- `--stack-name NAME`: Specify stack name (default: StreamInspectionBlogStack)
- `--region REGION`: Specify AWS region (default: from AWS config)
- `--help`: Show help message

**Exit Codes:**
- `0`: All resources cleaned up successfully
- `>0`: Number of issues found (resources still exist)

## Key Management

### download-keypair.ts / download-keypair.sh
Utilities for downloading EC2 key pairs from AWS Systems Manager Parameter Store.

**Features:**
- Automatic key pair discovery from CloudFormation stack
- Secure download from SSM Parameter Store
- Proper file permissions (600) for SSH keys
- Support for custom output directories
- Batch download of multiple key pairs

**Usage:**
```bash
# Download all key pairs from stack
npm run keypair:download
npx ts-node scripts/operations/download-keypair.ts

# Download to specific directory
./scripts/operations/download-keypair.sh --output-dir ~/.ssh

# Download specific key pair
./scripts/operations/download-keypair.sh --key-name my-key
```

## Best Practices

### Resource Management Workflow

1. **Before Deployment:**
   ```bash
   # Verify no existing resources
   npm run cleanup:verify
   ```

2. **During Development:**
   ```bash
   # Start streaming resources for testing
   npm run stream:start
   
   # Generate test streams
   npm run stream:generate
   
   # Stop resources when done
   npm run stream:stop
   ```

3. **Before Destruction:**
   ```bash
   # CRITICAL: Stop all streaming resources first
   npm run stream:stop
   
   # Verify all resources are stopped
   npm run stream:status
   
   # Then destroy the stack
   npx cdk destroy
   ```

4. **After Destruction:**
   ```bash
   # Clean up any residual resources
   npm run cleanup:residual
   
   # Verify complete cleanup
   npm run cleanup:verify
   ```

### Environment Variables

All scripts support these environment variables:

- `STACK_NAME`: CloudFormation stack name (default: StreamInspectionBlogStack)
- `AWS_DEFAULT_REGION`: AWS region for operations
- `VERBOSE`: Enable verbose output (set to 'true')
- `DRY_RUN`: Enable dry-run mode for cleanup (set to 'true')

### Error Handling

All scripts include comprehensive error handling:

- **Graceful failures**: Scripts continue processing other resources if one fails
- **Clear error messages**: Detailed information about what went wrong
- **Exit codes**: Proper exit codes for automation and scripting
- **Rollback safety**: Dry-run modes to preview changes before execution

### Security Considerations

- **Least privilege**: Scripts only request necessary permissions
- **No hardcoded credentials**: Uses AWS CLI configuration and IAM roles
- **Safe defaults**: Conservative settings to prevent accidental deletions
- **Confirmation prompts**: Interactive confirmation for destructive operations
- **Audit logging**: All operations logged to CloudWatch where applicable

## Troubleshooting

### Common Issues

1. **AWS CLI not configured:**
   ```bash
   aws configure
   # or
   export AWS_DEFAULT_REGION=us-west-2
   ```

2. **Permission denied on scripts:**
   ```bash
   chmod +x scripts/operations/*.sh
   ```

3. **Resources still exist after cleanup:**
   ```bash
   # Use verbose mode to see details
   ./scripts/operations/verify-cleanup.sh --verbose
   
   # Try dry-run first
   ./scripts/operations/cleanup-residual.sh --dry-run
   ```

4. **Stream resources won't start:**
   ```bash
   # Check GWLB Auto Scaling Group first
   npm run stream:status
   
   # Ensure proper sequencing
   npm run stream:stop
   npm run stream:start
   ```

### Getting Help

Each script includes a `--help` option with detailed usage information:

```bash
./scripts/operations/cleanup-residual.sh --help
./scripts/operations/verify-cleanup.sh --help
npx ts-node scripts/operations/test-stream.ts --help
```

For additional support, check the main project README.md and ARCHITECTURE.md files.
