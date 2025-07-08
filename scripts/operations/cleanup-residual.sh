#!/bin/bash

# cleanup-residual.sh - Clean up residual AWS resources after CDK stack destruction

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="${STACK_NAME:-StreamInspectionBlogStack}"
REGION="${AWS_DEFAULT_REGION:-$(aws configure get region)}"

echo -e "${BLUE}🧹 Cleaning up residual resources for stack: ${STACK_NAME}${NC}"
echo -e "${BLUE}📍 Region: ${REGION}${NC}"
echo ""

# Function to log actions
log_action() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

# Function to clean up CloudWatch log groups
cleanup_log_groups() {
    echo -e "${BLUE}Cleaning up CloudWatch log groups...${NC}"
    
    LOG_GROUPS=$(aws logs describe-log-groups \
        --region "$REGION" \
        --query "logGroups[?contains(logGroupName, 'StreamInspection') || contains(logGroupName, 'stream-inspection')].logGroupName" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$LOG_GROUPS" ]; then
        for log_group in $LOG_GROUPS; do
            aws logs delete-log-group --log-group-name "$log_group" --region "$REGION" 2>/dev/null || true
            log_action "Deleted log group: $log_group"
        done
    else
        log_action "No orphaned log groups found"
    fi
}

# Function to clean up S3 buckets
cleanup_s3_buckets() {
    echo -e "${BLUE}Cleaning up S3 buckets...${NC}"
    
    BUCKETS=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, 'streaminspection') || contains(Name, 'stream-inspection')].Name" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$BUCKETS" ]; then
        for bucket in $BUCKETS; do
            aws s3 rm "s3://$bucket" --recursive --region "$REGION" 2>/dev/null || true
            aws s3api delete-bucket --bucket "$bucket" --region "$REGION" 2>/dev/null || true
            log_action "Cleaned up bucket: $bucket"
        done
    else
        log_action "No orphaned S3 buckets found"
    fi
}

# Function to clean up VPC endpoints
cleanup_vpc_endpoints() {
    echo -e "${BLUE}Cleaning up VPC endpoints...${NC}"
    
    VPC_ENDPOINTS=$(aws ec2 describe-vpc-endpoints \
        --region "$REGION" \
        --query "VpcEndpoints[?contains(to_string(Tags), 'StreamInspection')].VpcEndpointId" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$VPC_ENDPOINTS" ]; then
        for endpoint in $VPC_ENDPOINTS; do
            aws ec2 delete-vpc-endpoint --vpc-endpoint-id "$endpoint" --region "$REGION" 2>/dev/null || true
            log_action "Deleted VPC endpoint: $endpoint"
        done
    else
        log_action "No orphaned VPC endpoints found"
    fi
}

# Main cleanup process
main() {
    echo -e "${YELLOW}This will clean up residual AWS resources that may incur charges${NC}"
    echo ""
    
    read -p "Continue with cleanup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cleanup cancelled"
        exit 0
    fi
    
    cleanup_log_groups
    cleanup_s3_buckets
    cleanup_vpc_endpoints
    
    echo ""
    echo -e "${GREEN}✅ Residual resource cleanup completed${NC}"
    echo -e "${BLUE}💡 Run 'npm run cleanup:verify' to verify cleanup${NC}"
}

# Run main function
main "$@"
