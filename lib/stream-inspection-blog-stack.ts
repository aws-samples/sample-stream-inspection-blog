import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { GatewayLoadBalancerConstruct } from './gwlb-construct';
import { ContributionConstruct } from './contribution-construct';
import { DistributionConstruct } from './distribution-construct';
import { OttStreamingConstruct } from './ott-streaming-construct';
import { VpcFlowLogsConstruct } from './vpc-flow-logs-construct';
import * as logs from 'aws-cdk-lib/aws-logs';

/**
 * Stream Inspection Blog Stack
 * 
 * Creates a streaming media architecture with Gateway Load Balancer
 * for traffic inspection using dual VPCs for security isolation.
 * 
 * @example
 * ```typescript
 * const app = new cdk.App();
 * new StreamInspectionBlogStack(app, 'StreamInspectionBlogStack', {
 *   env: { account: '123456789012', region: 'us-east-1' }
 * });
 * ```
 */
export class StreamInspectionBlogStack extends cdk.Stack {
  /**
   * The Stream Inspection VPC containing media services.
   */
  public readonly ingressVpc: ec2.Vpc;

  /**
   * The Gateway Load Balancer construct for traffic inspection.
   */
  public readonly gwlbConstruct: GatewayLoadBalancerConstruct;

  /**
   * VPC Flow Logs construct for network monitoring and security analysis.
   */
  public readonly vpcFlowLogsConstruct: VpcFlowLogsConstruct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================================================================
    // STACK PARAMETERS
    // =========================================================================

    // Use first two availability zones by default
    const availabilityZones = cdk.Stack.of(this).availabilityZones.slice(0, 2);

    const whitelistCidrParam = new cdk.CfnParameter(this, 'WhitelistCidr', {
      type: 'String',
      description: 'CIDR block to whitelist for SRT source access (e.g., 203.0.113.0/24)',
      default: '10.0.0.0/8', 
      allowedPattern: '^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$',
      constraintDescription: 'Must be a valid CIDR block (e.g., 10.0.0.0/8, 192.168.1.0/24, 203.0.113.42/32)'
    });

    // =========================================================================
    // VPC INFRASTRUCTURE
    // =========================================================================

    // Stream Inspection VPC for media services
    this.ingressVpc = new ec2.Vpc(this, 'IngestVPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      availabilityZones: availabilityZones,
      subnetConfiguration: [
        {
          name: 'contribution',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24
        },
        {
          name: 'inspection',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24
        },
        {
          name: 'distribution',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24
        }
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
      // Restrict to IPv4 for media service compatibility
      ipProtocol: ec2.IpProtocol.IPV4_ONLY
    });



    // =========================================================================
    // TRAFFIC INSPECTION INFRASTRUCTURE
    // =========================================================================

    // Gateway Load Balancer for traffic inspection
    this.gwlbConstruct = new GatewayLoadBalancerConstruct(this, 'GWLBConstruct', {
      availabilityZones: availabilityZones,
      targetVpc: this.ingressVpc,
      targetSubnetIds: this.ingressVpc.isolatedSubnets.filter(subnet => subnet.node.id.includes('inspection')).map(subnet => subnet.subnetId),
      whitelistCidr: whitelistCidrParam.valueAsString
    });

    // =========================================================================
    // VPC FLOW LOGS FOR NETWORK MONITORING
    // =========================================================================

    // Enable VPC Flow Logs for network monitoring and security analysis
    this.vpcFlowLogsConstruct = new VpcFlowLogsConstruct(this, 'VpcFlowLogs', {
      vpcs: [this.ingressVpc],
      logRetention: logs.RetentionDays.ONE_WEEK,
      enableS3Storage: true
    });

    // =========================================================================
    // VPC ENDPOINT CONFIGURATION FOR TRAFFIC INSPECTION
    // =========================================================================

    // Gateway Load Balancer VPC Endpoints for traffic routing
    const vpcEndpoints: ec2.CfnVPCEndpoint[] = [];
    const inspectionSubnets = this.ingressVpc.isolatedSubnets.filter(subnet => subnet.node.id.includes('inspection'));
    
    inspectionSubnets.forEach((subnet, index) => {
      const endpoint = new ec2.CfnVPCEndpoint(this, `GWLBEndpoint${index}`, {
        vpcId: this.ingressVpc.vpcId,
        serviceName: `com.amazonaws.vpce.${this.region}.${this.gwlbConstruct.endpointServiceId}`,
        vpcEndpointType: 'GatewayLoadBalancer',
        subnetIds: [subnet.subnetId],
        
        // Add tags for better resource management
        policyDocument: undefined, // Use default policy for GWLB endpoints
      });
      
      // Add descriptive tags
      cdk.Tags.of(endpoint).add('Name', `GWLB-Endpoint-AZ${String.fromCharCode(65 + index)}`);
      cdk.Tags.of(endpoint).add('Purpose', 'TrafficInspection');
      cdk.Tags.of(endpoint).add('Component', 'GatewayLoadBalancer');
      
      vpcEndpoints.push(endpoint);
    });

    // =========================================================================
    // STREAMING MEDIA INFRASTRUCTURE
    // =========================================================================

    // =========================================================================
    // MEDIALIVE DISTRIBUTION CONSTRUCT
    // =========================================================================

    // MediaLive input for receiving streams from MediaConnect
    const distributionConstruct = new DistributionConstruct(this, 'DistributionConstruct', {
      vpc: this.ingressVpc,
      inputName: 'StreamInspectionInput',
      subnetIds: this.ingressVpc.isolatedSubnets.filter(subnet => subnet.node.id.includes('distribution')).map(subnet => subnet.subnetId)
    });

    // =========================================================================
    // TRAFFIC INSPECTION ROUTING CONFIGURATION
    // =========================================================================

    // Configure routing for traffic inspection
    this.configureTrafficInspection(vpcEndpoints);


    // MediaConnect flow for SRT stream ingestion
    const contributionConstruct = new ContributionConstruct(this, 'ContributionConstruct', {
      flowName: `${this.stackName.substring(0, 15)}-Flow`,
      flowDescription: 'MediaConnect Flow for Stream Inspection',
      vpc: this.ingressVpc,
      srtSource: {
        name: `${this.stackName.substring(0, 15)}-SRT`,
      },
      whitelistCidr: whitelistCidrParam.valueAsString,
      availabilityZone: availabilityZones[0],
      // Create destinations for both MediaLive input endpoints (both AZs)
      destinations: distributionConstruct.getDestinationInfo(),
      subnetId: this.ingressVpc.isolatedSubnets.filter(subnet => subnet.node.id.includes('contribution'))[0].subnetId
    });
    
    // Ensure ContributionConstruct is created after DistributionConstruct
    contributionConstruct.node.addDependency(distributionConstruct);
    
    // Add tags for better resource management and monitoring
    cdk.Tags.of(contributionConstruct).add('AvailabilityZone', availabilityZones[0]);
    cdk.Tags.of(contributionConstruct).add('FlowType', 'Primary');
    cdk.Tags.of(contributionConstruct).add('Purpose', 'StreamIngestion');

    // =========================================================================
    // OTT STREAMING PIPELINE
    // =========================================================================

    // OTT streaming pipeline with MediaLive and MediaPackage
    // Includes timecode burn-in overlays on all video outputs
    const ottStreamingConstruct = new OttStreamingConstruct(this, 'OttStreamingConstruct', {
      mediaLiveInputId: distributionConstruct.inputId,
      channelName: cdk.Stack.of(this).stackName,
    });

    // Ensure OttStreamingConstruct is created after DistributionConstruct
    ottStreamingConstruct.node.addDependency(distributionConstruct);

    // =========================================================================
    // STACK OUTPUTS
    // =========================================================================

    new cdk.CfnOutput(this, 'SrtInputUrl', {
      value: contributionConstruct.srtInputUrl,
      description: 'SRT input URL for streaming to MediaConnect'
    });





    new cdk.CfnOutput(this, 'PlaybackUrl', {
      value: ottStreamingConstruct.playbackUrl,
      description: 'HLS playback URL for the stream'
    });

  }

  /**
   * Configure routing rules to inspect traffic between contribution and distribution subnets.
   */
  private configureTrafficInspection(vpcEndpoints: ec2.CfnVPCEndpoint[]): void {
    const contributionSubnets = this.ingressVpc.isolatedSubnets.filter(subnet => subnet.node.id.includes('contribution'));
    const distributionSubnets = this.ingressVpc.isolatedSubnets.filter(subnet => subnet.node.id.includes('distribution'));
    const inspectionEndpoints = vpcEndpoints;

    // Route traffic from contribution to distribution subnets through GWLB
    contributionSubnets.forEach((subnet, index) => {
      const route = new ec2.CfnRoute(this, `ContributionToDistributionRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: distributionSubnets[index].ipv4CidrBlock,
        vpcEndpointId: inspectionEndpoints[index].ref
      });

      // Add tags for route identification and troubleshooting
      cdk.Tags.of(route).add('Name', `Contribution-to-Distribution-AZ${String.fromCharCode(65 + index)}`);
      cdk.Tags.of(route).add('Purpose', 'TrafficInspection');
      cdk.Tags.of(route).add('Direction', 'Outbound');
    });

    // Route return traffic from distribution to contribution subnets through GWLB
    distributionSubnets.forEach((subnet, index) => {
      const route = new ec2.CfnRoute(this, `DistributionToContributionRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: contributionSubnets[index].ipv4CidrBlock,
        vpcEndpointId: inspectionEndpoints[index].ref
      });

      // Add tags for route identification and troubleshooting
      cdk.Tags.of(route).add('Name', `Distribution-to-Contribution-AZ${String.fromCharCode(65 + index)}`);
      cdk.Tags.of(route).add('Purpose', 'TrafficInspection');
      cdk.Tags.of(route).add('Direction', 'Return');
    });

    /**
     * Additional Routing Considerations:
     * 
     * 1. Route Precedence: More specific routes take precedence over general routes
     * 2. Health Monitoring: GWLB endpoints automatically handle unhealthy appliances
     * 3. Load Distribution: Traffic is distributed across healthy appliances
     * 4. Failover: If all appliances in an AZ fail, traffic may be rerouted
     * 5. Monitoring: CloudWatch metrics track route table changes and traffic flow
     */
  }



}
