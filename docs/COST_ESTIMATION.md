# Cost Estimation - Stream Intelligence with Gateway Load Balancer

**Region**: US West 2 (Oregon)  
**Pricing Date**: December 2024  
**Currency**: USD

## Executive Summary

| Component | Monthly Cost | Annual Cost |
|-----------|-------------|-------------|
| **Core Infrastructure** | $1,418.33 | $17,019.96 |
| **Streaming Services** | $2,160.00 | $25,920.00 |
| **Data Transfer** | $450.00 | $5,400.00 |
| **Storage & Logs** | $25.00 | $300.00 |
| **Total Estimated Cost** | **$4,082.13** | **$48,985.56** |

## Detailed Cost Breakdown

### 1. Core Infrastructure ($1,447.13/month)

#### EC2 Instances - Security Appliances
- **Instance Type**: c6in.xlarge (4 vCPU, 8 GB RAM, 25 Gbps network)
- **Quantity**: 2 instances (minimum capacity across 2 AZs)
- **Usage**: 24/7 operation
- **Unit Price**: $0.2592/hour
- **Monthly Cost**: $0.2592 × 24 × 30 × 2 = **$373.25**

#### EC2 Instance - Bastion Host
- **Instance Type**: t3.micro (2 vCPU, 1 GB RAM)
- **Quantity**: 1 instance
- **Usage**: 10 hours/month (on-demand for troubleshooting)
- **Unit Price**: $0.0104/hour
- **Monthly Cost**: $0.0104 × 10 = **$0.10**

#### Gateway Load Balancer
- **Load Balancer Hours**: 24/7 operation
- **Unit Price**: $0.0225/hour
- **Monthly Cost**: $0.0225 × 24 × 30 = **$16.20**

#### Gateway Load Balancer - Data Processing
- **Estimated Traffic**: 50 GB/hour × 24 × 30 = 36 TB/month
- **Unit Price**: $0.006/GB processed
- **Monthly Cost**: 36,000 × $0.006 = **$216.00**

#### NAT Gateway
- **Quantity**: 1 NAT Gateway
- **Usage**: 24/7 operation
- **Unit Price**: $0.045/hour
- **Monthly Cost**: $0.045 × 24 × 30 = **$32.40**

#### NAT Gateway - Data Processing
- **Estimated Traffic**: 10 GB/month
- **Unit Price**: $0.045/GB processed
- **Monthly Cost**: 10 × $0.045 = **$0.45**

#### EBS Storage
- **Security Appliances**: 2 × 20 GB GP3 volumes
- **Bastion Host**: 1 × 8 GB GP3 volume
- **Total Storage**: 48 GB
- **Unit Price**: $0.08/GB/month
- **Monthly Cost**: 48 × $0.08 = **$3.84**

#### VPC Endpoints
- **Interface Endpoints**: 0 endpoints (removed to reduce costs)
- **Unit Price**: $0.01/hour per endpoint
- **Monthly Cost**: 0 × $0.01 × 24 × 30 = **$0.00**

#### VPC Flow Logs
- **Log Volume**: ~10 GB/month
- **CloudWatch Logs Ingestion**: $0.50/GB
- **CloudWatch Logs Storage**: $0.03/GB/month
- **Monthly Cost**: (10 × $0.50) + (10 × $0.03) = **$5.30**

#### Lambda Functions
- **Media Lifecycle Handler**: ~1,000 invocations/month
- **Custom Resource Functions**: ~100 invocations/month
- **Compute Cost**: Minimal (~$0.20/month)
- **Request Cost**: Minimal (~$0.02/month)
- **Monthly Cost**: **$0.22**

#### CloudWatch
- **Custom Metrics**: ~50 metrics
- **Unit Price**: $0.30/metric/month
- **Alarms**: ~10 alarms at $0.10/alarm/month
- **Monthly Cost**: (50 × $0.30) + (10 × $0.10) = **$16.00**

#### Key Management Service (KMS)
- **Customer Managed Keys**: 2 keys
- **Unit Price**: $1.00/key/month
- **API Requests**: ~10,000/month at $0.03/10,000
- **Monthly Cost**: (2 × $1.00) + $0.03 = **$2.03**

#### Systems Manager
- **Parameter Store**: Standard parameters (free tier)
- **Session Manager**: No additional cost
- **Monthly Cost**: **$0.00**

### 2. Streaming Services ($2,160.00/month)

#### MediaConnect
- **Flow Hours**: 1 flow × 24/7 operation
- **Unit Price**: $0.10/hour per flow
- **Monthly Cost**: $0.10 × 24 × 30 = **$72.00**

#### MediaConnect - Data Transfer
- **Ingress**: Free
- **Egress to MediaLive**: ~500 GB/month at $0.02/GB
- **Monthly Cost**: 500 × $0.02 = **$10.00**

#### MediaLive
- **Input Type**: RTP_PUSH (VPC input)
- **Channel Type**: Single pipeline, HD (1080p)
- **Encoding Profile**: Standard (H.264, AAC)
- **Unit Price**: $2.75/hour for HD single pipeline
- **Monthly Cost**: $2.75 × 24 × 30 = **$1,980.00**

#### MediaPackage v2
- **Channel**: 1 channel
- **Unit Price**: $0.04/hour per channel
- **Monthly Cost**: $0.04 × 24 × 30 = **$28.80**

#### MediaPackage v2 - Packaging
- **Content Processing**: ~1 TB/month
- **Unit Price**: $0.06/GB
- **Monthly Cost**: 1,000 × $0.06 = **$60.00**

#### MediaPackage v2 - Egress
- **Content Delivery**: ~100 GB/month
- **Unit Price**: $0.09/GB
- **Monthly Cost**: 100 × $0.09 = **$9.00**

### 3. Data Transfer ($450.00/month)

#### Internet Data Transfer
- **Outbound to Internet**: ~5 TB/month (streaming content)
- **Unit Price**: $0.09/GB (first 10 TB)
- **Monthly Cost**: 5,000 × $0.09 = **$450.00**

#### VPC Data Transfer
- **Cross-AZ Transfer**: ~100 GB/month
- **Unit Price**: $0.01/GB
- **Monthly Cost**: 100 × $0.01 = **$1.00**

*Note: Cross-AZ transfer included in Internet transfer estimate above*

### 4. Storage & Logs ($25.00/month)

#### S3 Storage
- **VPC Flow Logs**: ~50 GB/month
- **Application Logs**: ~10 GB/month
- **Unit Price**: $0.023/GB/month (Standard)
- **Monthly Cost**: 60 × $0.023 = **$1.38**

#### S3 Requests
- **PUT Requests**: ~10,000/month at $0.0005/1,000
- **GET Requests**: ~1,000/month at $0.0004/1,000
- **Monthly Cost**: (10 × $0.0005) + (1 × $0.0004) = **$0.01**

#### CloudWatch Logs Storage
- **Log Retention**: 1 week retention
- **Storage Volume**: ~100 GB/month
- **Unit Price**: $0.03/GB/month
- **Monthly Cost**: 100 × $0.03 = **$3.00**

#### CloudWatch Logs Insights
- **Query Volume**: ~10 GB scanned/month
- **Unit Price**: $0.005/GB scanned
- **Monthly Cost**: 10 × $0.005 = **$0.05**

## Cost Optimization Recommendations

### Immediate Savings (10-15% reduction)

1. **Reserved Instances**
   - Purchase 1-year Reserved Instances for c6in.xlarge
   - Potential savings: ~$100/month

2. **Spot Instances**
   - Use Spot Instances for non-critical security appliances
   - Potential savings: ~$150/month (60% discount)

3. **Right-sizing**
   - Monitor actual usage and downsize if possible
   - Consider c6in.large instead of c6in.xlarge
   - Potential savings: ~$180/month

### Long-term Optimizations (20-30% reduction)

1. **Savings Plans**
   - Commit to 1-3 year compute usage
   - Potential savings: ~$200-400/month

2. **Storage Optimization**
   - Use S3 Intelligent Tiering for logs
   - Implement log lifecycle policies
   - Potential savings: ~$10-20/month

3. **MediaLive Optimization**
   - Use reserved pricing for predictable workloads
   - Optimize encoding settings for bandwidth
   - Potential savings: ~$300-500/month

## Scaling Considerations

### Linear Scaling Components
- **MediaConnect Flows**: +$82/month per additional flow
- **Security Appliances**: +$373/month per additional pair
- **MediaLive Channels**: +$2,008/month per additional HD channel

### Fixed Cost Components
- **Gateway Load Balancer**: Same cost regardless of scale
- **VPC Infrastructure**: Minimal increase with scale
- **Management Services**: Slight increase with scale

## Cost Monitoring Recommendations

1. **Set up AWS Budgets** with alerts at 80% and 100% of estimated costs
2. **Enable Cost Explorer** for detailed cost analysis
3. **Implement resource tagging** for cost allocation
4. **Monitor data transfer costs** closely as they can vary significantly
5. **Review costs monthly** and adjust resources based on actual usage

## Disclaimer

- Prices are based on AWS public pricing as of December 2024
- Actual costs may vary based on usage patterns, data transfer volumes, and AWS pricing changes
- This estimate assumes 24/7 operation of all services
- Additional costs may apply for support plans, professional services, or third-party tools
- Use the [AWS Pricing Calculator](https://calculator.aws) for the most current pricing estimates

---

*For questions about this cost estimation, please refer to the AWS Pricing Calculator or contact AWS Support for detailed pricing guidance.*