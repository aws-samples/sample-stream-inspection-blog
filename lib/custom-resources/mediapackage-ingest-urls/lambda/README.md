# MediaPackage Ingest URLs Lambda Handler

This directory contains the TypeScript Lambda function for retrieving MediaPackage channel ingest URLs.

## Overview

The MediaPackage Ingest URLs Handler queries MediaPackage V2 API to retrieve channel ingest endpoints, which are used to configure MediaLive outputs for streaming to MediaPackage.

## Function Details

### Handler
- **File**: `mediapackage-ingest-urls-handler.ts`
- **Compiled**: `mediapackage-ingest-urls-handler.js`
- **Handler**: `mediapackage-ingest-urls-handler.handler`
- **Runtime**: Node.js 18.x

### Features
- **MediaPackage V2 Integration**: Uses latest MediaPackage V2 API
- **Dual Endpoint Retrieval**: Returns primary and secondary ingest URLs
- **Error Handling**: Validates sufficient endpoints are available
- **CloudFormation Integration**: Proper custom resource response format

### Dependencies
- `@aws-sdk/client-mediapackagev2`: MediaPackage V2 service operations
- `@types/aws-lambda`: Lambda event and context types

## Development

### Building
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run build

# Clean compiled files
npm run clean
```

### Configuration
- **Memory**: 256 MB
- **Timeout**: 5 minutes
- **Environment**: Node.js 18.x with source maps

## Usage

### Custom Resource Properties
```typescript
interface MediaPackageIngestUrlsProperties {
  ChannelGroupName: string;        // MediaPackage channel group name
  ChannelName: string;             // MediaPackage channel name
}
```

### Response Data
```typescript
interface MediaPackageIngestUrlsResponseData {
  IngestEndpoint1: string;         // Primary ingest URL
  IngestEndpoint2: string;         // Secondary ingest URL
}
```

## Operations

### Create/Update
1. **Query MediaPackage**: Call GetChannel API to retrieve channel details
2. **Extract Endpoints**: Extract ingest endpoints from response
3. **Validate Count**: Ensure at least 2 endpoints are available
4. **Return URLs**: Return primary and secondary ingest URLs

### Delete
- **No Action**: Delete operations require no cleanup for URL retrieval

## Error Handling

### Validation
- **Insufficient Endpoints**: Fails if less than 2 ingest endpoints found
- **Missing Channel**: Handles channel not found errors
- **API Errors**: Comprehensive error handling for MediaPackage API calls

### Response Format
- **Success**: Returns ingest URLs in CloudFormation custom resource format
- **Failure**: Returns detailed error messages for troubleshooting

## Monitoring

### CloudWatch Logs
- API request/response logging
- Error details with context
- Performance metrics
- Endpoint validation results

### Metrics
- API call success/failure rates
- Response times
- Error frequencies by type

## Security

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mediapackagev2:GetChannel",
        "mediapackagev2:DescribeChannel"
      ],
      "Resource": "*"
    }
  ]
}
```

## Integration

### MediaLive Output Configuration
The retrieved ingest URLs are used to configure MediaLive channel outputs:

```typescript
// Example usage in MediaLive output
const output = {
  OutputName: 'MediaPackageOutput',
  OutputSettings: {
    MediaPackageOutputSettings: {
      ChannelId: channelId
    }
  },
  OutputGroupSettings: {
    MediaPackageGroupSettings: {
      Destination: {
        DestinationRefId: 'mediapackage_destination'
      }
    }
  }
};
```

## Troubleshooting

### Common Issues
1. **Channel Not Found**: Verify channel group and channel names are correct
2. **Insufficient Endpoints**: Check MediaPackage channel configuration
3. **Permission Errors**: Verify IAM policies include MediaPackage permissions
4. **API Throttling**: Handle rate limiting with exponential backoff

### Debugging
- Check CloudWatch logs for API responses
- Verify MediaPackage channel exists and is configured
- Test MediaPackage API calls independently
- Validate custom resource properties

## MediaPackage V2 API

### Channel Structure
```json
{
  "ChannelGroupName": "string",
  "ChannelName": "string",
  "IngestEndpoints": [
    {
      "Id": "string",
      "Url": "https://...",
      "Username": "string",
      "Password": "string"
    }
  ]
}
```

### Best Practices
- Always use both primary and secondary endpoints for redundancy
- Monitor endpoint health and availability
- Implement proper error handling for API failures
- Cache endpoint information when appropriate
