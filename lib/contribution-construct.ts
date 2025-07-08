import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as mediaconnect from 'aws-cdk-lib/aws-mediaconnect';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Configuration for SRT source in MediaConnect flow
 */
export interface SrtSourceConfig {
  /**
   * Name of the SRT source
   */
  name: string;
  /**
   * Port number for SRT listener (default: 5000)
   */
  port?: number;
}

/**
 * Configuration for flow output destination
 */
export interface FlowOutputDestination {
  /**
   * Destination IP address
   */
  ip: string;
  
  /**
   * Destination port
   */
  port: number;
  
  /**
   * Name for the output
   */
  name: string;
}

/**
 * Properties for the Contribution Construct.
 */
export interface ContributionConstructProps {
  /**
   * The VPC where the MediaConnect flow will deliver output.
   */
  vpc: ec2.Vpc;
  
  /**
   * Name of the MediaConnect flow.
   */
  flowName: string;
  
  /**
   * Description of the MediaConnect flow.
   */
  flowDescription: string;
  
  /**
   * SRT source configuration.
   */
  srtSource: SrtSourceConfig;
  
  /**
   * CIDR block to whitelist for SRT source access.
   */
  whitelistCidr: string;
  
  /**
   * Availability Zone for the MediaConnect flow.
   */
  availabilityZone: string;
  
  /**
   * Flow output destinations (typically 2 for different AZs).
   */
  destinations: FlowOutputDestination[];
  
  /**
   * Subnet ID for the VPC interface.
   */
  subnetId: string;


}

/**
 * Contribution Construct
 * 
 * Creates a MediaConnect flow that accepts SRT streams and outputs them 
 * via RTP to multiple destinations for high availability.
 * 
 * @example
 * ```typescript
 * const contribution = new ContributionConstruct(this, 'StreamContribution', {
 *   vpc: streamingVpc,
 *   flowName: 'LiveStreamFlow',
 *   flowDescription: 'Primary live stream contribution flow',
 *   srtSource: {
 *     name: 'LiveSource',
 *     description: 'Live stream from studio',
 *     port: 5000
 *   },
 *   whitelistCidr: '203.0.113.0/24',
 *   availabilityZone: 'us-east-1a',
 *   destinations: [
 *     { name: 'VpcOutput1', ip: '10.0.1.100', port: 5004 },
 *     { name: 'VpcOutput2', ip: '10.0.1.200', port: 5006 }
 *   ],
 *   subnetId: 'subnet-12345678'
 * });
 * 
 * // Access SRT input details
 * new cdk.CfnOutput(this, 'SrtUrl', {
 *   value: contribution.srtInputUrl
 * });
 * ```
 */
export class ContributionConstruct extends Construct {
  /**
   * The ARN of the MediaConnect flow.
   */
  public readonly mediaConnectFlowArn: string;
  
  /**
   * The MediaConnect flow instance.
   */
  public readonly mediaConnectFlow: mediaconnect.CfnFlow;

  /**
   * The VPC interface for the MediaConnect flow.
   */
  public readonly vpcInterface: mediaconnect.CfnFlowVpcInterface;

  /**
   * The flow output configurations.
   */
  public readonly flowOutputs: mediaconnect.CfnFlowOutput[];

  /**
   * Security group for the MediaConnect VPC interface.
   */
  public readonly securityGroup: ec2.SecurityGroup;

  /**
   * The SRT input URL for the MediaConnect flow.
   */
  public readonly srtInputUrl: string;

  /**
   * The SRT input IP address.
   */
  public readonly srtInputIp: string;

  /**
   * The SRT input port.
   */
  public readonly srtInputPort: string;

  /**
   * Creates a new Contribution Construct.
   */
  constructor(scope: Construct, id: string, props: ContributionConstructProps) {
    super(scope, id);

    // Initialize flow outputs array
    this.flowOutputs = [];

    // Generate VPC interface name with stack name (limited to 24 characters)
    const stackName = cdk.Stack.of(this).stackName;
    const vpcInterfaceName = this.generateVpcInterfaceName(stackName);

    // =========================================================================
    // IAM ROLE FOR MEDIACONNECT VPC INTERFACE
    // =========================================================================

    /**
     * IAM Role for MediaConnect VPC Interface
     * 
     * This role allows MediaConnect to create and manage network interfaces
     * in the specified VPC. The permissions are scoped to the minimum required
     * for VPC interface operations.
     */
    const mediaConnectRole = new iam.Role(this, 'MediaConnectVpcRole', {
      assumedBy: new iam.ServicePrincipal('mediaconnect.amazonaws.com'),
      description: `IAM role for MediaConnect flow ${props.flowName} VPC interface`,
      inlinePolicies: {
        'MediaConnectVpcPolicy': new iam.PolicyDocument({
          statements: [
            // SECURITY FIX: Split read-only and write operations with scoped permissions
            // Read-only VPC operations (can use wildcard with conditions)
            new iam.PolicyStatement({
              sid: 'AllowVpcDescribeOperations',
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:DescribeNetworkInterfaces',
                'ec2:DescribeSecurityGroups',
                'ec2:DescribeSubnets'
              ],
              resources: ['*'], // Justified: Read-only operations for discovery
              conditions: {
                StringEquals: {
                  'ec2:Region': cdk.Stack.of(this).region
                }
              }
            }),
            // Write operations (scoped to specific VPC and subnet)
            new iam.PolicyStatement({
              sid: 'AllowNetworkInterfaceManagement',
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:CreateNetworkInterface',
                'ec2:CreateNetworkInterfacePermission',
                'ec2:DeleteNetworkInterface',
                'ec2:DeleteNetworkInterfacePermission'
              ],
              resources: [
                `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:network-interface/*`,
                `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:vpc/${props.vpc.vpcId}`,
                `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:security-group/*`,
                `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:subnet/${props.subnetId}`
              ],
              conditions: {
                StringEquals: {
                  'ec2:Region': cdk.Stack.of(this).region
                }
              }
            })
          ]
        })
      }
    });

    // =========================================================================
    // SECURITY GROUP CONFIGURATION
    // =========================================================================

    /**
     * Security Group for MediaConnect VPC Interface
     * 
     * Configured with rules for:
     * - All inbound traffic from within the VPC
     * - All outbound traffic to within the VPC
     * - Maximum connectivity for MediaConnect operations
     */
    this.securityGroup = this.createSecurityGroup(props.vpc);

    // =========================================================================
    // MEDIACONNECT FLOW CONFIGURATION
    // =========================================================================

    /**
     * MediaConnect Flow
     * 
     * Creates a flow with SRT listener source that:
     * - Accepts SRT streams on the specified port
     * - Applies IP whitelisting for security
     * - Provides automatic failover and recovery
     * - Integrates with CloudWatch for monitoring
     */
    this.mediaConnectFlow = new mediaconnect.CfnFlow(this, 'MediaConnectFlow', {
      name: props.flowName,
      availabilityZone: props.availabilityZone,
      source: {
        name: props.srtSource.name,
        protocol: 'srt-listener',
        ingestPort: props.srtSource.port || 5000,
        whitelistCidr: props.whitelistCidr,
      }
    });

    /**
     * VPC Interface for MediaConnect Flow
     * 
     * Creates a VPC interface that allows the flow to deliver streams
     * securely within the VPC without traversing the public internet.
     */
    this.vpcInterface = new mediaconnect.CfnFlowVpcInterface(this, 'VpcInterface', {
      flowArn: this.mediaConnectFlow.attrFlowArn,
      name: vpcInterfaceName,
      roleArn: mediaConnectRole.roleArn,
      securityGroupIds: [this.securityGroup.securityGroupId],
      subnetId: props.subnetId
    });

    // Ensure VPC interface is created after the flow
    this.vpcInterface.node.addDependency(this.mediaConnectFlow);
    
    /**
     * Flow Output Configuration
     * 
     * Creates multiple flow outputs to deliver RTP streams to different destinations/AZs.
     * Each output uses the VPC interface for secure delivery.
     */
    props.destinations.forEach((destination, index) => {
      const flowOutput = new mediaconnect.CfnFlowOutput(this, `FlowOutput${index + 1}`, {
        flowArn: this.mediaConnectFlow.attrFlowArn,
        name: destination.name,
        description: `RTP-FEC output ${index + 1} for ${props.flowDescription}`,
        protocol: 'rtp-fec',
        port: destination.port,
        destination: destination.ip,
        vpcInterfaceAttachment: {
          vpcInterfaceName: vpcInterfaceName
        },
      });

      // Ensure output is created after VPC interface
      flowOutput.node.addDependency(this.vpcInterface);
      
      // Add to outputs array
      this.flowOutputs.push(flowOutput);
    });

    // Store the flow ARN for external access
    this.mediaConnectFlowArn = this.mediaConnectFlow.attrFlowArn;

    // Store SRT input details for external access
    this.srtInputIp = this.mediaConnectFlow.attrSourceIngestIp;
    this.srtInputPort = this.mediaConnectFlow.attrSourceSourceIngestPort;
    this.srtInputUrl = `srt://${this.srtInputIp}:${this.srtInputPort}`;

 
  }

  /**
   * Gets a specific flow output by index.
   */
  public getFlowOutput(index: number): mediaconnect.CfnFlowOutput {
    if (index < 0 || index >= this.flowOutputs.length) {
      throw new Error(`Flow output index ${index} is out of range. Available outputs: ${this.flowOutputs.length}`);
    }
    return this.flowOutputs[index];
  }

  /**
   * Gets the primary flow output (first output).
   */
  public getPrimaryOutput(): mediaconnect.CfnFlowOutput {
    return this.getFlowOutput(0);
  }

  /**
   * Gets the secondary flow output (second output).
   */
  public getSecondaryOutput(): mediaconnect.CfnFlowOutput {
    return this.getFlowOutput(1);
  }

  /**
   * Gets the number of flow outputs.
   */
  public getOutputCount(): number {
    return this.flowOutputs.length;
  }

  /**
   * Generates a VPC interface name with stack name, limited to 24 characters.
   * 
   * @example
   * - Stack: "StreamInspectionBlogStack" → "VpcOutStreamInspectionBl" (24 chars)
   * - Stack: "MyStack" → "VpcOutMyStack" (13 chars)
   * - Stack: "VeryLongStackNameThatExceeds" → "VpcOutVeryLongStackNameT" (24 chars)
   */
  private generateVpcInterfaceName(stackName: string): string {
    const baseName = 'VpcOut';
    const maxLength = 24;
    
    // Calculate available space for stack name
    const availableSpace = maxLength - baseName.length;
    
    if (availableSpace <= 0) {
      return baseName.substring(0, maxLength);
    }
    
    // Truncate stack name if needed and append to base name
    const truncatedStackName = stackName.length > availableSpace 
      ? stackName.substring(0, availableSpace)
      : stackName;
    
    return `${baseName}${truncatedStackName}`;
  }

  /**
   * Creates a security group for MediaConnect VPC interface
   * 
   * The security group is configured with:
   * - Ingress rules for all traffic from within the VPC
   * - Egress rules for all outbound traffic (allowAllOutbound=true)
   * - Maximum connectivity while maintaining VPC isolation
   * 
   * @param vpc - The VPC where the security group will be created
   * @returns Configured security group
   */
  private createSecurityGroup(vpc: ec2.Vpc): ec2.SecurityGroup {
    const sg = new ec2.SecurityGroup(this, 'MediaConnectSG', {
      vpc: vpc,
      description: 'Security group for MediaConnect VPC interface - allows all traffic within VPC',
      allowAllOutbound: false
    });

    /**
     * Allow all inbound traffic within the VPC
     * 
     * This provides maximum connectivity for MediaConnect operations
     * while restricting access to VPC-internal traffic only.
     */
    
    // Allow outbound RTP traffic to MediaLive VPC inputs
    sg.addEgressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.udpRange(5000, 5100),
      'Allow RTP traffic from VPC'
    );

    // Allow outbound RTCP traffic to MediaLive VPC inputs
    sg.addEgressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.udpRange(5001, 5101),
      'Allow RTCP traffic from VPC'
    );

    // Allow outbound traffic only within VPC for responses
    sg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.udpRange(1024, 65535),
      'Allow inbound UDP responses within VPC'
    );

    // sg.addIngressRule(
    //   ec2.Peer.ipv4(vpc.vpcCidrBlock),
    //   ec2.Port.allTraffic(),
    //   'Allow all inbound traffic within VPC'
    // );

    // sg.addEgressRule(
    //   ec2.Peer.ipv4(vpc.vpcCidrBlock),
    //   ec2.Port.allTraffic(),
    //   'Allow all outbound traffic within VPC'
    // );

    // Add tags for better resource management
    cdk.Tags.of(sg).add('Component', 'MediaConnect');
    cdk.Tags.of(sg).add('Purpose', 'StreamContribution');

    return sg;
  }

  /**
   * Gets the SRT source URL for this MediaConnect flow
   * 
   * @returns The SRT URL that external sources should use to send streams
   */
  public getSrtSourceUrl(): string {
    return this.srtInputUrl;
  }

  /**
   * Gets the flow status (requires AWS SDK call at runtime)
   * 
   * Note: For runtime status checking, use the AWS MediaConnect SDK.
   * This method provides the flow ARN which can be used with the SDK.
   * 
   * @returns The MediaConnect flow ARN for status checking
   */
  public getFlowStatus(): string {
    return this.mediaConnectFlowArn;
  }
}
