# Stream Intelligence Blog Project

This project demonstrates how to build a secure streaming media system on AWS using Gateway Load Balancer to inspect all video traffic without interrupting your streams. Everything is built using Infrastructure as Code (CDK) for easy deployment and management.

## Architecture Overview

The system uses a dual-VPC architecture with automatic traffic inspection:

### Stream Processing VPC (10.0.0.0/16)
- **MediaConnect** - Receives SRT video streams securely
- **MediaLive** - Processes and distributes streams across multiple AZs
- **Private subnets** - All streaming components isolated from internet

### Security Inspection VPC (10.1.0.0/16)  
- **Gateway Load Balancer** - Routes traffic to security appliances using GENEVE protocol
- **Auto Scaling security appliances** - EC2 instances (c6in.xlarge) that scale 2-4 based on demand
- **Health monitoring** - HTTP health checks ensure appliance readiness

### Traffic Flow
1. SRT stream → MediaConnect → Gateway Load Balancer → Security appliances → MediaLive
2. Security appliances analyze and forward traffic using iptables NAT rules
3. 100% traffic inspection while maintaining stream quality and performance

### Network Security
Simple security group chaining between MediaConnect and MediaLive:
- RTP Traffic: UDP 5000-5100 (Real-time Protocol)  
- RTCP Traffic: UDP 5001-5101 (RTP Control Protocol)
- Least privilege access with network-level isolation

```
MediaConnect Security Group → MediaLive Security Group
- RTP Traffic: UDP 5000-5100 (Real-time Protocol)
- RTCP Traffic: UDP 5001-5101 (RTP Control Protocol)
```

## Security Appliance Features

The security appliances provide:
- **Traffic Forwarding** - iptables-based NAT rules for transparent traffic inspection
- **Health Monitoring** - Simple HTTP health check server on port 80
- **CloudWatch Integration** - Automatic log collection and monitoring
- **Auto Scaling** - Scales from 2-4 instances based on traffic load

## Prerequisites

### Local Environment
- **Conda** - For Python environment management (recommended)
- **AWS CLI** - Version 2.x configured with your credentials
- **CDK** - AWS CDK v2 (`npm install -g aws-cdk`)

### Environment Setup
```bash
# Create and activate the conda environment (includes Node.js 18+, FFmpeg, codecs)
conda env create -f environment.yml
conda activate stream-inspection

# Verify setup
./scripts/utilities/verify-ffmpeg.sh
```

### AWS Account Requirements
- **Admin permissions** to create CloudFormation stacks, VPCs, MediaConnect/MediaLive services, EC2 instances, and Load Balancers
- **Service limits** for 2 VPCs, 1 MediaConnect flow, 1 MediaLive input/channel, 1 Gateway Load Balancer, and 2-4 EC2 instances
```
## Deployment

```bash
# Install dependencies and build
npm install && npm run build

# Deploy with your current IP (recommended)
npx cdk deploy StreamInspectionBlogStack \
  --parameters WhitelistCidr=$(curl -s https://checkip.amazonaws.com)/32

# Or deploy with a specific IP range for production
npx cdk deploy StreamInspectionBlogStack \
  --parameters WhitelistCidr=203.0.113.0/24
  
```

### Parameters

| Parameter | Description | Default | Production Recommendation |
|-----------|-------------|---------|---------------------------|
| **WhitelistCidr** | CIDR block allowed to send SRT streams | 0.0.0.0/0 (allows all IPs) | **Always restrict to specific IP ranges** |

**Note**: The stack automatically uses the first two availability zones in your deployment region for high availability.

## Stack Outputs

After deployment, you'll get these key outputs:

### Core Streaming Outputs

| Output Key | Description | Example Value | Usage |
|------------|-------------|---------------|-------|
| **SrtInputUrl** | SRT input URL for streaming to MediaConnect | `srt://203.0.113.42:5000` | Use this URL in your streaming software (OBS, FFmpeg, etc.) |
| **PlaybackUrl** | HLS playback URL from MediaPackage | `https://abc123.egress.mediapackage-vod.us-east-1.amazonaws.com/out/v1/def456/index.m3u8` | For testing stream playback and distribution |

### Accessing Stack Outputs

#### Using AWS CLI
```bash
# Get all stack outputs
aws cloudformation describe-stacks \
  --stack-name StreamInspectionBlogStack \
  --query 'Stacks[0].Outputs' \
  --output table

# Get specific output value
aws cloudformation describe-stacks \
  --stack-name StreamInspectionBlogStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SrtInputUrl`].OutputValue' \
  --output text
```

#### Using CDK CLI
```bash
# Deploy and save outputs to file
npx cdk deploy StreamInspectionBlogStack \
  --parameters WhitelistCidr=$(curl -s https://checkip.amazonaws.com)/32 \
  --outputs-file deployment-outputs.json

# View outputs file
cat deployment-outputs.json
```

#### Example Output File (`deployment-outputs.json`)
```json
{
  "StreamInspectionBlogStack": {
    "SrtInputUrl": "srt://203.0.113.42:5000",
    "PlaybackUrl": "https://abc123.egress.mediapackage-vod.us-east-1.amazonaws.com/out/v1/def456/index.m3u8"
  }
}
```

### Using Outputs for Stream Management

#### 1. Start Streaming with SRT URL
```bash
# Get SRT URL from stack outputs
SRT_URL=$(aws cloudformation describe-stacks \
  --stack-name StreamInspectionBlogStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SrtInputUrl`].OutputValue' \
  --output text)

# Use with FFmpeg for test stream
ffmpeg -re -f lavfi -i testsrc2=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000:sample_rate=48000 \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -c:a aac -b:a 128k \
  -f mpegts "$SRT_URL"
```

#### 2. Test Stream Playback
```bash
# Get playback URL from stack outputs
PLAYBACK_URL=$(aws cloudformation describe-stacks \
  --stack-name StreamInspectionBlogStack \
  --query 'Stacks[0].Outputs[?OutputKey==`PlaybackUrl`].OutputValue' \
  --output text)

# Test playback with FFmpeg
ffmpeg -i "$PLAYBACK_URL" -t 30 -f null -

# Open in browser or media player
echo "Playback URL: $PLAYBACK_URL"
```

### Output Usage in Scripts

The project's stream management utilities automatically discover and use stack resources:

```bash
# Stream manager discovers resources automatically from stack
npm run stream:start    # Discovers and starts MediaConnect flows and MediaLive channels
npm run stream:status   # Queries all streaming resources in the stack
npm run stream:stop     # Discovers and stops all streaming resources

# Test stream generation uses SrtInputUrl output
npm run stream:generate  # Uses SrtInputUrl and PlaybackUrl outputs
```

### Important Notes

- **SRT URL Security**: The SRT input URL is only accessible from IPs in your `WhitelistCidr` parameter
- **Flow Management**: MediaConnect flows are created in `STANDBY` state and must be started before streaming
- **Playback Availability**: The HLS playback URL becomes active only after MediaLive channel is started and receiving input
- **Regional Resources**: All outputs are region-specific and tied to your deployment region

### IP Whitelisting and Security

**Critical Security Requirement**: Always specify the `WhitelistCidr` parameter to control which IP addresses can send SRT streams to your MediaConnect flows.

```bash
# Get your current public IP
curl -s https://checkip.amazonaws.com

# Deploy with your current IP (recommended for development)
npx cdk deploy StreamInspectionBlogStack \
  --parameters WhitelistCidr=$(curl -s https://checkip.amazonaws.com)/32

# Deploy with a specific IP range (recommended for production)
npx cdk deploy StreamInspectionBlogStack \
  --parameters WhitelistCidr=203.0.113.0/24
```

**Security Best Practices:**
- **Never use `0.0.0.0/0`** in production environments - this allows access from any IP address
- **Use specific IP ranges** for known streaming sources and office networks
- **Consider VPN or AWS Direct Connect** for additional security layers
- **Regularly audit and update** IP whitelists as your infrastructure changes
- **Implement additional authentication** mechanisms for sensitive content streams
- **Monitor MediaConnect metrics** for unauthorized connection attempts

## Testing Your Deployment

```bash
# 1. Verify FFmpeg installation and codecs
npm run verify:ffmpeg

# 2. Start streaming infrastructure (GWLB ASG → MediaConnect flows → MediaLive channels)
npm run stream:start

# 3. Generate test stream with HLS playback
npm run stream:generate

# 4. Stop streaming infrastructure (MediaLive channels → MediaConnect flows → GWLB ASG)
npm run stream:stop
```

**💡 Pro tip**: Always stop streaming resources when finished testing to avoid unnecessary charges.

**🔧 What happens during start/stop:**
- **Start**: Scales GWLB Auto Scaling Group to 2 instances → waits for targets to be healthy → starts MediaConnect flows → starts MediaLive channels
- **Stop**: Stops MediaLive channels → stops MediaConnect flows → scales GWLB Auto Scaling Group to 0 instances

## Cleanup and Destruction

### ⚠️ Warning

You **MUST** stop all streaming resources before destroying the stack, otherwise the destruction will fail and leave orphaned resources that continue to incur charges.

### Complete Cleanup Process

#### 1. Stop All Streaming Resources (Required)

```bash
# Stop all streaming resources first
npm run stream:stop

# Verify all resources are stopped
npm run stream:status

# Wait for all resources to reach IDLE/STOPPED state before proceeding
```

#### 2. Destroy the CDK Stack

```bash
# Destroy the main stack
npx cdk destroy StreamInspectionBlogStack

# Confirm destruction when prompted
```

#### 3. Clean Up Residual Resources

Some AWS resources may not be automatically cleaned up by CDK destroy:

```bash
# Clean up residual resources
npm run cleanup:residual
```

#### 4. Verify Complete Cleanup

```bash
# Verify no resources remain
npm run cleanup:verify
```

### Manual Cleanup (If Needed)

If automated cleanup doesn't remove everything, manually check and remove these resources:

```bash
# Check for remaining MediaConnect flows
aws mediaconnect list-flows

# Check for remaining MediaLive resources
aws medialive list-inputs
aws medialive list-channels

# Check for remaining CloudWatch log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/StreamInspection"

# Remove any found resources manually
aws mediaconnect delete-flow --flow-arn <flow-arn>
aws medialive delete-input --input-id <input-id>
aws logs delete-log-group --log-group-name <log-group-name>
```

### Cost Monitoring After Cleanup

After cleanup, monitor your AWS bill to ensure no charges continue:

```bash
# Check current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[*].Groups[?Keys[0]==`Amazon Elastic Compute Cloud - Compute` || Keys[0]==`AWS Elemental MediaConnect` || Keys[0]==`AWS Elemental MediaLive`]'
```

### Post-Deployment Configuration

#### 1. Stream Management (Recommended)

## Usage Examples

### Complete Workflow

```bash
# 1. Set up environment
conda env create -f environment.yml
conda activate stream-inspection

# 2. Install dependencies and build
npm install
npm run build

# 3. Deploy infrastructure
npx cdk deploy StreamInspectionBlogStack --parameters WhitelistCidr=$(curl -s https://checkip.amazonaws.com)/32

# 4. Start streaming services (GWLB ASG → MediaConnect flows → MediaLive channels)
npm run stream:start

# 5. Generate test stream with playback
npm run stream:generate

# 6. Stop streaming services when done (MediaLive channels → MediaConnect flows → GWLB ASG)
npm run stream:stop
```

### Stream Management

```bash
# Check current status
npm run stream:status

# Start all resources
npm run stream:start

# Stop all resources  
npm run stream:stop

# Restart everything
npm run stream:restart
```

### Test Stream Generation

```bash
# Generate continuous test stream with HLS playback
./scripts/operations/run-test-stream.sh

# Generate 5-minute test stream
./scripts/operations/run-test-stream.sh --duration 300

# Generate stream without playback
./scripts/operations/run-test-stream.sh --no-play

# Generate with verbose FFmpeg output
./scripts/operations/run-test-stream.sh --verbose
```

### Key Pair Management

```bash
# Download all EC2 key pairs from the stack
npm run keypair:download

# Download specific key pair
./scripts/operations/download-keypair.sh --key-name my-key

# Save keys to ~/.ssh directory
./scripts/operations/download-keypair.sh --output-dir ~/.ssh
```

### Troubleshooting

```bash
# Verify FFmpeg installation
npm run verify:ffmpeg

# Check CDK and AWS configuration
npm run doctor

# Run security checks
npm run security:check

# Clean build artifacts
npm run clean
```

### Environment Variables

The following environment variables can be used to customize behavior:

```bash
# Enable verbose FFmpeg output in test streams
export VERBOSE=true

# Set default AWS region
export AWS_DEFAULT_REGION=us-west-2

# Set default stack name
export STACK_NAME=MyCustomStack
```

The project includes comprehensive stream management utilities for easy lifecycle management:

# Stop all streaming resources
npm run stream:stop

# Check status of all resources
npm run stream:status

# Restart all streaming resources
npm run stream:restart

# Test stream management utilities
npm run stream:test
```

**Advanced Usage:**
```bash
# Use with custom stack name and region
npx ts-node scripts/operations/stream-manager.ts start --stack-name StreamInspectionBlogStack --region us-west-2

# Use shell script wrapper
./scripts/operations/stream-control.sh start StreamInspectionBlogStack us-west-2

# Check status only
npm run stream:status
```

**Stream Manager Features:**
- **Automatic Resource Discovery**: Finds all MediaConnect flows and MediaLive channels from your stack
- **Proper Sequencing**: Starts MediaConnect flows first, then MediaLive channels
- **Real-time Monitoring**: Shows progress with colored status updates
- **Error Handling**: Graceful error handling with detailed messages
- **State Management**: Waits for resources to reach desired states before proceeding

#### 2. Verify Everything is Working

Use the stream manager to check your deployment status:

```bash
# Check status of all streaming resources
npm run stream:status

# Test the stream manager utilities
npm run stream:test
```

You can also use AWS CLI commands to verify individual components:

```bash
# Check MediaConnect flows status
aws mediaconnect list-flows

# Check MediaLive inputs
aws medialive list-inputs

# Check Gateway Load Balancer
aws elbv2 describe-load-balancers --query 'LoadBalancers[?Type==`gateway`]'

# Check Auto Scaling Group
aws autoscaling describe-auto-scaling-groups
```

#### 3. Monitor System Health

Keep an eye on these important metrics:
- **MediaConnect**: Source errors, bitrate, connection status
- **MediaLive**: Input errors, processing status, output health
- **Gateway Load Balancer**: Active flows, target health, throughput, access logs
- **Security Appliances**: CPU utilization, network throughput, health checks

#### 4. Analyze Gateway Load Balancer Access Logs

The system automatically enables access logging for the Gateway Load Balancer to track traffic patterns and security events:

```bash
# View recent access logs
npm run view:gwlb-logs

# Get access logs bucket name from stack outputs
aws cloudformation describe-stacks --stack-name StreamInspectionBlogStack \
  --query 'Stacks[0].Outputs[?OutputKey==`GWLBAccessLogsBucket`].OutputValue' --output text

# Download specific log files
aws s3 cp s3://gwlb-access-logs-bucket/gwlb-access-logs/ ./ --recursive
```

## Documentation

### Architecture and Design
- **[Architecture Documentation](ARCHITECTURE.md)** - How the system works, why it's built this way, and technical details

### Stream Management
- **[Latency Testing](docs/LATENCY_TESTING.md)** - End-to-end streaming performance testing

### Code Documentation

All source code includes clear documentation:

#### TypeScript Interfaces
- **Clear descriptions** of what each property does
- **Type safety** with strict TypeScript rules
- **JSDoc comments** for all public functions
- **Inline comments** explaining important decisions

#### CDK Constructs
Each piece of infrastructure has detailed documentation:

```typescript
/**
 * Example: Creating a MediaConnect flow
 * 
 * This shows how to create a reliable MediaConnect flow
 * with proper security settings.
 */
const contribution = new ContributionConstruct(this, 'StreamContribution', {
  vpc: streamingVpc,
  flowName: 'LiveStreamFlow',
  flowDescription: 'Primary live stream with automatic backup',
  srtSource: {
    name: 'LiveSource',
    description: 'Live stream from studio',
    port: 5000
  },
  whitelistCidr: '203.0.113.0/24', // Only allow specific IPs
  availabilityZone: 'us-east-1a',
  destinationIp: '10.0.1.100',
  destinationPort: 5000, // RTP port range 5000-5100
  subnetId: 'subnet-12345678'
});
```

#### Security Documentation
- **Security considerations** for each component
- **Best practices** for production use
- **Compliance guidelines** for regulated industries
- **Threat analysis** and how to prevent problems

## Development

### Project Structure

```
stream-intelligence-blog/
├── lib/                                    # CDK constructs and stacks
│   ├── stream-inspection-blog-stack.ts    # Main orchestration stack
│   ├── gwlb-construct.ts                  # Gateway Load Balancer + security appliances
│   ├── contribution-construct.ts          # MediaConnect flows for SRT ingestion
│   ├── distribution-construct.ts          # MediaLive input for stream distribution
│   ├── ott-streaming-construct.ts         # OTT streaming components (MediaPackage)
│   ├── vpc-flow-logs-construct.ts         # VPC Flow Logs for network monitoring
│   ├── custom-resources/                  # Custom CloudFormation resources
│   │   ├── mediapackage-ingest-urls/      # MediaPackage URL management
│   │   └── README.md                      # Custom resources documentation
│   └── user-data/                         # Security appliance configuration scripts
│       ├── setup.sh                      # Main setup script for security appliances
│       ├── install-suricata.sh           # Optional Suricata IDS installation
│       └── README.md                     # User data documentation
├── bin/
│   └── stream-intelligence-blog.ts        # CDK application entry point
├── scripts/                               # Operational and testing scripts
│   ├── operations/                        # Core operational scripts
│   │   ├── stream-manager.ts             # Enhanced stream management with GWLB control
│   │   ├── stream-control.sh             # Shell wrapper for stream management
│   │   ├── test-stream.ts                # Test stream generation utility
│   │   ├── run-test-stream.sh            # Test stream runner script
│   │   ├── download-keypair.ts           # EC2 key pair management
│   │   ├── cleanup-residual.sh           # Post-deployment cleanup utility
│   │   ├── verify-cleanup.sh             # Cleanup verification script
│   │   └── README.md                     # Operations documentation
│   ├── tests/                            # Testing and validation scripts
│   │   ├── run-latency-test.sh           # Latency testing framework
│   │   ├── analyze-latency-results.js    # Latency analysis and reporting
│   │   ├── test-enhanced-stream-manager.ts # Stream manager validation tests
│   │   └── README.md                     # Testing documentation
│   ├── utilities/                        # Utility and helper scripts
│   │   ├── verify-ffmpeg.sh             # FFmpeg installation verification
│   │   └── README.md                    # Utilities documentation
│   └── README.md                         # Scripts overview
├── tests/                                 # Additional test examples and utilities
│   ├── examples/                         # Example test configurations
│   └── latency-test/                     # Legacy latency testing utilities
├── docs/                                 # Additional documentation
│   └── COST_ESTIMATION.md               # Cost analysis and estimation guide
├── ARCHITECTURE.md                       # Detailed architecture documentation
├── README.md                            # Main project documentation
└── cdk.out/                             # CDK synthesis output (generated)
```

### Development Workflow

#### 1. Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd stream-intelligence-blog

# Install dependencies
npm install

# Set up development environment
conda env create -f environment.yml
conda activate stream-inspection
```

#### 2. Development Commands
```bash
# Compile TypeScript to JavaScript
npm run build

# Watch for changes and auto-compile
npm run watch

# Run unit tests with coverage
npm test

# Run integration tests
npm run test:integration

# Lint code for quality and consistency
npm run lint

# Format code according to project standards
npm run format
```

#### 3. CDK Development Commands
```bash
# Check differences between deployed and local code
npx cdk diff

# Synthesize CloudFormation templates
npx cdk synth

# Validate CDK code and templates
npx cdk doctor

# Deploy to development environment
npx cdk deploy --profile dev

# Destroy development resources
npx cdk destroy --profile dev
```

### Development Best Practices

#### Code Quality
- **Type Safety**: Full TypeScript with strict type checking enabled
- **Documentation**: Comprehensive JSDoc comments for all public APIs
- **Testing**: Unit tests for all constructs with >90% coverage
- **Linting**: ESLint configuration with security and best practice rules
- **Formatting**: Prettier configuration for consistent code style

#### Security Practices
- **Least Privilege**: IAM roles with minimal required permissions
- **Network Security**: Security groups with restrictive rules
- **Secrets Management**: No hardcoded secrets or credentials
- **Encryption**: Encryption in transit and at rest where applicable
- **Audit Logging**: Comprehensive logging for security events

#### Performance Optimization
- **Resource Sizing**: Appropriate instance types and scaling policies
- **Network Optimization**: Enhanced networking and placement groups
- **Monitoring**: CloudWatch metrics and alarms for performance tracking
- **Cost Optimization**: Resource tagging and cost allocation

### Testing Strategy

#### Unit Tests
```bash
# Run all unit tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- contribution-construct.test.ts
```

#### Integration Tests
```bash
# Deploy test stack
npm run test:deploy

# Run integration tests
npm run test:integration

# Clean up test resources
npm run test:cleanup
```

#### Load Testing
```bash
# Generate test streams
npm run test:load-generate

# Monitor performance during load test
npm run test:load-monitor

# Analyze load test results
npm run test:load-analyze
```

## Operational Procedures

### Monitoring and Alerting

#### CloudWatch Integration
The deployment automatically integrates with CloudWatch for:
- **Media Processing**: MediaConnect and MediaLive automatically send metrics to CloudWatch
- **Network Security**: Gateway Load Balancer and security appliance metrics are available
- **Infrastructure**: VPC Flow Logs, EC2, and Auto Scaling metrics are collected
- **Application Logs**: Lambda functions and security appliances send logs to CloudWatch

#### Creating Custom Dashboards
You can create custom CloudWatch dashboards to monitor your streaming infrastructure:

```bash
# Create a basic dashboard for streaming metrics
aws cloudwatch put-dashboard \
  --dashboard-name "StreamInspectionDashboard" \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [
            ["AWS/MediaConnect", "SourceErrors"],
            ["AWS/MediaLive", "InputVideoFrameRate"],
            ["AWS/ApplicationELB", "ActiveFlowCount_TCP"]
          ],
          "period": 300,
          "stat": "Average",
          "region": "us-east-1",
          "title": "Streaming Health"
        }
      }
    ]
  }'
```

#### Recommended Alarms
```bash
# Create CloudWatch alarms for critical metrics
aws cloudwatch put-metric-alarm \
  --alarm-name "MediaConnect-SourceErrors" \
  --alarm-description "MediaConnect source errors detected" \
  --metric-name SourceErrors \
  --namespace AWS/MediaConnect \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold
```

### Maintenance Procedures

#### Security Appliance Updates
```bash
# Update security appliances with rolling deployment
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name SecurityAppliances-ASG \
  --preferences MinHealthyPercentage=50,InstanceWarmup=300
```

#### Stream Infrastructure Management
```bash
# Start all streaming resources (recommended)
npm run stream:start

# Stop all streaming resources
npm run stream:stop

# Check status of all resources
npm run stream:status

# Restart all streaming resources
npm run stream:restart

# Alternative: Use AWS CLI for individual resources
aws mediaconnect start-flow --flow-arn <flow-arn>
aws mediaconnect stop-flow --flow-arn <flow-arn>
aws mediaconnect describe-flow --flow-arn <flow-arn>
```

### Troubleshooting

#### Common Issues and Solutions

1. **MediaConnect Flow Not Starting**
   ```bash
   # Check flow configuration
   aws mediaconnect describe-flow --flow-arn <flow-arn>
   
   # Verify source IP whitelist
   # Ensure your IP is in the WhitelistCidr parameter
   ```

2. **Security Appliances Unhealthy**
   ```bash
   # Check instance logs via CloudWatch
   aws logs get-log-events \
     --log-group-name "/<stack-name>/ec2/security-appliance/setup" \
     --log-stream-name "<instance-id>"
   
   # Check instance directly (if accessible)
   aws ssm start-session --target <instance-id>
   sudo tail -f /var/log/cloud-init-output.log
   
   # Verify health check endpoint
   curl http://localhost/health
   ```

3. **Gateway Load Balancer No Targets**
   ```bash
   # Check Auto Scaling Group
   aws autoscaling describe-auto-scaling-groups \
     --auto-scaling-group-names SecurityAppliances-ASG
   
   # Check target group health
   aws elbv2 describe-target-health --target-group-arn <target-group-arn>
   
   # Check if instances are running setup script
   aws ec2 describe-instances \
     --filters "Name=tag:aws:autoscaling:groupName,Values=SecurityAppliances-ASG" \
     --query 'Reservations[].Instances[].{InstanceId:InstanceId,State:State.Name}'
   ```

4. **Setup Script Failures**
   ```bash
   # Check user data execution logs
   aws ssm start-session --target <instance-id>
   sudo tail -f /var/log/cloud-init-output.log
   
   # Check if setup script exists
   ls -la /opt/security-appliance/
   
   # Manually run setup script for debugging
   cd /opt/security-appliance
   sudo ./setup.sh <vpc-id> <stack-name> false
   ```

#### Troubleshooting
```bash
# Check CloudFormation stack events
aws cloudformation describe-stack-events --stack-name StreamInspectionBlogStack

# Check stack outputs for resource ARNs
aws cloudformation describe-stacks --stack-name StreamInspectionBlogStack --query 'Stacks[0].Outputs'

# Check all security appliance instances
aws ec2 describe-instances \
  --filters "Name=tag:aws:autoscaling:groupName,Values=SecurityAppliances-ASG" \
  --query 'Reservations[].Instances[].[InstanceId,State.Name,LaunchTime]' \
  --output table
```

## Useful Commands

### 🎯 Stream Management (Most Important)
```bash
npm run stream:start     # Scales GWLB ASG → starts MediaConnect flows → starts MediaLive channels
npm run stream:stop      # Stops MediaLive channels → stops MediaConnect flows → scales down GWLB ASG
npm run stream:status    # Shows GWLB targets, MediaConnect flows, and MediaLive channels status
npm run stream:restart   # Complete stop and start cycle with proper sequencing
npm run stream:test      # Validates stream management utilities
npm run stream:generate  # Creates test video stream with HLS playback
```

### 📊 Performance Testing
```bash
npm run latency:quick     # 30-second test (720p, 1Mbps) - good for basic validation
npm run latency:standard  # 1-minute test (720p, 2Mbps) - standard quality check
npm run latency:extended  # 5-minute test (1080p, 4Mbps) - thorough performance test
npm run latency:stress    # 10-minute test (1080p, 8Mbps) - stress test infrastructure
npm run latency:analyze   # Analyzes latency test results from log files
npm run latency:compare   # Compares multiple test results side-by-side
```

### 🧹 Cleanup (Critical for Cost Management)
```bash
npm run cleanup:residual  # Removes leftover resources after stack deletion
npm run cleanup:verify    # Confirms all resources are actually deleted
```

### 🛠️ Development & Testing
```bash
npm run build            # Compiles TypeScript to JavaScript
npm run test             # Runs Jest unit tests with coverage report
npm run lint             # Checks code quality with ESLint
npm run format           # Auto-formats code with Prettier
npm run verify:ffmpeg    # Confirms FFmpeg installation and codec support
```

### 🔒 Security & Deployment
```bash
npm run security:check   # Comprehensive security review with cdk-nag
npm run deploy:secure    # Runs security checks before deployment
npx cdk deploy StreamInspectionBlogStack --parameters WhitelistCidr=YOUR_IP/32
npx cdk destroy StreamInspectionBlogStack  # Deletes the entire stack
```

### 📈 AWS Monitoring 
```bash
# MediaConnect and MediaLive
aws mediaconnect list-flows                    # Lists all MediaConnect flows
aws medialive list-channels                    # Lists all MediaLive channels

# Infrastructure
aws elbv2 describe-load-balancers --query 'LoadBalancers[?Type==`gateway`]'
aws autoscaling describe-auto-scaling-groups   # Shows Auto Scaling Groups
aws cloudformation describe-stacks --stack-name StreamInspectionBlogStack

# Monitoring
aws cloudwatch get-metric-statistics           # Retrieves CloudWatch metrics
aws logs describe-log-groups                   # Lists CloudWatch log groups
```

## Contributing

We welcome contributions to improve this project! Please follow these guidelines:

### Development Guidelines
1. **Follow TypeScript best practices** - Use strict typing and proper interfaces
2. **Add comprehensive documentation** - Include JSDoc comments for all public APIs
3. **Write unit tests** - Test all new constructs and functionality with >90% coverage
4. **Update documentation** - Keep README and architecture docs current
5. **Follow security practices** - Use least-privilege IAM and secure configurations
6. **Performance considerations** - Optimize for cost and performance

### Contribution Process
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with proper documentation
4. Add or update tests as needed
5. Run the full test suite (`npm test`)
6. Update documentation if needed
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request with detailed description

### Code Review Checklist
- [ ] Code follows TypeScript best practices
- [ ] All public APIs have JSDoc documentation
- [ ] Unit tests added/updated with good coverage
- [ ] Integration tests pass
- [ ] Security considerations documented
- [ ] Performance impact assessed
- [ ] Documentation updated
- [ ] No hardcoded secrets or credentials

## Security Considerations

This project implements  with comprehensive IAM permissions following the principle of least privilege. All critical security vulnerabilities have been resolved.

# Security review with cdk-nag
npm run security:check

# Quick security check
npm run security:quick

# Secure deployment (runs security checks first)
npm run deploy:secure

### Cost Estimates
Use the [AWS Pricing Calculator](https://calculator.aws) for accurate cost estimates based on your specific usage patterns and requirements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support and Community

### Getting Help
- **Documentation**: Check the documentation in this README and AmazonQ.md
- **Troubleshooting**: Use the troubleshooting commands above for diagnostics
- **Issues**: Open GitHub issues for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and community support

### Community Resources
- **AWS Media Services**: [AWS Media Services Documentation](https://docs.aws.amazon.com/media-services/)
- **AWS CDK**: [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)
- **Gateway Load Balancer**: [Gateway Load Balancer User Guide](https://docs.aws.amazon.com/elasticloadbalancing/latest/gateway/)

### Professional Support
For enterprise support and professional services:
- **AWS Support**: Consider AWS Enterprise Support for production workloads
- **AWS Professional Services**: Engage AWS Professional Services for custom implementations
- **AWS Partners**: Work with AWS Partners for specialized expertise

---

**Note**: This is a demonstration project. For production deployments, conduct thorough security reviews, performance testing, and compliance validation according to your organization's requirements.