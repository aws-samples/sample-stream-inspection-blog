import { MediaPackageV2Client, GetChannelCommand } from '@aws-sdk/client-mediapackagev2';
import { 
  CloudFormationCustomResourceEvent, 
  CloudFormationCustomResourceResponse,
  Context 
} from 'aws-lambda';

/**
 * MediaPackage Ingest URLs Handler
 * 
 * Retrieves MediaPackage channel ingest URLs for MediaLive output configuration.
 */

// AWS SDK client
const mediaPackageV2 = new MediaPackageV2Client({});

/**
 * Custom resource properties interface
 */
interface MediaPackageIngestUrlsProperties {
  ChannelGroupName: string;
  ChannelName: string;
}

/**
 * Custom resource response data interface
 */
interface MediaPackageIngestUrlsResponseData {
  IngestEndpoint1: string;
  IngestEndpoint2: string;
}

/**
 * Validates MediaPackage ingest endpoint URLs for security
 */
function validateIngestEndpoint(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    
    // Must be HTTPS for security
    if (parsedUrl.protocol !== 'https:') {
      console.warn('Ingest endpoint is not using HTTPS protocol');
      return false;
    }

    // Must be AWS MediaPackage domain
    if (!parsedUrl.hostname.includes('mediapackagev2') || !parsedUrl.hostname.includes('amazonaws.com')) {
      console.warn('Ingest endpoint is not from AWS MediaPackage domain');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Invalid ingest endpoint URL format:', error);
    return false;
  }
}

/**
 * Validates channel/group names for security
 */
function validateChannelName(name: string, fieldName: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  if (name.length > 256) {
    throw new Error(`${fieldName} exceeds maximum length of 256 characters`);
  }

  // AWS MediaPackage naming pattern
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(`${fieldName} contains invalid characters. Only alphanumeric, underscore, and hyphen are allowed`);
  }

  // Security checks for malicious patterns
  const maliciousPatterns = [/\.\./g, /\/\//g, /<[^>]*>/g, /javascript:/gi, /data:/gi, /['"]/g, /;/g, /\|/g, /&/g, /\$/g, /`/g];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(name)) {
      throw new Error(`${fieldName} contains potentially malicious patterns`);
    }
  }

  return name.trim();
}

/**
 * Main Lambda handler
 */
export const handler = async (
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<CloudFormationCustomResourceResponse> => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));
  
  const { RequestType, ResourceProperties } = event;
  const physicalResourceId = 'PhysicalResourceId' in event ? event.PhysicalResourceId : undefined;
  const { ChannelGroupName, ChannelName } = ResourceProperties as unknown as MediaPackageIngestUrlsProperties;
  
  // SECURITY FIX: Validate input parameters
  const validatedChannelGroupName = validateChannelName(ChannelGroupName, 'ChannelGroupName');
  const validatedChannelName = validateChannelName(ChannelName, 'ChannelName');
  
  try {
    if (RequestType === 'Create' || RequestType === 'Update') {
      console.log(`Getting ingest URLs for channel: ${validatedChannelGroupName}/${validatedChannelName}`);
      
      const response = await mediaPackageV2.send(new GetChannelCommand({
        ChannelGroupName: validatedChannelGroupName,
        ChannelName: validatedChannelName
      }));
      
      const ingestEndpoints = response.IngestEndpoints || [];
      console.log(`Found ${ingestEndpoints.length} ingest endpoints`);
      
      if (ingestEndpoints.length >= 2) {
        const endpoint1 = ingestEndpoints[0].Url!;
        const endpoint2 = ingestEndpoints[1].Url!;
        
        // SECURITY FIX: Validate ingest endpoint URLs
        if (!validateIngestEndpoint(endpoint1) || !validateIngestEndpoint(endpoint2)) {
          const errorMessage = 'Ingest endpoints failed security validation';
          console.error(errorMessage);
          
          return {
            Status: 'FAILED',
            Reason: errorMessage,
            PhysicalResourceId: physicalResourceId || `${validatedChannelGroupName}-${validatedChannelName}-failed`,
            LogicalResourceId: event.LogicalResourceId,
            RequestId: event.RequestId,
            StackId: event.StackId
          };
        }
        
        const responseData: MediaPackageIngestUrlsResponseData = {
          IngestEndpoint1: endpoint1,
          IngestEndpoint2: endpoint2
        };
        
        console.log('Successfully retrieved ingest URLs:', responseData);
        
        return {
          Status: 'SUCCESS',
          PhysicalResourceId: `${validatedChannelGroupName}-${validatedChannelName}-ingest-urls`,
          Data: responseData,
          LogicalResourceId: event.LogicalResourceId,
          RequestId: event.RequestId,
          StackId: event.StackId
        };
      } else {
        const errorMessage = `Not enough ingest endpoints found. Expected at least 2, found ${ingestEndpoints.length}`;
        console.error(errorMessage);
        
        return {
          Status: 'FAILED',
          Reason: errorMessage,
          PhysicalResourceId: physicalResourceId || `${validatedChannelGroupName}-${validatedChannelName}-failed`,
          LogicalResourceId: event.LogicalResourceId,
          RequestId: event.RequestId,
          StackId: event.StackId
        };
      }
      
    } else if (RequestType === 'Delete') {
      console.log('Delete request - no action needed for MediaPackage ingest URLs');
      
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: physicalResourceId || 'delete-resource',
        LogicalResourceId: event.LogicalResourceId,
        RequestId: event.RequestId,
        StackId: event.StackId
      };
    }
    
    // This should never be reached, but TypeScript requires a return
    throw new Error(`Unsupported RequestType: ${RequestType}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in MediaPackage ingest URLs handler:', error);
    
    return {
      Status: 'FAILED',
      Reason: `MediaPackage ingest URLs retrieval failed: ${errorMessage}`,
      PhysicalResourceId: physicalResourceId || 'failed-resource',
      LogicalResourceId: event.LogicalResourceId,
      RequestId: event.RequestId,
      StackId: event.StackId
    };
  }
};
