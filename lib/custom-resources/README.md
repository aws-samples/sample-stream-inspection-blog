# Custom Resources

This directory contains AWS CDK custom resources used throughout the Stream Intelligence Blog project. Each custom resource is organized in its own folder for better maintainability and modularity.

## Directory Structure

```
custom-resources/
├── README.md                           # This file
└── mediapackage-ingest-urls/           # MediaPackage URL management
    ├── mediapackage-ingest-urls.ts     # CDK construct implementation
    ├── index.ts                        # Clean exports
    ├── README.md                       # Component documentation
    └── lambda/                         # TypeScript Lambda function
        ├── mediapackage-ingest-urls-handler.ts # Lambda source code
        ├── mediapackage-ingest-urls-handler.js # Compiled JavaScript (auto-generated)
        ├── package.json                # Lambda dependencies and scripts
        ├── tsconfig.json               # TypeScript configuration
        ├── README.md                   # Lambda documentation
        └── node_modules/               # Lambda dependencies
```

## Active Custom Resources

### MediaPackage Ingest URLs
**Purpose**: Retrieves and manages MediaPackage ingest endpoints
**Used by**: OTT Streaming construct (ott-streaming-construct.ts)

**Features**:
- Retrieves MediaPackage channel ingest URLs
- Provides ingest endpoint information for MediaLive outputs
- Manages MediaPackage channel configuration
- Handles URL rotation and updates

## Usage Patterns

### Importing Custom Resources

```typescript
// Clean imports using index.ts files
import { MediaLifecycle } from './custom-resources/media-lifecycle';
import { MediaPackageIngestUrls } from './custom-resources/mediapackage-ingest-urls';
```

### Example Usage

#### Media Lifecycle
```typescript
import { MediaLifecycle } from './custom-resources/media-lifecycle';

new MediaLifecycle(this, 'MediaLifecycleManager', {
  mediaConnectFlowArns: [flow1.attrFlowArn, flow2.attrFlowArn],
  mediaLiveChannelId: channel.ref
});
```

#### MediaPackage Ingest URLs
```typescript
import { MediaPackageIngestUrls } from './custom-resources/mediapackage-ingest-urls';

const ingestUrls = new MediaPackageIngestUrls(this, 'IngestUrls', {
  channelGroupName: channelGroup.attrChannelGroupName,
  channelName: channel.attrChannelName
});
```

## Implementation Guidelines

1. **TypeScript First**: All custom resources are implemented in TypeScript
2. **Self-Contained**: Each custom resource is in its own folder
3. **Documentation**: Include README.md with purpose and usage examples
4. **Index Exports**: Use index.ts for clean import paths
5. **Error Handling**: Implement proper error handling and logging

### Lambda Function Development
```bash
# Build specific Lambda function
cd lib/custom-resources/media-lifecycle/lambda
npm install && npm run build

# Or build MediaPackage Lambda function
cd lib/custom-resources/mediapackage-ingest-urls/lambda
npm install && npm run build

# Build all Lambda functions (from project root)
npm run build:lambdas  # If script is added to main package.json
```
