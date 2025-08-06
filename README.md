# Stream Intelligence Blog Project

A secure streaming media system on AWS using Gateway Load Balancer to inspect all video traffic without interrupting streams. Built with Infrastructure as Code (CDK).

## Architecture

**Dual-VPC Design with Traffic Inspection:**
- **Stream Processing VPC** - MediaConnect receives SRT streams → MediaLive processes and distributes
- **Security Inspection VPC** - Gateway Load Balancer routes traffic through auto-scaling security appliances
- **100% Traffic Inspection** - All video traffic analyzed while maintaining stream quality

## Quick Start

### Prerequisites
- AWS CLI v2 configured with admin permissions
- Node.js 20+ and npm
- FFmpeg with SRT support (`brew install ffmpeg` on macOS)

### Deploy
```bash
# Install and build
npm install && npm run build

# Deploy with your IP whitelisted
npx cdk deploy StreamInspectionBlogStack \
  --parameters WhitelistCidr=$(curl -s https://checkip.amazonaws.com)/32
```

### Test Your Deployment
```bash
# Start streaming infrastructure
npm run stream:start

# Generate test stream with playback
npm run stream:generate

# Stop when done (important for cost control)
npm run stream:stop
```

## Key Commands

### Stream Management
```bash
npm run stream:start     # Start all streaming resources
npm run stream:stop      # Stop all streaming resources  
npm run stream:status    # Check status of all resources
npm run stream:generate  # Generate test stream with playback
```

### Development
```bash
npm run build           # Compile TypeScript
npm test               # Run unit tests
```

### Cleanup
```bash
# REQUIRED: Stop resources before destroying stack
npm run stream:stop

# Destroy the stack
npx cdk destroy StreamInspectionBlogStack

# Clean up any residual resources
npm run cleanup:residual
```

## Stack Outputs

After deployment, get your streaming URLs:

```bash
# Get SRT input URL for streaming
aws cloudformation describe-stacks \
  --stack-name StreamInspectionBlogStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SrtInputUrl`].OutputValue' \
  --output text

# Get HLS playback URL
aws cloudformation describe-stacks \
  --stack-name StreamInspectionBlogStack \
  --query 'Stacks[0].Outputs[?OutputKey==`PlaybackUrl`].OutputValue' \
  --output text
```

## Security

**Critical**: Always specify `WhitelistCidr` to control which IPs can send streams:

```bash
# Development (your current IP only)
--parameters WhitelistCidr=$(curl -s https://checkip.amazonaws.com)/32

# Production (specific IP range)
--parameters WhitelistCidr=203.0.113.0/24
```

**Never use `0.0.0.0/0` in production** - this allows access from any IP address.

## Project Structure

```
├── lib/                    # CDK constructs
├── scripts/operations/     # Stream management utilities
├── docs/                   # Additional documentation
└── README.md              # This file
```

## Documentation

- **[Architecture Details](ARCHITECTURE.md)** - Technical deep dive
- **[FFmpeg Installation](docs/FFMPEG_INSTALLATION.md)** - Platform-specific setup
- **[Cost Estimation](docs/COST_ESTIMATION.md)** - Pricing guidance

## Troubleshooting

### Common Issues

**MediaConnect Flow Won't Start**
```bash
# Check your IP is whitelisted
aws mediaconnect describe-flow --flow-arn <flow-arn>
```

**Security Appliances Unhealthy**
```bash
# Check instance logs
aws logs get-log-events \
  --log-group-name "/<stack-name>/ec2/security-appliance/setup" \
  --log-stream-name "<instance-id>"
```

**Resources Not Stopping**
```bash
# Force stop all resources
npm run stream:stop
npm run stream:status  # Verify stopped
```

## Cost Management

**Important**: Streaming resources incur charges when running. Always stop resources when not in use:

```bash
npm run stream:stop      # Stop all resources
npm run cleanup:verify   # Verify cleanup after stack destruction
```

Use the [AWS Pricing Calculator](https://calculator.aws) for cost estimates.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests and documentation
4. Run `npm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Note**: This is a demonstration project. For production use, conduct thorough security reviews and performance testing.
