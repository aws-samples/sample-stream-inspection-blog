import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag';

/**
 * Properties for VPC Flow Logs Construct
 */
export interface VpcFlowLogsConstructProps {
  /**
   * VPCs to enable flow logs for
   */
  vpcs: ec2.IVpc[];

  /**
   * CloudWatch log retention period
   * @default logs.RetentionDays.ONE_WEEK
   */
  logRetention?: logs.RetentionDays;

  /**
   * Enable S3 destination for long-term storage
   * @default false
   */
  enableS3Storage?: boolean;
}

/**
 * Simple VPC Flow Logs Construct
 * 
 * Enables VPC Flow Logs with CloudWatch Logs destination and optional S3 storage.
 * Focuses on essential functionality without overengineering.
 */
export class VpcFlowLogsConstruct extends Construct {
  
  /**
   * CloudWatch log groups for VPC Flow Logs
   */
  public readonly logGroups: logs.LogGroup[];

  /**
   * S3 bucket for flow log storage (if enabled)
   */
  public readonly s3Bucket?: s3.Bucket;

  constructor(scope: Construct, id: string, props: VpcFlowLogsConstructProps) {
    super(scope, id);

    const logRetention = props.logRetention ?? logs.RetentionDays.ONE_WEEK;
    const enableS3 = props.enableS3Storage ?? false;

    // Create S3 bucket if enabled
    if (enableS3) {
      this.s3Bucket = new s3.Bucket(this, 'FlowLogsBucket', {
        bucketName: `vpc-flow-logs-${cdk.Stack.of(this).account}-${cdk.Stack.of(this).region}`,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        autoDeleteObjects: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        lifecycleRules: [{
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(90)
        }]
      });

      // Add NagSuppression for server access logs
      NagSuppressions.addResourceSuppressions(this.s3Bucket, [
        {
          id: 'AwsSolutions-S1',
          reason: 'VPC Flow Logs bucket does not require server access logs as it stores infrastructure logs. The bucket is used for VPC Flow Logs storage.'
        }
      ]);
    }

    // Create flow logs for each VPC
    this.logGroups = [];
    
    props.vpcs.forEach((vpc, index) => {
      const vpcName = `vpc-${index}`;
      
      // Create CloudWatch log group
      const logGroup = new logs.LogGroup(this, `FlowLogsGroup-${vpcName}`, {
        logGroupName: `/aws/vpc/flowlogs/${vpcName}`,
        retention: logRetention,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });
      this.logGroups.push(logGroup);

      // Create VPC Flow Log to CloudWatch
      new ec2.FlowLog(this, `FlowLog-${vpcName}`, {
        resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
        destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup),
        trafficType: ec2.FlowLogTrafficType.ALL
      });

      // Create VPC Flow Log to S3 if enabled
      if (this.s3Bucket) {
        new ec2.FlowLog(this, `S3FlowLog-${vpcName}`, {
          resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
          destination: ec2.FlowLogDestination.toS3(this.s3Bucket, `${vpcName}/`),
          trafficType: ec2.FlowLogTrafficType.ALL
        });
      }
    });

    // Add basic tags
    cdk.Tags.of(this).add('Purpose', 'NetworkMonitoring');
  }
}
