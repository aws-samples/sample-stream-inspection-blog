# Unit Tests

This directory contains comprehensive unit tests for the Stream Inspection Blog infrastructure components.

## Test Coverage

### ContributionConstruct Tests (`contribution-construct.test.ts`)

**32 tests covering all aspects of the MediaConnect contribution construct:**

#### Constructor Tests (6 tests)
- ✅ MediaConnect flow creation with correct properties
- ✅ IAM role creation with proper permissions
- ✅ VPC interface configuration
- ✅ Security group rules and configuration
- ✅ Flow outputs for multiple destinations
- ✅ SRT input properties and URL generation

#### SRT Source Configuration (2 tests)
- ✅ Default port usage (5000) when not specified
- ✅ Custom port configuration

#### VPC Interface Name Generation (3 tests)
- ✅ Normal stack name handling
- ✅ Long stack name truncation (24 character limit)
- ✅ Short stack name handling

#### Flow Output Methods (5 tests)
- ✅ Flow output retrieval by index
- ✅ Error handling for invalid indices
- ✅ Primary output access
- ✅ Secondary output access
- ✅ Output count verification

#### Configuration Flexibility (2 tests)
- ✅ Single destination configuration
- ✅ Multiple destinations configuration

#### Resource Dependencies (1 test)
- ✅ Proper dependency ordering (Flow → VPC Interface → Outputs)

#### Security Group Configuration (2 tests)
- ✅ VPC-scoped security rules
- ✅ Proper resource tagging

#### IAM Role Security (2 tests)
- ✅ Region-scoped permissions
- ✅ Resource-specific write permissions

#### Utility Methods (1 test)
- ✅ Flow status method (returns ARN)

#### Error Handling (1 test)
- ✅ Empty destinations array handling

#### CDK Integration (2 tests)
- ✅ Stack account and region usage in IAM policies
- ✅ VPC interface naming based on stack name

#### Resource Naming (2 tests)
- ✅ Custom flow name and description usage
- ✅ Custom SRT source name usage

#### TypeScript Interface Tests (3 tests)
- ✅ SrtSourceConfig interface validation
- ✅ FlowOutputDestination interface validation
- ✅ ContributionConstructProps interface validation

## Test Features

### Comprehensive Coverage
- **All public methods** tested with various input scenarios
- **Error conditions** tested with appropriate assertions
- **Edge cases** covered (empty arrays, invalid indices, long names)
- **CDK integration** verified with CloudFormation template assertions

### Professional Testing Practices
- **Proper setup/teardown** with beforeEach hooks
- **Isolated tests** with fresh stack instances
- **Clear test descriptions** following BDD naming conventions
- **Comprehensive assertions** using CDK Template assertions
- **Type safety** with TypeScript interface validation

### CDK-Specific Testing
- **Template assertions** using `Template.fromStack()`
- **Resource property verification** with `hasResourceProperties()`
- **Resource counting** with `resourceCountIs()`
- **CDK token handling** for dynamic values
- **Dependency verification** using CDK node dependencies

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- contribution-construct.test.ts

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

## Test Results

```
PASS test/contribution-construct.test.ts (5.779 s)
  ContributionConstruct
    Constructor
      ✓ should create a MediaConnect flow with correct properties (234 ms)
      ✓ should create IAM role with correct permissions (40 ms)
      ✓ should create VPC interface with correct configuration (34 ms)
      ✓ should create security group with correct rules (31 ms)
      ✓ should create flow outputs for each destination (34 ms)
      ✓ should set SRT input properties correctly (5 ms)
    [... 26 more tests ...]

Test Suites: 1 passed, 1 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Time:        5.902 s
```

## Key Testing Challenges Solved

### 1. CDK Token Handling
CDK generates tokens for dynamic values (like VPC IDs, ARNs). Tests handle this by:
- Using `Match.anyValue()` for dynamic references
- Checking string patterns instead of exact matches
- Verifying structure rather than exact values

### 2. CloudFormation Template Assertions
Tests verify generated CloudFormation templates using:
- `Template.fromStack()` for template extraction
- `hasResourceProperties()` for property verification
- `Match.arrayWith()` and `Match.objectLike()` for flexible matching

### 3. Resource Dependencies
Tests verify proper CDK dependency ordering:
- VPC Interface depends on MediaConnect Flow
- Flow Outputs depend on VPC Interface
- Using `node.dependencies` for verification

### 4. Security Validation
Tests ensure security best practices:
- IAM permissions scoped to specific regions and resources
- Security group rules limited to VPC CIDR blocks
- Proper resource tagging for management

## Future Test Additions

Consider adding tests for:
- **Integration tests** with real AWS resources
- **Performance tests** for large numbers of destinations
- **Security tests** with penetration testing scenarios
- **Snapshot tests** for CloudFormation template consistency
