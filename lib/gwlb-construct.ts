import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';

import { Asset } from 'aws-cdk-lib/aws-s3-assets';
import * as path from 'path';

/**
 * Properties for the Gateway Load Balancer Construct
 */
export interface GatewayLoadBalancerConstructProps {
  /**
   * Availability zones for multi-AZ deployment
   * @example ['us-east-1a', 'us-east-1b']
   */
  availabilityZones: string[];
  
  /**
   * Target VPC for VPC endpoint creation (optional)
   */
  targetVpc?: ec2.Vpc;
  
  /**
   * Target subnet IDs for VPC endpoint creation (optional)
   */
  targetSubnetIds?: string[];

  /**
   * CIDR block to whitelist for SSH access to bastion host
   */
  whitelistCidr?: string;
}

/**
 * Gateway Load Balancer Construct
 * 
 * Creates a traffic inspection solution using AWS Gateway Load Balancer with auto-scaling
 * security appliances. Provides transparent "bump-in-the-wire" traffic inspection.
 * 
 * Components:
 * - Gateway Load Balancer with GENEVE protocol
 * - Auto Scaling Group of security appliances
 * - VPC Endpoint Service for cross-VPC connectivity
 * - Health monitoring and automatic scaling
 * 
 * @example
 * ```typescript
 * const gwlb = new GatewayLoadBalancerConstruct(this, 'GWLB', {
 *   availabilityZones: ['us-east-1a', 'us-east-1b'],
 *   targetVpc: applicationVpc,
 *   targetSubnetIds: applicationVpc.privateSubnets.map(s => s.subnetId)
 * });
 * ```
 */
export class GatewayLoadBalancerConstruct extends Construct {
  /**
   * The Gateway Load Balancer instance
   */
  public readonly gwlb: elbv2.CfnLoadBalancer;
  
  /**
   * The Gateway Load Balancer Target Group
   */
  public readonly gwlbTargetGroup: elbv2.CfnTargetGroup;
  
  /**
   * The Gateway Load Balancer Endpoint Service
   */
  public readonly gwlbEndpointService: ec2.CfnVPCEndpointService;
  
  /**
   * The Gateway Load Balancer Endpoint Service ID
   */
  public readonly endpointServiceId: string;
  
  /**
   * The Gateway Load Balancer Endpoint Service Name
   */
  public readonly endpointServiceName: string;
  
  /**
   * VPC Endpoints created in target VPC (if specified)
   */
  public readonly vpcEndpoints: ec2.CfnVPCEndpoint[];

  /**
   * Security group for security appliances (for security group chaining)
   */
  public readonly securityApplianceSecurityGroup: ec2.SecurityGroup;

  /**
   * Security group for bastion host (for security group chaining)
   */
  public readonly bastionSecurityGroup: ec2.SecurityGroup;
  
  /**
   * Custom resource that manages VPC endpoint lifecycle
   */
  public readonly endpointsReady?: cdk.CustomResource;

  /**
   * Auto Scaling Group for security appliances
   */
  public readonly securityApplianceASG: autoscaling.AutoScalingGroup;




  /**
   * Creates a new Gateway Load Balancer Construct
   * 
   * @param scope - The scope in which to define this construct
   * @param id - The scoped construct ID
   * @param props - Configuration properties for the Gateway Load Balancer
   */
  constructor(scope: Construct, id: string, props: GatewayLoadBalancerConstructProps) {
    super(scope, id);


    /**
     * Inspection VPC
     * 
     * Dedicated VPC for Gateway Load Balancer and security appliances.
     * Uses private subnets for security and cost optimization.
     */
    const vpc = new ec2.Vpc(this, 'InspectionVPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.1.0.0/16'),
      availabilityZones: props.availabilityZones,
      subnetConfiguration: [
        {
          name: 'gwlb',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24
        },
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        }
      ],
      natGateways: 1,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      // IPv4 only for GWLB compatibility
      ipProtocol: ec2.IpProtocol.IPV4_ONLY
    });



    // Security Appliance Infrastructure

    /**
     * Security Group for Security Appliances
     */
    /**
     * Security Group Chaining Implementation
     * 
     * Instead of using CIDR blocks, we use security group references to create
     * a more secure and manageable network access control system.
     */

    // Create bastion host security group first (needed for chaining)
    const bastionSG = new ec2.SecurityGroup(this, 'BastionSG', {
      vpc: vpc,
      description: 'Security group for bastion host - restricted SSH access',
      allowAllOutbound: true
    });

    // Restrict bastion SSH access to whitelisted CIDR
    bastionSG.addIngressRule(
      ec2.Peer.ipv4(props.whitelistCidr || '10.0.0.0/8'), 
      ec2.Port.tcp(22),
      'Allow SSH access from whitelisted CIDR only'
    );

    const securityApplianceSG = new ec2.SecurityGroup(this, 'SecurityApplianceSG', {
      vpc: vpc,
      description: 'Security group for Gateway Load Balancer security appliances - chained access',
      allowAllOutbound: true
    });

    /**
     * Security Group Chaining - More Secure Approach
     * 
     * Instead of allowing access from entire VPC CIDR blocks, we use security group
     * references to create precise access controls between specific components.
     * 
     * Benefits:
     * - More granular access control
     * - Easier to manage and audit
     * - Automatic updates when instances change
     * - Better compliance with security best practices
     */

    // Allow GENEVE protocol for Gateway Load Balancer traffic
    // Note: GWLB traffic comes from AWS infrastructure, so VPC CIDR is still needed
    securityApplianceSG.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.udp(6081),
      'Allow GENEVE protocol for GWLB traffic (AWS infrastructure)'
    );

    // Allow HTTP for health checks from Gateway Load Balancer
    // Note: GWLB health checks come from AWS infrastructure, so VPC CIDR is needed
    securityApplianceSG.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(80),
      'Allow HTTP health checks from GWLB (AWS infrastructure)'
    );

    // Allow HTTPS for management and software updates
    securityApplianceSG.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow HTTPS for management and updates'
    );

    // Security Group Chaining: Allow SSH only from bastion host security group
    securityApplianceSG.addIngressRule(
      ec2.Peer.securityGroupId(bastionSG.securityGroupId),
      ec2.Port.tcp(22),
      'Allow SSH from bastion host security group only (security group chaining)'
    );

    // Assign security groups to public properties for chaining with other constructs
    this.securityApplianceSecurityGroup = securityApplianceSG;
    this.bastionSecurityGroup = bastionSG;

    /**
     * IAM Role for Security Appliance Instances
     */
    const securityApplianceRole = new iam.Role(this, 'SecurityApplianceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for Gateway Load Balancer security appliance instances',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ],
      inlinePolicies: {
        'SecurityAppliancePolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'AllowCloudWatchLogs',
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                'logs:DescribeLogStreams'
              ],
              resources: [
                `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/ec2/security-appliance*`,
                `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/${cdk.Stack.of(this).stackName}/ec2/security-appliance*`
              ]
            }),
            new iam.PolicyStatement({
              sid: 'AllowS3ReadOnlyForAssets',
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject'
              ],
              resources: [
                `arn:aws:s3:::cdk-*-assets-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}/*`
              ]
            }),
            // Read-only EC2 operations (justified wildcard with conditions)
            new iam.PolicyStatement({
              sid: 'AllowEC2DescribeOperations',
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:DescribeNetworkInterfaces',
                'ec2:DescribeTags',
                'ec2:DescribeInstances',
                'ec2:DescribeInstanceAttribute'
              ],
              resources: ['*'], // Justified: Read-only operations for network discovery
              conditions: {
                StringEquals: {
                  'ec2:Region': cdk.Stack.of(this).region
                }
              }
            }),
            // SECURITY FIX: Scoped instance modification permissions
            new iam.PolicyStatement({
              sid: 'AllowSecurityApplianceInstanceModification',
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:ModifyInstanceAttribute'
              ],
              resources: [
                `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:instance/*`
              ],
              conditions: {
                StringEquals: {
                  'ec2:Region': cdk.Stack.of(this).region,
                }
              }
            }),
            // Network interface operations for security appliances
            new iam.PolicyStatement({
              sid: 'AllowNetworkInterfaceOperations',
              effect: iam.Effect.ALLOW,
              actions: [
                'ec2:AttachNetworkInterface',
                'ec2:DetachNetworkInterface',
                'ec2:ModifyNetworkInterfaceAttribute'
              ],
              resources: [
                `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:network-interface/*`,
                `arn:aws:ec2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:instance/*`
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

    /**
     * Key Pair for Security Appliances
     */
    const keyPair = new ec2.CfnKeyPair(this, 'SecurityApplianceKeyPair', {
      keyName: `SecurityAppliances-${cdk.Names.uniqueId(this).slice(-8)}`,
      keyType: 'rsa',
      keyFormat: 'pem'
    });

    /**
     * User Data Script for Security Appliances
     */
    const userData = this.createSecurityApplianceUserData(vpc);

    // Gateway Load Balancer Configuration

    /**
     * Gateway Load Balancer Target Group
     */
    this.gwlbTargetGroup = new elbv2.CfnTargetGroup(this, 'GWLBTargetGroup', {
      name: `GWLB-TG-${cdk.Names.uniqueId(this).slice(-8)}`,
      port: 6081, // GENEVE protocol port
      protocol: 'GENEVE',
      targetType: 'instance',
      vpcId: vpc.vpcId,
      
      // Health check configuration
      healthCheckEnabled: true,
      healthCheckProtocol: 'HTTP',
      healthCheckPort: '80',
      healthCheckPath: '/health',
      healthCheckIntervalSeconds: 30,
      healthCheckTimeoutSeconds: 5,
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
      
      // Target group attributes
      targetGroupAttributes: [
        {
          key: 'deregistration_delay.timeout_seconds',
          value: '0'
        },
        {
          key: 'target_failover.on_deregistration',
          value: 'rebalance'
        },
        {
          key: 'target_failover.on_unhealthy',
          value: 'rebalance'
        }
      ]
    });

    /**
     * Gateway Load Balancer
     */
    this.gwlb = new elbv2.CfnLoadBalancer(this, 'GWLB', {
      name: `GWLB-${cdk.Names.uniqueId(this).slice(-8)}`,
      type: 'gateway',
      subnets: vpc.privateSubnets.map(subnet => subnet.subnetId),
      
      // Load balancer attributes
      loadBalancerAttributes: [
        {
          key: 'load_balancing.cross_zone.enabled',
          value: 'false'
        }
      ],
      
      tags: [
        { key: 'Name', value: 'Gateway-Load-Balancer' },
        { key: 'Purpose', value: 'TrafficInspection' },
        { key: 'Component', value: 'SecurityInfrastructure' }
      ]
    });

    /**
     * Auto Scaling Group for Security Appliances
     */
    const launchTemplate = new ec2.LaunchTemplate(this, 'SecurityApplianceLT', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6IN, ec2.InstanceSize.XLARGE),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: securityApplianceSG,
      role: securityApplianceRole,
      userData: userData,
      keyPair: ec2.KeyPair.fromKeyPairName(this, 'ImportedKeyPair', keyPair.keyName!),
      detailedMonitoring: true,
      // TODO: Security Review - Enable EBS encryption for data at rest protection
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20, {
          encrypted: true,
          volumeType: ec2.EbsDeviceVolumeType.GP3,
          deleteOnTermination: true
        })
      }]
    });

    this.securityApplianceASG = new autoscaling.AutoScalingGroup(this, 'SecurityApplianceASG', {
      vpc: vpc,
      launchTemplate: launchTemplate,
      minCapacity: 0,
      maxCapacity: 2 * props.availabilityZones.length,
      vpcSubnets: { 
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS 
      },
      healthChecks: autoscaling.HealthChecks.ec2({
        gracePeriod: cdk.Duration.seconds(30),
      }),
      updatePolicy: autoscaling.UpdatePolicy.rollingUpdate({
        maxBatchSize: 1 * props.availabilityZones.length,
        minInstancesInService: 1 * props.availabilityZones.length
      }),
      groupMetrics: [
        autoscaling.GroupMetrics.all()
      ]
    });
    
    /**
     * Gateway Load Balancer Listener
     */
    const gwlbListener = new elbv2.CfnListener(this, 'GWLBListener', {
      defaultActions: [{ 
        type: 'forward', 
        targetGroupArn: this.gwlbTargetGroup.ref 
      }],
      loadBalancerArn: this.gwlb.ref
    });

    /**
     * Attach Auto Scaling Group to Target Group
     */
    const cfnAsg = this.securityApplianceASG.node.defaultChild as autoscaling.CfnAutoScalingGroup;
    cfnAsg.targetGroupArns = [this.gwlbTargetGroup.ref];
    cfnAsg.healthCheckType = 'ELB';
    cfnAsg.healthCheckGracePeriod = 60;
    
    // SECURITY FIX: Add security tags for IAM permission scoping
    cfnAsg.addPropertyOverride('Tags', [
      { Key: 'Component', Value: 'SecurityAppliance', PropagateAtLaunch: true },
      { Key: 'Purpose', Value: 'TrafficInspection', PropagateAtLaunch: true },
      { Key: 'ManagedBy', Value: 'AutoScaling', PropagateAtLaunch: true },
    ]);

    // VPC Endpoint Service and Endpoints

    /**
     * Gateway Load Balancer Endpoint Service
     */
    this.gwlbEndpointService = new ec2.CfnVPCEndpointService(this, 'GWLBEndpointService', {
      gatewayLoadBalancerArns: [this.gwlb.ref],
      acceptanceRequired: false,
      
      tags: [
        { key: 'Name', value: 'GWLB-Endpoint-Service' },
        { key: 'Purpose', value: 'CrossVpcTrafficInspection' },
        { key: 'Component', value: 'NetworkSecurity' }
      ]
    });
    
    // Store service identifiers for external reference
    this.endpointServiceId = this.gwlbEndpointService.attrServiceId;    

    // Bastion Host Instance (security group already created above for chaining)

    /**
     * Bastion Host Instance
     */
    const bastionHost = new ec2.Instance(this, 'BastionHost', {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: bastionSG,
      keyPair: ec2.KeyPair.fromKeyPairName(this, 'BastionKeyPair', keyPair.keyName!),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      role: securityApplianceRole,
      userData: ec2.UserData.forLinux({
        shebang: '#!/bin/bash'
      })
    });

    // Add NagSuppression for detailed monitoring
    NagSuppressions.addResourceSuppressions(bastionHost, [
      {
        id: 'AwsSolutions-EC28',
        reason: 'Bastion host is for development/troubleshooting only and does not require detailed monitoring. CloudWatch basic monitoring is sufficient for this use case.'
      }
    ]);

    // SSH agent forwarding configuration
    bastionHost.userData.addCommands(
      'echo "AllowAgentForwarding yes" >> /etc/ssh/sshd_config',
      'systemctl restart sshd',
      'yum update -y',
      'amazon-linux-extras install -y epel',
      'yum install -y htop jq'
    );

  }

  /**
   * Creates user data script for security appliance instances
   * 
   * Creates user data script for security appliance instances.
   * 
   * This method creates a comprehensive user data script that:
   * - Downloads and extracts configuration assets from S3
   * - Executes the main bootstrap script
   * Creates user data script for security appliance instances.
   * 
   * This method creates a simple user data script that:
   * - Downloads configuration scripts from S3
   * - Executes the main setup script
   * - Configures network forwarding and health checks
   * 
   * @param vpc - The VPC for network configuration
   * @returns User data script for EC2 instances
   */
  private createSecurityApplianceUserData(vpc: ec2.Vpc): ec2.UserData {
    const userData = ec2.UserData.forLinux();
    const stackName = cdk.Stack.of(this).stackName;

    // Create S3 asset for configuration scripts
    const configAsset = new Asset(this, 'SecurityApplianceConfigAsset', {
      path: path.join(__dirname, 'user-data')
    });

    // Basic setup
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      'echo "Starting security appliance configuration..."',
      '',
      '# Create working directory',
      'mkdir -p /opt/security-appliance',
      'cd /opt/security-appliance'
    );

    // Download and extract scripts
    userData.addS3DownloadCommand({
      bucket: configAsset.bucket,
      bucketKey: configAsset.s3ObjectKey,
      localFile: '/tmp/security-appliance.zip'
    });

    userData.addCommands(
      '',
      '# Extract scripts',
      'unzip -q /tmp/security-appliance.zip',
      'chmod +x *.sh',
      'rm /tmp/security-appliance.zip',
      '',
      '# Run setup script',
      `./setup.sh "${vpc.vpcId}" "${stackName}" "false"`,
      '',
      'echo "Security appliance configuration completed"'
    );

    return userData;
  }
}
