import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as medialive from 'aws-cdk-lib/aws-medialive';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Properties for the Distribution Construct.
 */
export interface DistributionConstructProps {
  /**
   * The VPC where the MediaLive input will be deployed.
   */
  vpc: ec2.Vpc;
  
  /**
   * Name for the MediaLive input.
   */
  inputName: string;
  
  /**
   * Subnet IDs for MediaLive input deployment.
   * Must include subnets from 2 different AZs.
   */
  subnetIds: string[];


}

/**
 * Distribution Construct
 * 
 * Creates a MediaLive RTP input that receives streams from MediaConnect flows.
 * 
 * @example
 * ```typescript
 * const distribution = new DistributionConstruct(this, 'Distribution', {
 *   vpc: vpc,
 *   inputName: 'LiveStreamInput',
 *   subnetIds: ['subnet-123', 'subnet-456'],
 *   securityGroup: securityGroup
 * });
 * ```
 */
export class DistributionConstruct extends Construct {
  /**
   * The MediaLive input instance.
   */
  public readonly mediaLiveInput: medialive.CfnInput;
  
  /**
   * The MediaLive input ID.
   */
  public readonly inputId: string;
  
  /**
   * Array of MediaLive input destination URLs.
   * Format: rtp://ip-address:port
   */
  public readonly destinations: string[];

  /**
   * Security group for the MediaLive input.
   */
  public readonly securityGroup: ec2.SecurityGroup;

  /**
   * IAM role for MediaLive service.
   */
  public readonly mediaLiveRole: iam.Role;

  /**
   * Subnet IDs used for MediaLive input deployment.
   */
  public readonly subnetIds: string[];

  /**
   * Store props for use in private methods
   */
  private readonly props: DistributionConstructProps;

  /**
   * Creates a new Distribution Construct.
   */
  constructor(scope: Construct, id: string, props: DistributionConstructProps) {
    super(scope, id);

    // Store props and subnet IDs for later use
    this.props = props;
    this.subnetIds = props.subnetIds;

    // =========================================================================
    // SECURITY GROUP CONFIGURATION
    // =========================================================================

    this.securityGroup = new ec2.SecurityGroup(this, 'MediaLiveSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for MediaLive VPC input - allows traffic from VPC only',
      allowAllOutbound: false
    });

    // Allow inbound RTP traffic for MediaLive VPC inputs
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.udpRange(5000, 5100),
      'Allow RTP traffic from VPC'
    );

    // Allow inbound RTCP traffic for MediaLive VPC inputs
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.udpRange(5001, 5101),
      'Allow RTCP traffic from VPC'
    );

    // Allow outbound traffic only within VPC for responses
    this.securityGroup.addEgressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.udpRange(1024, 65535),
      'Allow outbound UDP responses within VPC'
    );

    // =========================================================================
    // IAM ROLE CONFIGURATION
    // =========================================================================

    /**
     * IAM Role for MediaLive Service
     * 
     * Provides MediaLive with required permissions for VPC operations,
     * CloudWatch logging, and MediaPackage integration.
     */
    this.mediaLiveRole = new iam.Role(this, 'MediaLiveRole', {
      assumedBy: new iam.ServicePrincipal('medialive.amazonaws.com'),
      description: `IAM role for MediaLive VPC input ${props.inputName}`,
      inlinePolicies: {
        'MediaLiveVpcPolicy': new iam.PolicyDocument({
          statements: [
            // SECURITY FIX: Split read-only and write operations with scoped permissions
            // Read-only VPC operations (can use wildcard with conditions)
            new iam.PolicyStatement({
              sid: 'AllowVpcDescribeOperations',
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:DescribeNetworkInterfaces',
                'ec2:DescribeSecurityGroups',
                'ec2:DescribeSubnets',
                'ec2:DescribeVpcs'
              ],
              resources: ['*'], // Justified: Read-only operations for discovery
              conditions: {
                StringEquals: {
                  'ec2:Region': cdk.Stack.of(this).region
                }
              }
            }),
            // Write operations (scoped to specific VPC and subnets)
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
                ...props.subnetIds.map(subnetId => 
                  `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:subnet/${subnetId}`
                )
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
    // MEDIALIVE INPUT CONFIGURATION
    // =========================================================================

    /**
     * MediaLive RTP Input
     * 
     * Creates an RTP_PUSH input that receives streams from MediaConnect flows.
     */
    this.mediaLiveInput = new medialive.CfnInput(this, 'MediaLiveInput', {
      name: props.inputName,
      type: 'RTP_PUSH',
      roleArn: this.mediaLiveRole.roleArn,
      vpc: {
        securityGroupIds: [this.securityGroup.securityGroupId],
        subnetIds: props.subnetIds
      },
      tags: {
        'Component': 'MediaLive',
        'Purpose': 'StreamDistribution'
      }
    });

    // Store input ID and destinations
    this.inputId = this.mediaLiveInput.ref;
    this.destinations = this.mediaLiveInput.attrDestinations;

    // =========================================================================
    // CLOUDWATCH MONITORING
    // =========================================================================

    /**
     * CloudWatch Integration
     * 
     * MediaLive input automatically integrates with CloudWatch for monitoring.
     */

    // Apply resource tags
    cdk.Tags.of(this).add('Component', 'MediaLive');
    cdk.Tags.of(this).add('Purpose', 'StreamDistribution');
  }

  /**
   * Gets the primary destination URL.
   */
  public getPrimaryDestination(): string {
    return cdk.Fn.select(0, this.destinations);
  }

  /**
   * Gets the secondary destination URL.
   */
  public getSecondaryDestination(): string {
    return cdk.Fn.select(1, this.destinations);
  }

  /**
   * Gets all destination URLs as a comma-separated string.
   */
  public getAllDestinations(): string {
    return cdk.Fn.join(',', this.destinations);
  }



  /**
   * Gets destination information for MediaConnect flow outputs.
   */
  public getDestinationInfo(): Array<{name: string, ip: string, port: number}> {
    const stackName = cdk.Stack.of(this).stackName;
    return [
      {
        name: `${stackName.substring(0, 14)}-Out1`,
        ip: cdk.Fn.select(0, cdk.Fn.split(':', cdk.Fn.select(1, cdk.Fn.split('//', this.getPrimaryDestination())))),
        port: cdk.Token.asNumber(cdk.Fn.select(1, cdk.Fn.split(':', cdk.Fn.select(1, cdk.Fn.split('//', this.getPrimaryDestination()))))),
      },
      {
        name: `${stackName.substring(0, 14)}-Out2`,
        ip: cdk.Fn.select(0, cdk.Fn.split(':', cdk.Fn.select(1, cdk.Fn.split('//', this.getSecondaryDestination())))),
        port: cdk.Token.asNumber(cdk.Fn.select(1, cdk.Fn.split(':', cdk.Fn.select(1, cdk.Fn.split('//', this.getSecondaryDestination()))))),
      }
    ];
  }
}
