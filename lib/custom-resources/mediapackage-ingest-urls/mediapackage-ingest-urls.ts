import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';

/**
 * Properties for MediaPackageIngestUrls construct
 */
export interface MediaPackageIngestUrlsProps {
  /**
   * The name of the MediaPackage channel group
   */
  channelGroupName: string;
  
  /**
   * The name of the MediaPackage channel
   */
  channelName: string;
}

/**
 * Custom resource to retrieve MediaPackage channel ingest URLs
 * 
 * This construct creates a custom resource that queries MediaPackage V2
 * to retrieve the ingest endpoints for a channel, which can then be used
 * to configure MediaLive outputs.
 * 
 * @example
 * ```typescript
 * const ingestUrls = new MediaPackageIngestUrls(this, 'IngestUrls', {
 *   channelGroupName: 'my-channel-group',
 *   channelName: 'my-channel'
 * });
 * 
 * // Use the ingest URLs in MediaLive output configuration
 * const endpoint1 = ingestUrls.ingestEndpoint1;
 * const endpoint2 = ingestUrls.ingestEndpoint2;
 * ```
 */
export class MediaPackageIngestUrls extends Construct {
  /**
   * The primary ingest endpoint URL
   */
  public readonly ingestEndpoint1: string;
  
  /**
   * The secondary ingest endpoint URL
   */
  public readonly ingestEndpoint2: string;

  constructor(scope: Construct, id: string, props: MediaPackageIngestUrlsProps) {
    super(scope, id);



    // Create Lambda function for MediaPackage ingest URL retrieval
    const customResourceLambda = new lambda.Function(this, 'MediaPackageIngestUrlsFunction', {
      runtime: lambda.Runtime.NODEJS_20_X, // TODO: Security Review - Updated from nodejs18.x to nodejs20.x for latest security patches and performance improvements
      handler: 'mediapackage-ingest-urls-handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      description: 'Retrieves MediaPackage channel ingest URLs for MediaLive output configuration',
      environment: {
        NODE_OPTIONS: '--enable-source-maps'
      },
      initialPolicy: [
        new iam.PolicyStatement({
          sid: 'MediaPackageChannelAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'mediapackagev2:GetChannel'
          ],
          resources: [
            // SECURITY FIX: Scoped to specific MediaPackage channel only
            `arn:aws:mediapackagev2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:channelGroup/${props.channelGroupName}/channel/${props.channelName}`
          ],
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': cdk.Stack.of(this).region
            }
          }
        })
      ]
    });

    // Create log group for the provider
    // Use auto-generated name to avoid conflicts
    const providerLogGroup = new logs.LogGroup(this, 'ProviderLogGroup', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Create custom resource provider
    const provider = new cr.Provider(this, 'MediaPackageIngestUrlsProvider', {
      onEventHandler: customResourceLambda,
      logGroup: providerLogGroup
    });

    // Create the custom resource
    const customResource = new cdk.CustomResource(this, 'MediaPackageIngestUrlsResource', {
      serviceToken: provider.serviceToken,
      properties: {
        ChannelGroupName: props.channelGroupName,
        ChannelName: props.channelName,
        // Add a timestamp to force updates when needed
        Timestamp: new Date().toISOString()
      }
    });

    // Extract the ingest URLs from the custom resource response
    this.ingestEndpoint1 = customResource.getAttString('IngestEndpoint1');
    this.ingestEndpoint2 = customResource.getAttString('IngestEndpoint2');
    
    // Add dependencies to ensure proper resource ordering
    customResource.node.addDependency(customResourceLambda);
    customResource.node.addDependency(provider);
  }


}
