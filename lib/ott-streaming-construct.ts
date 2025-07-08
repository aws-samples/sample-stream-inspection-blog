import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as medialive from 'aws-cdk-lib/aws-medialive';
import * as mediapackagev2 from 'aws-cdk-lib/aws-mediapackagev2';
import * as iam from 'aws-cdk-lib/aws-iam';

import { MediaPackageIngestUrls } from './custom-resources/mediapackage-ingest-urls';

export interface OttStreamingConstructProps {
  /**
   * MediaLive input ID to use as source.
   */
  mediaLiveInputId: string;
  
  /**
   * Channel name for MediaLive.
   */
  channelName: string;
}

/**
 * OTT Streaming Construct
 * 
 * Creates an OTT streaming pipeline with MediaLive channel
 * and MediaPackage packaging for HLS delivery.
 * 
 * @example
 * ```typescript
 * const ottStreaming = new OttStreamingConstruct(this, 'OttStreaming', {
 *   mediaLiveInputId: 'input-123',
 *   channelName: 'LiveChannel'
 * });
 * 
 * // Access the HLS playback URL
 * new cdk.CfnOutput(this, 'StreamUrl', {
 *   value: ottStreaming.playbackUrl
 * });
 * ```
 */
export class OttStreamingConstruct extends Construct {
  /**
   * The MediaLive channel instance.
   */
  public readonly mediaLiveChannel: medialive.CfnChannel;
  
  /**
   * The MediaPackage channel instance.
   */
  public readonly mediaPackageChannel: mediapackagev2.CfnChannel;
  
  /**
   * The HLS playback URL from MediaPackage origin endpoint.
   */
  public readonly playbackUrl: string;

  constructor(scope: Construct, id: string, props: OttStreamingConstructProps) {
    super(scope, id);

    // MediaPackage v2 Channel Group
    const channelGroup = new mediapackagev2.CfnChannelGroup(this, 'ChannelGroup', {
      channelGroupName: `${props.channelName}-group`,
      description: 'MediaPackage v2 channel group for OTT streaming'
    });

    // MediaPackage v2 Channel
    this.mediaPackageChannel = new mediapackagev2.CfnChannel(this, 'MediaPackageChannel', {
      channelGroupName: channelGroup.channelGroupName,
      channelName: props.channelName,
      description: 'MediaPackage v2 channel for OTT streaming'
    });
    this.mediaPackageChannel.node.addDependency(channelGroup); 


    // MediaPackage v2 Origin Endpoint (HLS)

    const hlsOriginEndpointName = "ts";
    const multiVariantManifestName = "index";
    const variantManifestName = "variant";
    const segmentName = "segment";

    const hlsEndpoint = new mediapackagev2.CfnOriginEndpoint(this, 'HlsEndpoint', {
      channelGroupName: channelGroup.channelGroupName,
      channelName: this.mediaPackageChannel.channelName,
      originEndpointName: hlsOriginEndpointName,
      description: "HLS/TS Origin Endpoint",
      containerType: 'TS',
      startoverWindowSeconds: 1209600,
      segment: {
        segmentDurationSeconds: 4,
        segmentName: segmentName
      },
      hlsManifests: [{
        manifestName: multiVariantManifestName,
        manifestWindowSeconds: 60,
        programDateTimeIntervalSeconds: 60,
        childManifestName: variantManifestName,
      }]
    });

    hlsEndpoint.node.addDependency(this.mediaPackageChannel)

    const hlsOriginEndpointPolicy = new mediapackagev2.CfnOriginEndpointPolicy(
      this,
      "HlsOriginEndpointPolicy",
      {
        channelName: this.mediaPackageChannel.channelName,
        channelGroupName: channelGroup.channelGroupName,
        originEndpointName: hlsOriginEndpointName,
        policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowUser",
              effect: iam.Effect.ALLOW,
              actions: ["mediapackagev2:GetObject", "mediapackagev2:GetHeadObject"],
              principals: [new iam.AnyPrincipal()],
              resources: [hlsEndpoint.attrArn],
            }),
          ],
        }),
      },
    );
    hlsOriginEndpointPolicy.addDependency(hlsEndpoint);

    // HLS Output
    const hlsManifestName = cdk.Fn.join("", [multiVariantManifestName, ".m3u8"]);

    const mpChannelEndpointHlsUrl = cdk.Fn.join("/", [
      "https:/",
      channelGroup.attrEgressDomain,
      "out/v1",
      channelGroup.channelGroupName,
      this.mediaPackageChannel.channelName,
      hlsOriginEndpointName,
      hlsManifestName,
    ]);

    // Set the playback URL for external access
    this.playbackUrl = mpChannelEndpointHlsUrl;

    //--

    // SECURITY FIX: Scoped Policy for MediaLive to access specific MediaPackage channel and logs
    const customPolicyMediaLive = new iam.PolicyDocument({
      statements: [
        // CloudWatch Logs - Scoped to MediaLive logs only
        new iam.PolicyStatement({
          sid: 'MediaLiveLogging',
          effect: iam.Effect.ALLOW,
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
            "logs:DescribeLogStreams",
            "logs:DescribeLogGroups"
          ],
          resources: [
            `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/medialive/*`,
            `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/${cdk.Stack.of(this).stackName}/medialive/*`
          ]
        }),
        // MediaPackage - Scoped to specific channel only
        new iam.PolicyStatement({
          sid: 'MediaPackageAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            "mediapackage:DescribeChannel",
            "mediapackagev2:PutObject"
          ],
          resources: [
            `arn:aws:mediapackagev2:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:channelGroup/${props.channelName}-group/channel/${props.channelName}`
          ]
        })
      ]
    });

    const mediaLiveRole = new iam.Role(this, "MediaLiveAccessRole", {
      inlinePolicies: {
        policy: customPolicyMediaLive,
      },
      assumedBy: new iam.ServicePrincipal("medialive.amazonaws.com"),
    });

    // Get MediaPackage ingest URLs
    const ingestUrls = new MediaPackageIngestUrls(this, 'MediaPackageIngestUrls', {
      channelGroupName: channelGroup.channelGroupName,
      channelName: this.mediaPackageChannel.channelName
    });
    ingestUrls.node.addDependency(this.mediaPackageChannel);


    // HLS Output Group
    const mediaLiveDestination = {
      id: "media-destination",
      settings: [
        {
          url: ingestUrls.ingestEndpoint1,
        }
      ],
    };

    // Encoder settings for MediaPackage v2
    var encoderSettings = {
        timecodeConfig: {
          source: 'EMBEDDED'
        },
        audioDescriptions: [{
          audioSelectorName: 'Default',
          name: 'audio_1',
          codecSettings: {
            aacSettings: {
              bitrate: 96000,
              codingMode: 'CODING_MODE_2_0',
              sampleRate: 48000
            }
          }
        }],
        videoDescriptions: [{
          name: 'video_1080p30',
          codecSettings: {
            h264Settings: {
              bitrate: 5000000,
              framerateControl: 'SPECIFIED',
              framerateNumerator: 30,
              framerateDenominator: 1,
              gopSize: 60,
              gopSizeUnits: 'FRAMES',
              profile: 'HIGH',
              level: 'H264_LEVEL_4_1',
              rateControlMode: 'CBR',
              sceneChangeDetect: 'ENABLED',
              parControl: 'SPECIFIED',
              parNumerator: 1,
              parDenominator: 1
            }
          },
          height: 1080,
          width: 1920
        }, {
          name: 'video_720p30',
          codecSettings: {
            h264Settings: {
              bitrate: 3000000,
              framerateControl: 'SPECIFIED',
              framerateNumerator: 30,
              framerateDenominator: 1,
              gopSize: 60,
              gopSizeUnits: 'FRAMES',
              profile: 'HIGH',
              level: 'H264_LEVEL_4',
              rateControlMode: 'CBR',
              sceneChangeDetect: 'ENABLED',
              parControl: 'SPECIFIED',
              parNumerator: 1,
              parDenominator: 1
            }
          },
          height: 720,
          width: 1280
        }, {
          name: 'video_480p30',
          codecSettings: {
            h264Settings: {
              bitrate: 1500000,
              framerateControl: 'SPECIFIED',
              framerateNumerator: 30,
              framerateDenominator: 1,
              gopSize: 60,
              gopSizeUnits: 'FRAMES',
              profile: 'MAIN',
              level: 'H264_LEVEL_3_1',
              rateControlMode: 'CBR',
              sceneChangeDetect: 'ENABLED',
              parControl: 'SPECIFIED',
              parNumerator: 1,
              parDenominator: 1
            }
          },
          height: 480,
          width: 854
        }, {
          name: 'video_360p30',
          codecSettings: {
            h264Settings: {
              bitrate: 800000,
              framerateControl: 'SPECIFIED',
              framerateNumerator: 30,
              framerateDenominator: 1,
              gopSize: 60,
              gopSizeUnits: 'FRAMES',
              profile: 'MAIN',
              level: 'H264_LEVEL_3',
              rateControlMode: 'CBR',
              sceneChangeDetect: 'ENABLED',
              parControl: 'SPECIFIED',
              parNumerator: 1,
              parDenominator: 1
            }
          },
          height: 360,
          width: 640
        }],
        outputGroups: [{
          name: 'mediapackagev2',
          outputGroupSettings: {
            hlsGroupSettings: {
              adMarkers: [],
              destination: {
                destinationRefId: "media-destination",
              },
              hlsCdnSettings: {
                hlsBasicPutSettings: {
                  connectionRetryInterval: 1,
                  filecacheDuration: 300,
                  numRetries: 10,
                  restartDelay: 15,
                },
              },
              hlsId3SegmentTagging: "ENABLED",
              inputLossAction: "PAUSE_OUTPUT",
              segmentLength: 1,
              minSegmentLength: 1,
              programDateTime: "INCLUDE",
              programDateTimeClock: "SYSTEM_CLOCK",
              programDateTimePeriod: 60,
              SegmentLength: 4,
            },
          },
          outputs: [{
            outputName: '1080p30',
            videoDescriptionName: 'video_1080p30',
            audioDescriptionNames: ['audio_1'],
            outputSettings: {
            }
          }, {
            outputName: '720p30',
            videoDescriptionName: 'video_720p30',
            audioDescriptionNames: ['audio_1'],
            outputSettings: {
            }
          }, {
            outputName: '480p30',
            videoDescriptionName: 'video_480p30',
            audioDescriptionNames: ['audio_1'],
            outputSettings: {
            }
          }, {
            outputName: '360p30',
            videoDescriptionName: 'video_360p30',
            audioDescriptionNames: ['audio_1'],
            outputSettings: {
            }
          }]
        }]
    };

    const commonOutputSettings = {
      hlsOutputSettings: {
        h265PackagingType: "HVC1",
        hlsSettings: {
          standardHlsSettings: {
            audioRenditionSets: "program_audio",
            m3U8Settings: {
              scte35Behavior: "NO_PASSTHROUGH",
              scte35Pid: "500",
            },
          },
        },
      },
    };

    // Set output settings for each output in the output group
    for (let i = 0; i < encoderSettings.outputGroups[0].outputs.length; i++) {
      encoderSettings.outputGroups[0].outputs[i].outputSettings = commonOutputSettings;
    }

    // MediaLive Channel
    this.mediaLiveChannel = new medialive.CfnChannel(this, 'MediaLiveChannel', {
      name: props.channelName,
      channelClass: 'SINGLE_PIPELINE',
      roleArn: mediaLiveRole.roleArn,
      inputSpecification: {
        codec: 'AVC',
        maximumBitrate: 'MAX_20_MBPS',
        resolution: 'HD'
      },
      inputAttachments: [{
        inputId: props.mediaLiveInputId,
        inputAttachmentName: 'StreamInspectedInput'
      }],
      destinations: [mediaLiveDestination],
      encoderSettings: encoderSettings
    });


    // Create MediaPackage Channel policy
    const mpChannelPolicy = new mediapackagev2.CfnChannelPolicy(
      this,
      "MPChannelPolicy",
      {
        channelName: this.mediaPackageChannel.channelName,
        channelGroupName: channelGroup.channelGroupName,
        policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: "AllowMediaLiveChannelToIngestToEmpChannel",
              effect: iam.Effect.ALLOW,
              actions: ["mediapackagev2:PutObject"],
              principals: [new iam.ArnPrincipal(mediaLiveRole.roleArn)],
              resources: [cdk.Fn.sub('arn:aws:mediapackagev2:${AWS::Region}:${AWS::AccountId}:channelGroup/${ChannelGroupName}/channel/${ChannelName}', {
                ChannelGroupName: channelGroup.channelGroupName,
                ChannelName: this.mediaPackageChannel.channelName
              })],
            }),
          ],
        }),
      },
    );

  }

}