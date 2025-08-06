# Stream Intelligence Architecture

A secure streaming media system that inspects 100% of video traffic without interrupting streams using AWS Gateway Load Balancer and dual-VPC architecture.

## System Design

The architecture uses two isolated VPCs connected through Gateway Load Balancer endpoints. The Stream Processing VPC (10.0.0.0/16) handles MediaConnect SRT ingestion and MediaLive processing across two availability zones. The Security Inspection VPC (10.1.0.0/16) contains auto-scaling security appliances that analyze all streaming traffic in real-time.

Traffic flows from SRT encoders to MediaConnect, through Gateway Load Balancer to security appliances for inspection, then to MediaLive for processing and distribution. This design ensures complete traffic visibility while maintaining stream quality and availability.

## Core Components

**MediaConnect Flow** receives SRT streams on port 5000 with IP whitelisting for access control. It outputs RTP streams to MediaLive across multiple availability zones for redundancy.

**MediaLive Input** processes RTP streams from MediaConnect and prepares them for distribution via MediaPackage. The service spans multiple zones to handle zone failures automatically.

**Gateway Load Balancer** routes all streaming traffic through security appliances using GENEVE encapsulation. It distributes load evenly and removes unhealthy targets automatically.

**Security Appliances** run on c7gn.large instances with Amazon Linux 2, scaling from 2-4 instances based on demand. They analyze traffic and forward clean streams to MediaLive while blocking threats.

## Traffic Flow

```
SRT Stream → MediaConnect → Gateway Load Balancer → Security Appliances → MediaLive → Distribution
```

SRT encoders send streams to MediaConnect after IP validation. All MediaConnect-to-MediaLive traffic is automatically routed through Gateway Load Balancer, which wraps traffic in GENEVE protocol and sends it to security appliances. Appliances analyze the traffic and forward clean streams to MediaLive for processing and HLS distribution.

## Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Stream Processing VPC                        │
│                     (10.0.0.0/16)                          │
│                                                             │
│  ┌─────────────────┐              ┌─────────────────┐      │
│  │   Zone A        │              │   Zone B        │      │
│  │                 │              │                 │      │
│  │ MediaConnect    │──────────────│ MediaLive       │      │
│  │ Flow            │              │ Input           │      │
│  │ (SRT:5000)      │              │ (RTP)           │      │
│  └─────────────────┘              └─────────────────┘      │
│           │                                │                │
│           ▼                                ▼                │
│  ┌─────────────────┐              ┌─────────────────┐      │
│  │ GWLB Endpoint   │              │ GWLB Endpoint   │      │
│  └─────────────────┘              └─────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Gateway Load    │
                    │   Balancer        │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Security Inspection VPC                      │
│                     (10.1.0.0/16)                          │
│                                                             │
│  ┌─────────────────┐              ┌─────────────────┐      │
│  │   Zone A        │              │   Zone B        │      │
│  │                 │              │                 │      │
│  │ Security        │              │ Security        │      │
│  │ Appliances      │              │ Appliances      │      │
│  │ (1-2 instances) │              │ (1-2 instances) │      │
│  └─────────────────┘              └─────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Security Model

Network isolation separates streaming and security functions into distinct VPCs with private subnets and restrictive security groups. IP whitelisting controls stream access while IAM roles enforce least privilege permissions.

Traffic inspection analyzes 100% of streaming data with no bypass mechanisms. Real-time analysis maintains stream quality while providing complete visibility into all network traffic.

## Performance Characteristics

The system adds 10-30ms latency for inspection while supporting up to 25 Gbps throughput per appliance. Each appliance handles 10-50 concurrent streams depending on bitrate. Auto scaling maintains 2-4 appliances across availability zones with automatic health monitoring and replacement.

## Cost Structure

Primary costs include c7gn.large EC2 instances for security appliances, MediaConnect flow charges, MediaLive input charges, Gateway Load Balancer processing fees, and cross-AZ data transfer. Auto scaling and right-sizing optimize costs by running only necessary resources.

## Monitoring

CloudWatch provides metrics for MediaConnect errors, MediaLive processing status, Gateway Load Balancer health, and security appliance performance. VPC Flow Logs capture network traffic patterns while the Stream Manager automates resource lifecycle management.

## Deployment Requirements

Requires AWS permissions for VPC, EC2, MediaConnect, MediaLive, Gateway Load Balancer, and Auto Scaling services. Service limits include 2 VPCs, 1 MediaConnect flow, 1 MediaLive input, 1 Gateway Load Balancer, and 2-4 EC2 instances.

## Future Enhancements

The architecture supports ML-based threat detection, multi-stream processing, global deployment across regions, and custom security rules. Scalability options include larger instances, GPU acceleration, and edge processing nodes for enhanced performance and capabilities.
