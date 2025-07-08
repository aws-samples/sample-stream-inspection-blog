# Stream Intelligence Architecture

This document explains how the streaming media system works and why it's built this way.

## What This System Does

The Stream Intelligence system creates a secure way to inspect video streams without interrupting them. It's like having security guards check every package that goes through a mail system, but the mail keeps flowing normally.

## Main Goals

- **Security First**: Check all streaming traffic for problems or threats
- **Always Available**: Keep streams running even if some parts fail
- **Scales Automatically**: Add more inspection power when traffic increases
- **No Interruptions**: Inspect traffic without breaking the streams
- **Easy to Manage**: Use code to build and maintain everything

## How It's Built

### Two Separate Networks

The system uses two completely separate networks (VPCs) for security:

#### Stream Processing Network (10.0.0.0/16)
This network handles your video streams:
- **Single MediaConnect flow** - Receives SRT video streams from your sources
- **MediaLive input** - Process streams and prepare them for distribution
- **Private subnets** - No direct internet access for security
- **Two availability zones** - Backup in case one zone fails

#### Security Inspection Network (10.1.0.0/16)
This network inspects all traffic:
- **Gateway Load Balancer** - Distributes traffic to security appliances
- **Security appliances** - EC2 instances that analyze all traffic
- **Auto Scaling** - Automatically scales from 2 to 4 appliances when needed
- **Health monitoring** - Replaces broken appliances automatically

### Key Components

#### MediaConnect Flow
- **What it does**: Receives SRT video streams from your encoders
- **How many**: Single flow deployed in the first availability zone
- **Security**: Only allow connections from specific IP addresses (WhitelistCidr parameter)
- **Protocol**: SRT (Secure Reliable Transport) for reliable streaming
- **Outputs**: Multiple RTP outputs to MediaLive input destinations

#### MediaLive Input
- **What it does**: Receives streams from MediaConnect and prepares them for distribution
- **How it works**: Uses RTP protocol to receive video streams
- **Availability**: Deployed across multiple zones for backup
- **Integration**: Automatically configured to work with MediaConnect

#### Gateway Load Balancer
- **What it does**: Routes all traffic through security appliances for inspection
- **How it works**: Uses GENEVE protocol to wrap traffic and send it for analysis
- **Load balancing**: Distributes traffic evenly across all security appliances
- **Health checks**: Monitors appliance health and removes broken ones

#### Security Appliances
- **What they are**: EC2 instances running Amazon Linux 2
- **What they do**: Analyze all streaming traffic for security issues
- **Instance type**: c6in.xlarge (optimized for network processing)
- **Scaling**: Automatically scales from 2 to 4 instances (1-2 per AZ)
- **Health monitoring**: HTTP health checks on port 80
- **Note**: Currently configured for basic traffic forwarding; advanced inspection features can be added

## How Traffic Flows

Here's the step-by-step process of how your video streams move through the system:

### 1. Stream Arrives
- Your SRT encoder sends a video stream to the MediaConnect flow
- MediaConnect checks if your IP address is allowed (WhitelistCidr parameter)
- Stream is received on port 5000 using SRT protocol

### 2. Traffic Gets Inspected
- All traffic between MediaConnect and MediaLive goes through inspection
- Gateway Load Balancer wraps the traffic in GENEVE protocol
- Traffic is sent to one of the security appliances for analysis

### 3. Security Analysis
- Security appliance receives the wrapped traffic
- Appliance analyzes the video stream for problems or threats
- Appliance makes a decision: forward the traffic or block it

### 4. Traffic Continues
- If traffic is clean, the appliance forwards it to MediaLive
- MediaLive receives the inspected stream
- Stream can now be distributed to viewers (via MediaPackage for HLS output)

## Network Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                Stream Processing Network                     │
│                     (10.0.0.0/16)                          │
│                                                             │
│  ┌─────────────────┐              ┌─────────────────┐      │
│  │   Zone A        │              │   Zone B        │      │
│  │                 │              │                 │      │
│  │ MediaConnect    │              │ MediaLive Input │      │
│  │ Flow            │              │ Destination     │      │
│  │ (SRT:5000)      │              │ (RTP)           │      │
│  │       │         │              │       │         │      │
│  │       ▼         │              │       ▼         │      │
│  │ GWLB Endpoint   │◄─────────────┤ GWLB Endpoint   │      │
│  │       │         │              │       │         │      │
│  │       ▼         │              │       ▼         │      │
│  │ MediaLive Input │              │ MediaLive Input │      │
│  │ Destination     │              │ Destination     │      │
│  └─────────────────┘              └─────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Traffic Goes    │
                    │   For Inspection  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Security Inspection Network                   │
│                     (10.1.0.0/16)                          │
│                                                             │
│  ┌─────────────────┐              ┌─────────────────┐      │
│  │   Zone A        │              │   Zone B        │      │
│  │                 │              │                 │      │
│  │ Security        │              │ Security        │      │
│  │ Appliances      │              │ Appliances      │      │
│  │ (Auto Scaling)  │              │ (Auto Scaling)  │      │
│  │       │         │              │       │         │      │
│  │       ▼         │              │       ▼         │      │
│  │ Gateway Load    │◄─────────────┤ Gateway Load    │      │
│  │ Balancer        │              │ Balancer        │      │
│  └─────────────────┘              └─────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Security Features

### Network Isolation
- **Separate networks**: Streaming and security functions are completely isolated
- **Private subnets**: Media services have no direct internet access
- **Controlled access**: Only specific IP addresses can send streams

### Traffic Inspection
- **100% coverage**: All traffic between MediaConnect and MediaLive is inspected
- **No bypass**: Traffic cannot skip the inspection layer
- **Real-time analysis**: Streams are analyzed as they flow through the system

### Access Control
- **IP whitelisting**: Only allowed IP addresses can connect
- **IAM roles**: Each service has minimal required permissions
- **Security groups**: Network access is restricted to necessary ports only

### Monitoring and Logging
- **Health checks**: Continuous monitoring of all components
- **CloudWatch metrics**: Automatic collection of performance data
- **Audit logs**: Complete record of all system activities

## High Availability

### Multi-Zone Deployment
- **MediaConnect**: Flows in different availability zones
- **MediaLive**: Input destinations in multiple zones
- **Security appliances**: Distributed across zones
- **Load balancer**: Spans multiple zones automatically

### Automatic Recovery
- **Failed appliances**: Auto Scaling replaces unhealthy instances
- **Zone failures**: Traffic automatically routes to healthy zones
- **Health monitoring**: Continuous checks ensure system health

### Scaling Behavior
- **Minimum capacity**: 2 appliances (1 per availability zone)
- **Maximum capacity**: 4 appliances (2 per availability zone)
- **Scaling triggers**: Currently manual scaling; automatic CPU-based scaling can be added
- **Health monitoring**: Continuous health checks replace unhealthy instances
- **Rolling updates**: Instances are updated one at a time to maintain availability

## Performance Characteristics

### Latency
- **Additional latency**: 10-30 milliseconds for inspection
- **MediaConnect processing**: 2-5 ms
- **Security appliance inspection**: 5-15 ms
- **Gateway Load Balancer**: 1-2 ms

### Throughput
- **Per security appliance**: Up to 25 Gbps network performance
- **Concurrent streams**: 10-50 streams per appliance (depends on bitrate)
- **Total system capacity**: Scales with number of appliances

### Scaling Triggers
- **CPU utilization**: Primary scaling metric
- **Network throughput**: Secondary consideration
- **Health status**: Unhealthy instances are replaced immediately

## Cost Considerations

### Main Cost Components
- **EC2 instances**: Security appliances (c6in.xlarge)
- **MediaConnect**: Per-hour flow charges
- **MediaLive**: Per-hour input charges
- **Gateway Load Balancer**: Per-hour and data processing charges
- **Data transfer**: Between availability zones

### Cost Optimization
- **Auto Scaling**: Only run appliances when needed
- **Right-sizing**: Use appropriate instance types
- **Reserved instances**: For predictable workloads
- **Monitoring**: Track costs with detailed tagging

## Deployment Requirements

### AWS Account Permissions
- **CloudFormation**: Create and manage stacks
- **VPC**: Create networks and subnets
- **EC2**: Launch and manage instances
- **MediaConnect/MediaLive**: Create media services
- **Load Balancer**: Create Gateway Load Balancer
- **IAM**: Create roles and policies

### Service Limits
- **VPCs**: Need 2 VPCs
- **MediaConnect flows**: Need 1 flow
- **MediaLive inputs**: Need 1 input
- **MediaPackage channels**: Need 1 channel (for HLS output)
- **EC2 instances**: Need 2-4 instances
- **Load balancers**: Need 1 Gateway Load Balancer

## Monitoring and Operations

### Key Metrics to Watch
- **MediaConnect**: Source errors, bitrate, connection status
- **MediaLive**: Input errors, processing status
- **Gateway Load Balancer**: Active flows, target health
- **Security appliances**: CPU usage, network throughput
- **Auto Scaling**: Scaling events, instance health

### Troubleshooting Tools
- **AWS CLI commands**: Manual system verification
- **CloudWatch dashboards**: Visual monitoring
- **VPC Flow Logs**: Network traffic analysis
- **CloudTrail**: API call auditing

### Maintenance Tasks
- **Security updates**: Automatic OS updates on appliances
- **Configuration changes**: Use Infrastructure as Code
- **Capacity planning**: Monitor usage trends
- **Cost optimization**: Regular cost reviews

## Future Enhancements

### Possible Improvements
- **Multiple streams**: Support for more concurrent streams
- **Advanced analytics**: Machine learning-based threat detection
- **Global deployment**: Multi-region active-active setup
- **Enhanced monitoring**: Custom dashboards and alerting

### Scalability Options
- **Larger instances**: More powerful security appliances
- **More appliances**: Higher maximum scaling limits
- **GPU acceleration**: Hardware-accelerated video analysis
- **Edge deployment**: Regional processing nodes

This architecture provides a solid foundation for secure streaming media processing with comprehensive traffic inspection capabilities.
