import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ContributionConstruct, ContributionConstructProps, SrtSourceConfig, FlowOutputDestination } from '../lib/contribution-construct';

describe('ContributionConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let vpc: ec2.Vpc;
  let defaultProps: ContributionConstructProps;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'us-west-2'
      }
    });

    // Create VPC for testing
    vpc = new ec2.Vpc(stack, 'TestVpc', {
      maxAzs: 2,
      cidr: '10.0.0.0/16'
    });

    // Default props for testing
    defaultProps = {
      vpc: vpc,
      flowName: 'TestFlow',
      flowDescription: 'Test MediaConnect flow',
      srtSource: {
        name: 'TestSource',
        port: 5000
      },
      whitelistCidr: '203.0.113.0/24',
      availabilityZone: 'us-west-2a',
      destinations: [
        { name: 'Output1', ip: '10.0.1.100', port: 5004 },
        { name: 'Output2', ip: '10.0.2.100', port: 5006 }
      ],
      subnetId: 'subnet-12345678'
    };
  });

  describe('Constructor', () => {
    it('should create a MediaConnect flow with correct properties', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::Flow', {
        Name: 'TestFlow',
        AvailabilityZone: 'us-west-2a',
        Source: {
          Name: 'TestSource',
          Protocol: 'srt-listener',
          IngestPort: 5000,
          WhitelistCidr: '203.0.113.0/24'
        }
      });

      expect(construct.mediaConnectFlow).toBeDefined();
      expect(construct.mediaConnectFlowArn).toBeDefined();
    });

    it('should create IAM role with correct permissions', () => {
      // Act
      new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [{
            Effect: 'Allow',
            Principal: {
              Service: 'mediaconnect.amazonaws.com'
            },
            Action: 'sts:AssumeRole'
          }]
        }
      });

      // Check for VPC permissions
      template.hasResourceProperties('AWS::IAM::Role', {
        Policies: [{
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Sid: 'AllowVpcDescribeOperations',
                Effect: 'Allow',
                Action: [
                  'ec2:DescribeNetworkInterfaces',
                  'ec2:DescribeSecurityGroups',
                  'ec2:DescribeSubnets'
                ]
              }),
              Match.objectLike({
                Sid: 'AllowNetworkInterfaceManagement',
                Effect: 'Allow',
                Action: [
                  'ec2:CreateNetworkInterface',
                  'ec2:CreateNetworkInterfacePermission',
                  'ec2:DeleteNetworkInterface',
                  'ec2:DeleteNetworkInterfacePermission'
                ]
              })
            ])
          }
        }]
      });
    });

    it('should create VPC interface with correct configuration', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::FlowVpcInterface', {
        Name: 'VpcOutTestStack',
        SubnetId: 'subnet-12345678'
      });

      expect(construct.vpcInterface).toBeDefined();
    });

    it('should create security group with correct rules', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for MediaConnect VPC interface - allows all traffic within VPC',
        SecurityGroupEgress: Match.arrayWith([
          Match.objectLike({
            IpProtocol: 'udp',
            FromPort: 5000,
            ToPort: 5100,
            Description: 'Allow RTP traffic from VPC'
            // CidrIp will be a CDK token reference to VPC CIDR
          }),
          Match.objectLike({
            IpProtocol: 'udp',
            FromPort: 5001,
            ToPort: 5101,
            Description: 'Allow RTCP traffic from VPC'
          })
        ]),
        SecurityGroupIngress: Match.arrayWith([
          Match.objectLike({
            IpProtocol: 'udp',
            FromPort: 1024,
            ToPort: 65535,
            Description: 'Allow inbound UDP responses within VPC'
          })
        ])
      });

      expect(construct.securityGroup).toBeDefined();
    });

    it('should create flow outputs for each destination', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.resourceCountIs('AWS::MediaConnect::FlowOutput', 2);

      template.hasResourceProperties('AWS::MediaConnect::FlowOutput', {
        Name: 'Output1',
        Protocol: 'rtp-fec',
        Port: 5004,
        Destination: '10.0.1.100',
        VpcInterfaceAttachment: {
          VpcInterfaceName: 'VpcOutTestStack'
        }
      });

      template.hasResourceProperties('AWS::MediaConnect::FlowOutput', {
        Name: 'Output2',
        Protocol: 'rtp-fec',
        Port: 5006,
        Destination: '10.0.2.100',
        VpcInterfaceAttachment: {
          VpcInterfaceName: 'VpcOutTestStack'
        }
      });

      expect(construct.flowOutputs).toHaveLength(2);
      expect(construct.getOutputCount()).toBe(2);
    });

    it('should set SRT input properties correctly', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);

      // Assert
      expect(construct.srtInputIp).toBeDefined();
      expect(construct.srtInputPort).toBeDefined();
      // SRT URL will contain CDK tokens, so we check for the basic structure
      expect(construct.srtInputUrl).toContain('srt://');
      expect(construct.srtInputUrl).toContain(':');
      expect(construct.getSrtSourceUrl()).toBe(construct.srtInputUrl);
    });
  });

  describe('SRT Source Configuration', () => {
    it('should use default port when not specified', () => {
      // Arrange
      const propsWithoutPort: ContributionConstructProps = {
        ...defaultProps,
        srtSource: {
          name: 'TestSource'
          // port not specified
        }
      };

      // Act
      new ContributionConstruct(stack, 'TestContribution', propsWithoutPort);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::Flow', {
        Source: {
          IngestPort: 5000 // default port
        }
      });
    });

    it('should use custom port when specified', () => {
      // Arrange
      const propsWithCustomPort: ContributionConstructProps = {
        ...defaultProps,
        srtSource: {
          name: 'TestSource',
          port: 8080
        }
      };

      // Act
      new ContributionConstruct(stack, 'TestContribution', propsWithCustomPort);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::Flow', {
        Source: {
          IngestPort: 8080
        }
      });
    });
  });

  describe('VPC Interface Name Generation', () => {
    it('should generate correct VPC interface name for normal stack name', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::FlowVpcInterface', {
        Name: 'VpcOutTestStack'
      });
    });

    it('should truncate long stack names to 24 characters', () => {
      // Arrange
      const longStack = new cdk.Stack(app, 'VeryLongStackNameThatExceedsLimit', {
        env: { account: '123456789012', region: 'us-west-2' }
      });
      const longVpc = new ec2.Vpc(longStack, 'TestVpc', { maxAzs: 2 });
      const longProps: ContributionConstructProps = {
        ...defaultProps,
        vpc: longVpc
      };

      // Act
      new ContributionConstruct(longStack, 'TestContribution', longProps);
      const template = Template.fromStack(longStack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::FlowVpcInterface', {
        Name: 'VpcOutVeryLongStackNameT' // 24 characters max
      });
    });

    it('should handle short stack names correctly', () => {
      // Arrange
      const shortStack = new cdk.Stack(app, 'Short', {
        env: { account: '123456789012', region: 'us-west-2' }
      });
      const shortVpc = new ec2.Vpc(shortStack, 'TestVpc', { maxAzs: 2 });
      const shortProps: ContributionConstructProps = {
        ...defaultProps,
        vpc: shortVpc
      };

      // Act
      new ContributionConstruct(shortStack, 'TestContribution', shortProps);
      const template = Template.fromStack(shortStack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::FlowVpcInterface', {
        Name: 'VpcOutShort'
      });
    });
  });

  describe('Flow Output Methods', () => {
    let construct: ContributionConstruct;

    beforeEach(() => {
      construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);
    });

    it('should return correct flow output by index', () => {
      // Act & Assert
      const output1 = construct.getFlowOutput(0);
      const output2 = construct.getFlowOutput(1);

      expect(output1).toBeDefined();
      expect(output2).toBeDefined();
      expect(output1).not.toBe(output2);
    });

    it('should throw error for invalid flow output index', () => {
      // Act & Assert
      expect(() => construct.getFlowOutput(-1)).toThrow('Flow output index -1 is out of range');
      expect(() => construct.getFlowOutput(2)).toThrow('Flow output index 2 is out of range');
      expect(() => construct.getFlowOutput(10)).toThrow('Flow output index 10 is out of range');
    });

    it('should return primary output correctly', () => {
      // Act
      const primaryOutput = construct.getPrimaryOutput();
      const firstOutput = construct.getFlowOutput(0);

      // Assert
      expect(primaryOutput).toBe(firstOutput);
    });

    it('should return secondary output correctly', () => {
      // Act
      const secondaryOutput = construct.getSecondaryOutput();
      const secondOutput = construct.getFlowOutput(1);

      // Assert
      expect(secondaryOutput).toBe(secondOutput);
    });

    it('should return correct output count', () => {
      // Act & Assert
      expect(construct.getOutputCount()).toBe(2);
    });
  });

  describe('Single Destination Configuration', () => {
    it('should work with single destination', () => {
      // Arrange
      const singleDestinationProps: ContributionConstructProps = {
        ...defaultProps,
        destinations: [
          { name: 'SingleOutput', ip: '10.0.1.100', port: 5004 }
        ]
      };

      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', singleDestinationProps);
      const template = Template.fromStack(stack);

      // Assert
      template.resourceCountIs('AWS::MediaConnect::FlowOutput', 1);
      expect(construct.getOutputCount()).toBe(1);
      expect(construct.getPrimaryOutput()).toBeDefined();
      expect(() => construct.getSecondaryOutput()).toThrow('Flow output index 1 is out of range');
    });
  });

  describe('Multiple Destinations Configuration', () => {
    it('should work with multiple destinations', () => {
      // Arrange
      const multipleDestinationProps: ContributionConstructProps = {
        ...defaultProps,
        destinations: [
          { name: 'Output1', ip: '10.0.1.100', port: 5004 },
          { name: 'Output2', ip: '10.0.2.100', port: 5006 },
          { name: 'Output3', ip: '10.0.3.100', port: 5008 }
        ]
      };

      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', multipleDestinationProps);
      const template = Template.fromStack(stack);

      // Assert
      template.resourceCountIs('AWS::MediaConnect::FlowOutput', 3);
      expect(construct.getOutputCount()).toBe(3);
      expect(construct.getFlowOutput(0)).toBeDefined();
      expect(construct.getFlowOutput(1)).toBeDefined();
      expect(construct.getFlowOutput(2)).toBeDefined();
    });
  });

  describe('Resource Dependencies', () => {
    it('should create resources in correct dependency order', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);

      // Assert - VPC interface should depend on flow
      expect(construct.vpcInterface.node.dependencies).toContain(construct.mediaConnectFlow);

      // Assert - Flow outputs should depend on VPC interface
      construct.flowOutputs.forEach(output => {
        expect(output.node.dependencies).toContain(construct.vpcInterface);
      });
    });
  });

  describe('Security Group Configuration', () => {
    it('should create security group with VPC-scoped rules', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        VpcId: { Ref: Match.anyValue() },
        GroupDescription: 'Security group for MediaConnect VPC interface - allows all traffic within VPC'
      });

      expect(construct.securityGroup).toBeDefined();
      // Note: SecurityGroup.vpc is not directly accessible in CDK, but we can verify it's in the correct VPC via template
    });

    it('should have correct tags on security group', () => {
      // Act
      new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        Tags: Match.arrayWith([
          { Key: 'Component', Value: 'MediaConnect' },
          { Key: 'Purpose', Value: 'StreamContribution' }
        ])
      });
    });
  });

  describe('IAM Role Security', () => {
    it('should scope IAM permissions to specific region', () => {
      // Act
      new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::IAM::Role', {
        Policies: [{
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Condition: {
                  StringEquals: {
                    'ec2:Region': 'us-west-2'
                  }
                }
              })
            ])
          }
        }]
      });
    });

    it('should scope write permissions to specific resources', () => {
      // Act
      new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert - Check that the IAM role has the correct structure
      template.hasResourceProperties('AWS::IAM::Role', {
        Policies: [{
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Sid: 'AllowNetworkInterfaceManagement',
                Effect: 'Allow',
                Action: [
                  'ec2:CreateNetworkInterface',
                  'ec2:CreateNetworkInterfacePermission',
                  'ec2:DeleteNetworkInterface',
                  'ec2:DeleteNetworkInterfacePermission'
                ]
                // Resource array will contain VPC ARN with CDK tokens, so we just verify the structure
              })
            ])
          }
        }]
      });

      // Additional verification that specific resources are included
      const templateJson = template.toJSON();
      const role = Object.values(templateJson.Resources).find((resource: any) => 
        resource.Type === 'AWS::IAM::Role' && 
        resource.Properties.Policies?.[0]?.PolicyDocument?.Statement?.some((stmt: any) => 
          stmt.Sid === 'AllowNetworkInterfaceManagement'
        )
      ) as any;

      expect(role).toBeDefined();
      const statement = role.Properties.Policies[0].PolicyDocument.Statement.find((stmt: any) => 
        stmt.Sid === 'AllowNetworkInterfaceManagement'
      );
      
      expect(statement.Resource).toContain('arn:aws:ec2:us-west-2:123456789012:network-interface/*');
      expect(statement.Resource).toContain('arn:aws:ec2:us-west-2:123456789012:security-group/*');
      expect(statement.Resource).toContain('arn:aws:ec2:us-west-2:123456789012:subnet/subnet-12345678');
    });
  });

  describe('Flow Status Method', () => {
    it('should return flow ARN for status checking', () => {
      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const flowStatus = construct.getFlowStatus();

      // Assert
      expect(flowStatus).toBe(construct.mediaConnectFlowArn);
      expect(flowStatus).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty destinations array', () => {
      // Arrange
      const emptyDestinationsProps: ContributionConstructProps = {
        ...defaultProps,
        destinations: []
      };

      // Act
      const construct = new ContributionConstruct(stack, 'TestContribution', emptyDestinationsProps);
      const template = Template.fromStack(stack);

      // Assert
      template.resourceCountIs('AWS::MediaConnect::FlowOutput', 0);
      expect(construct.getOutputCount()).toBe(0);
      expect(() => construct.getPrimaryOutput()).toThrow('Flow output index 0 is out of range');
    });
  });

  describe('Integration with CDK Stack', () => {
    it('should use stack account and region in IAM policies', () => {
      // Act
      new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::IAM::Role', {
        Policies: [{
          PolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Resource: Match.arrayWith([
                  Match.stringLikeRegexp('arn:aws:ec2:us-west-2:123456789012:.*')
                ])
              })
            ])
          }
        }]
      });
    });

    it('should generate VPC interface name based on stack name', () => {
      // Act
      new ContributionConstruct(stack, 'TestContribution', defaultProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::FlowVpcInterface', {
        Name: 'VpcOutTestStack'
      });
    });
  });

  describe('Resource Naming and Descriptions', () => {
    it('should use provided flow name and description', () => {
      // Arrange
      const customProps: ContributionConstructProps = {
        ...defaultProps,
        flowName: 'CustomFlowName',
        flowDescription: 'Custom flow description'
      };

      // Act
      new ContributionConstruct(stack, 'TestContribution', customProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::Flow', {
        Name: 'CustomFlowName'
      });

      template.hasResourceProperties('AWS::MediaConnect::FlowOutput', {
        Description: Match.stringLikeRegexp('.*Custom flow description.*')
      });
    });

    it('should use provided SRT source name', () => {
      // Arrange
      const customSourceProps: ContributionConstructProps = {
        ...defaultProps,
        srtSource: {
          name: 'CustomSourceName',
          port: 5000
        }
      };

      // Act
      new ContributionConstruct(stack, 'TestContribution', customSourceProps);
      const template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::MediaConnect::Flow', {
        Source: {
          Name: 'CustomSourceName'
        }
      });
    });
  });
  describe('ContributionConstruct Types', () => {
    it('should have correct SrtSourceConfig interface', () => {
      // Arrange
      const validConfig: SrtSourceConfig = {
        name: 'TestSource',
        port: 5000
      };

      const minimalConfig: SrtSourceConfig = {
        name: 'TestSource'
        // port is optional
      };

      // Assert - TypeScript compilation validates these
      expect(validConfig.name).toBe('TestSource');
      expect(validConfig.port).toBe(5000);
      expect(minimalConfig.name).toBe('TestSource');
      expect(minimalConfig.port).toBeUndefined();
    });

    it('should have correct FlowOutputDestination interface', () => {
      // Arrange
      const destination: FlowOutputDestination = {
        ip: '10.0.1.100',
        port: 5004,
        name: 'TestOutput'
      };

      // Assert - TypeScript compilation validates this
      expect(destination.ip).toBe('10.0.1.100');
      expect(destination.port).toBe(5004);
      expect(destination.name).toBe('TestOutput');
    });

    it('should have correct ContributionConstructProps interface', () => {
      // This test ensures all required properties are present
      // TypeScript compilation will fail if any required properties are missing
      const testProps: ContributionConstructProps = {
        vpc: vpc,
        flowName: 'TestFlow',
        flowDescription: 'Test flow',
        srtSource: { name: 'TestSource', port: 5000 },
        whitelistCidr: '203.0.113.0/24',
        availabilityZone: 'us-west-2a',
        destinations: [{ name: 'Output1', ip: '10.0.1.100', port: 5004 }],
        subnetId: 'subnet-12345678'
      };
      
      expect(testProps.vpc).toBeDefined();
      expect(testProps.flowName).toBeDefined();
      expect(testProps.flowDescription).toBeDefined();
      expect(testProps.srtSource).toBeDefined();
      expect(testProps.whitelistCidr).toBeDefined();
      expect(testProps.availabilityZone).toBeDefined();
      expect(testProps.destinations).toBeDefined();
      expect(testProps.subnetId).toBeDefined();
    });
  });
});
