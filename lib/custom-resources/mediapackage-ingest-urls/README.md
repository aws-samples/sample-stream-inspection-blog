# MediaPackage Ingest URLs Custom Resource

This custom resource retrieves and manages MediaPackage ingest URLs for streaming configuration.

## Purpose

The `MediaPackageIngestUrls` custom resource is used to:
- Retrieve MediaPackage channel ingest URLs
- Provide ingest endpoint information for MediaLive outputs
- Manage MediaPackage channel configuration
- Handle URL rotation and updates

## Usage

```typescript
import { MediaPackageIngestUrls } from './custom-resources/mediapackage-ingest-urls';

const ingestUrls = new MediaPackageIngestUrls(this, 'IngestUrls', {
  // Configuration properties
});
```

## Files

- `mediapackage-ingest-urls.ts` - Main custom resource implementation
- `index.ts` - Export definitions
- `README.md` - This documentation
- `lambda/` - TypeScript Lambda function directory
  - `mediapackage-ingest-urls-handler.ts` - Lambda function source code
  - `mediapackage-ingest-urls-handler.js` - Compiled JavaScript (auto-generated)
  - `package.json` - Lambda dependencies and build scripts
  - `tsconfig.json` - TypeScript configuration
  - `README.md` - Lambda function documentation

## Dependencies

- AWS CDK Custom Resources
- AWS MediaPackage V2 API (via Lambda function)
- TypeScript Lambda function with AWS SDK v3
