# Operations Scripts

Essential operational scripts for managing the Stream Intelligence Blog streaming infrastructure.

## 📋 **Scripts Overview**

### **`stream-manager.ts`** - Simple Stream Management Utility

**Purpose**: Basic lifecycle management for MediaConnect flows and MediaLive channels.

**Features**:
- ✅ **Start Operation**: Starts MediaConnect flows first, then MediaLive channels
- ✅ **Stop Operation**: Stops MediaLive channels first, then MediaConnect flows
- ✅ **Status Check**: Shows current status of all streaming resources
- ✅ **Restart Operation**: Complete restart with proper sequencing
- ✅ **Simple Error Handling**: Basic error handling with clear messages
- ✅ **Resource Discovery**: Automatically finds resources from CloudFormation stack
- ✅ **TypeScript**: Type-safe implementation with simple interfaces

**Usage**:
```bash
# Via npm scripts (recommended)
npm run stream:start    # Start all streaming resources
npm run stream:stop     # Stop all streaming resources
npm run stream:status   # Check status of all resources
npm run stream:restart  # Restart all streaming resources

# Direct usage with ts-node
npx ts-node scripts/operations/stream-manager.ts start
npx ts-node scripts/operations/stream-manager.ts stop
npx ts-node scripts/operations/stream-manager.ts status
npx ts-node scripts/operations/stream-manager.ts restart

# With custom parameters
npx ts-node scripts/operations/stream-manager.ts start --stack-name MyStack --region us-west-2
```

**Parameters**:
- `--stack-name`: CloudFormation stack name (default: StreamInspectionBlogStack)
- `--region`: AWS region (default: us-west-2)

**Exit Codes**:
- `0`: Success
- `1`: Error occurred

### **`test-stream.ts`** - Broadcast Test Stream Generator

**Purpose**: Generates continuous SMPTE color bars with 1kHz audio tone for broadcast testing.

**Features**:
- ✅ **Broadcast Quality**: 1080p resolution at 8Mbps bitrate
- ✅ **Continuous Operation**: Runs until manually stopped (Ctrl+C)
- ✅ **SMPTE Color Bars**: Standard broadcast test pattern
- ✅ **1kHz Audio Tone**: Pure sine wave audio
- ✅ **SRT Streaming**: Direct streaming to MediaConnect
- ✅ **TypeScript**: Type-safe implementation with simple interfaces

**Usage**:
```bash
# Start continuous broadcast stream with HLS playback (default)
npm run stream:generate:broadcast

# Direct TypeScript usage
npx ts-node scripts/operations/test-stream.ts                    # Continuous broadcast
npx ts-node scripts/operations/test-stream.ts --duration 300     # Run for 5 minutes

# Shell wrapper (recommended)
./scripts/operations/run-test-stream.sh                   # Stream with HLS playback (default)
./scripts/operations/run-test-stream.sh --no-play         # Stream without playback
./scripts/operations/run-test-stream.sh --duration 300    # Stream for 5 minutes with playback
./scripts/operations/run-test-stream.sh --verbose         # Verbose output with playback
```

**Parameters**:
- `--stack-name`: CloudFormation stack name (default: StreamInspectionBlogStack)
- `--region`: AWS region (default: us-west-2)
- `--duration`: Stream duration in seconds (default: continuous)
- `--no-play`: Disable HLS output playback (playback is enabled by default)
- `--verbose`: Show FFmpeg output

**What it does**:
1. **Gets URLs**: Retrieves SRT input URL and HLS playback URL from stack outputs
2. **Generates Stream**: Creates SMPTE color bars with 1kHz audio
3. **Streams to MediaConnect**: Sends stream via SRT to your deployed infrastructure
4. **Plays HLS Output**: Opens ffplay window showing the HLS output stream (default behavior)

**Default Configuration**:
- **Resolution**: 1080p (broadcast quality)
- **Bitrate**: 8000 kbps
- **Audio**: 1kHz tone
- **Mode**: Continuous until stopped (Ctrl+C)
- **Playback**: HLS output playback enabled by default

**Stream Playback**:
- Use `--play` flag to open a real-time playback window with ffplay
- Only available in test mode (automatically enables test mode)
- Requires ffplay to be installed (comes with FFmpeg)
- Shows live SMPTE color bars and plays 1kHz audio tone

**Stopping the Stream**:
- Press `Ctrl+C` to gracefully stop the continuous stream
- The utility will cleanly terminate FFmpeg and ffplay processes

**Troubleshooting**:
- Exit code 234: Connection refused - try `--test-mode` to test locally
- Missing FFmpeg: Install FFmpeg with SRT support
- Missing ffplay: Install complete FFmpeg package

### **`download-keypair.ts`** - EC2 Key Pair Download Utility

**Purpose**: Downloads EC2 key pair private keys from AWS Systems Manager Parameter Store for SSH access to instances.

**Features**:
- ✅ **Stack Integration**: Automatically finds key pairs from CloudFormation stack
- ✅ **Parameter Store**: Downloads private keys from AWS Systems Manager
- ✅ **Proper Permissions**: Sets SSH-compatible file permissions (600)
- ✅ **Directory Management**: Creates output directory if needed
- ✅ **Selective Download**: Download specific key pairs or all from stack
- ✅ **Error Handling**: Graceful handling of missing or inaccessible keys
- ✅ **TypeScript**: Type-safe implementation with simple interfaces

**Usage**:
```bash
# Via npm scripts (recommended)
npm run keypair:download                    # Download all keys from default stack
npm run keypair:get -- --key-name my-key   # Download specific key pair

# Direct usage
npx ts-node scripts/operations/download-keypair.ts                    # Download all keys
npx ts-node scripts/operations/download-keypair.ts --key-name my-key  # Specific key
npx ts-node scripts/operations/download-keypair.ts --output-dir ~/.ssh # Custom directory
npx ts-node scripts/operations/download-keypair.ts --stack-name MyStack --region us-east-1

# Shell wrapper
./scripts/operations/download-keypair.sh                       # Download all keys
./scripts/operations/download-keypair.sh --key-name my-key     # Specific key
./scripts/operations/download-keypair.sh --output-dir ~/.ssh   # Custom directory
```

**Parameters**:
- `--stack-name`: CloudFormation stack name (default: StreamInspectionBlogStack)
- `--region`: AWS region (default: us-west-2)
- `--output-dir`: Output directory for key files (default: ./keys)
- `--key-name`: Specific key pair name to download (optional)
- `--help`: Show usage information

**Output**:
- **Key Files**: Saved as `{key-name}.pem` with 600 permissions
- **Directory**: Creates output directory if it doesn't exist
- **Summary**: Reports successful and failed downloads

**Important Notes**:
- Only key pairs created through AWS (after 2021) store private keys in Parameter Store
- Imported or externally created key pairs will not have downloadable private keys
- The script automatically sets proper SSH permissions (600) on downloaded keys
- Keys are saved in PEM format compatible with SSH clients

**SSH Usage**:
```bash
# Connect to EC2 instance using downloaded key
ssh -i keys/my-keypair.pem ec2-user@<instance-ip>

# Or if saved to ~/.ssh directory
ssh -i ~/.ssh/my-keypair.pem ec2-user@<instance-ip>
```

**Exit Codes**:
- `0`: Success
- `1`: General error
- `2`: AWS configuration error
- `3`: Key pairs not found
- `130`: Operation cancelled by user

### **`download-keypair.sh`** - Key Pair Download Shell Wrapper

**Purpose**: Simple bash interface for EC2 key pair download with prerequisite checking.

**Features**:
- ✅ **Prerequisites Check**: Validates Node.js and AWS CLI availability
- ✅ **Parameter Forwarding**: Passes all parameters to Node.js script
- ✅ **Error Handling**: Proper exit code handling and error messages
- ✅ **Help System**: Built-in help and usage information

**Usage**:
```bash
# Via npm script (recommended)
npm run keypair:download

# Direct usage
./scripts/operations/download-keypair.sh                       # Download all keys
./scripts/operations/download-keypair.sh --key-name my-key     # Specific key
./scripts/operations/download-keypair.sh --output-dir ~/.ssh   # Custom directory
./scripts/operations/download-keypair.sh --help               # Show help
```

**Parameters**:
- All parameters are forwarded to the Node.js script
- `--help`: Show usage information


**Purpose**: Simple bash interface for continuous broadcast test stream generation.

**Features**:
- ✅ **Broadcast Quality**: 1080p at 8Mbps continuous streaming
- ✅ **Prerequisites Check**: Validates FFmpeg, Node.js, and AWS CLI
- ✅ **Graceful Shutdown**: Handles Ctrl+C for clean termination
- ✅ **Test Mode Support**: Local file output for testing
- ✅ **Stream Playback**: Real-time monitoring with ffplay

**Usage**:
```bash
# Via npm script (recommended)
npm run stream:generate:broadcast

# Direct usage
./scripts/operations/run-test-stream.sh                   # Start continuous stream
./scripts/operations/run-test-stream.sh --test-mode       # Test locally
./scripts/operations/run-test-stream.sh --test-mode --play # Test and play
./scripts/operations/run-test-stream.sh --verbose         # Show FFmpeg output
```

**Parameters**:
- `--stack-name`: CloudFormation stack name
- `--region`: AWS region
- `--test-mode`: Output to file instead of SRT
- `--play`: Play output stream with ffplay (test mode only)
- `--verbose`: Show FFmpeg output

### **`stream-control.sh`** - Shell Wrapper

**Purpose**: Bash interface for stream-manager.js with simplified usage.

**Features**:
- ✅ **Simple Interface**: Easy-to-use bash commands
- ✅ **Parameter Passing**: Forwards all parameters to stream-manager.js
- ✅ **Error Handling**: Proper exit code handling
- ✅ **Help System**: Built-in help and usage information

**Usage**:
```bash
# Via npm script
npm run stream:control start

# Direct usage
./scripts/operations/stream-control.sh start
./scripts/operations/stream-control.sh stop
./scripts/operations/stream-control.sh status
./scripts/operations/stream-control.sh restart
./scripts/operations/stream-control.sh help

# With parameters
./scripts/operations/stream-control.sh start MyStack us-west-2
```

**Parameters**:
- `start|stop|status|restart`: Operation to perform
- `[stack-name]`: Optional stack name
- `[region]`: Optional AWS region
- `help`: Show usage information

## 🔧 **Prerequisites**

### **System Requirements**
- **Node.js**: Version 18.x or later
- **AWS CLI**: Version 2.x configured with credentials
- **FFmpeg**: Version 4.x or later with SRT support (for test stream generation)
- **Bash**: For shell script execution (Linux/macOS/WSL)
- **Conda**: For environment management (recommended)

### **Environment Setup**
The project includes a conda environment with all dependencies:

```bash
# Create and activate conda environment
conda env create -f environment.yml
conda activate stream-inspection

# Verify FFmpeg installation
npm run verify:ffmpeg

# Or run directly
./scripts/utilities/verify-ffmpeg.sh
```

### **FFmpeg Installation with SRT Support**

**macOS (Homebrew)**:
```bash
# Install FFmpeg with SRT support
brew install ffmpeg

# Verify SRT support
ffmpeg -protocols 2>/dev/null | grep srt
```

**Ubuntu/Debian**:
```bash
# Install FFmpeg
sudo apt update
sudo apt install ffmpeg

# Verify SRT support (may need to compile from source if not included)
ffmpeg -protocols 2>/dev/null | grep srt
```

**Verify Required Components**:
```bash
# Check for required filters and encoders
ffmpeg -filters 2>/dev/null | grep -E "(smptebars|sine|drawtext)"
ffmpeg -encoders 2>/dev/null | grep -E "(libx264|aac)"
```

### **AWS Permissions**
The scripts require the following IAM permissions:

#### **MediaConnect Permissions**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mediaconnect:DescribeFlow",
        "mediaconnect:ListFlows",
        "mediaconnect:StartFlow",
        "mediaconnect:StopFlow"
      ],
      "Resource": "*"
    }
  ]
}
```

#### **MediaLive Permissions**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "medialive:DescribeChannel",
        "medialive:ListChannels",
        "medialive:StartChannel",
        "medialive:StopChannel"
      ],
      "Resource": "*"
    }
  ]
}
```

#### **CloudFormation Permissions**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:DescribeStacks",
        "cloudformation:ListStackResources"
      ],
      "Resource": "*"
    }
  ]
}
```

## 📊 **Operation Details**

### **Start Operation Sequence**
1. **Discovery**: Find MediaConnect flows and MediaLive channels from stack
2. **MediaConnect**: Start all flows and wait for ACTIVE state
3. **MediaLive**: Start all channels and wait for RUNNING state
4. **Status**: Display final status

### **Stop Operation Sequence**
1. **Discovery**: Find MediaConnect flows and MediaLive channels from stack
2. **MediaLive**: Stop all channels and wait for IDLE state
3. **MediaConnect**: Stop all flows and wait for STANDBY state
4. **Status**: Display final status

### **Error Handling**
- **Already Running**: Skips start if resource is already active
- **Already Stopped**: Skips stop if resource is already idle
- **Timeout**: 5-minute timeout for state transitions
- **Clear Messages**: Simple, color-coded status messages

### **Stop Operation Sequence**
1. **Discovery**: Find all running MediaConnect flows and MediaLive channels
2. **MediaLive**: Stop all channels and wait for IDLE state
3. **MediaConnect**: Stop all flows and wait for STANDBY state
4. **Verification**: Confirm all resources are stopped
5. **Reporting**: Display final status and summary

### **Status Check Details**
- **Resource Discovery**: Automatically finds resources from CloudFormation stack
- **Real-time Status**: Queries current state of all resources
- **Health Indicators**: Color-coded status display (green=good, red=error, yellow=transitioning)
- **Summary Report**: Overview of all resource states

## 🚨 **Error Handling**

### **Common Errors and Solutions**

#### **AWS Configuration Errors**
```bash
Error: AWS credentials not configured
Solution: Run 'aws configure' or set AWS environment variables
```

#### **Permission Errors**
```bash
Error: Access denied for MediaConnect operations
Solution: Ensure IAM user/role has required MediaConnect permissions
```

#### **Resource Not Found**
```bash
Error: No MediaConnect flows found in stack
Solution: Verify stack name and ensure resources are deployed
```

#### **Timeout Errors**
```bash
Error: Operation timed out waiting for resource state change
Solution: Increase timeout value or check resource health
```

### **Troubleshooting Steps**
1. **Verify AWS Configuration**: `aws sts get-caller-identity`
2. **Check Stack Exists**: `aws cloudformation describe-stacks --stack-name YourStack`
3. **Verify Permissions**: Test individual AWS CLI commands
4. **Check Resource States**: Use AWS Console to verify resource status
5. **Review Logs**: Check script output for detailed error messages

## 📈 **Performance and Monitoring**

### **Operation Timing**
- **Start Operation**: Typically 2-5 minutes depending on resource count
- **Stop Operation**: Typically 1-3 minutes depending on resource count
- **Status Check**: Usually completes in 10-30 seconds
- **Restart Operation**: Combined start + stop timing

### **Resource Limits**
- **Maximum Flows**: No hard limit, but performance may degrade with >10 flows
- **Maximum Channels**: No hard limit, but performance may degrade with >5 channels
- **Concurrent Operations**: Scripts handle resources sequentially for reliability

### **Monitoring Integration**
- **CloudWatch Logs**: All operations logged to CloudWatch (if configured)
- **AWS CloudTrail**: API calls tracked for audit purposes
- **Console Output**: Real-time progress and status updates
- **Exit Codes**: Proper exit codes for integration with monitoring systems

## 🔄 **Integration Examples**

### **CI/CD Pipeline Integration**
```bash
#!/bin/bash
# Deploy and start streaming infrastructure
npx cdk deploy --require-approval never
if [ $? -eq 0 ]; then
    npm run stream:start
    if [ $? -eq 0 ]; then
        echo "Deployment and startup successful"
    else
        echo "Startup failed"
        exit 1
    fi
else
    echo "Deployment failed"
    exit 1
fi
```

### **Monitoring Script Integration**
```bash
#!/bin/bash
# Check stream status and alert if issues
npm run stream:status > /tmp/stream-status.log
if [ $? -ne 0 ]; then
    # Send alert to monitoring system
    curl -X POST "https://monitoring.example.com/alert" \
         -d "Stream infrastructure has issues - check logs"
fi
```

### **Scheduled Operations**
```bash
# Crontab entry for daily restart (if needed)
# 0 2 * * * cd /path/to/project && npm run stream:restart >> /var/log/stream-restart.log 2>&1
```

---

**Last Updated**: 2025-07-04  
**Scripts Version**: 2.0  
**Compatibility**: Node.js 18+, AWS CLI 2.x  
**Maintenance**: Core operational scripts - handle with care
