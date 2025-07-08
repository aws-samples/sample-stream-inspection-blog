#!/bin/bash

# verify-cleanup.sh - Verify that all resources have been cleaned up after stack destruction

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="${STACK_NAME:-StreamInspectionBlogStack}"
REGION="${AWS_DEFAULT_REGION:-$(aws configure get region)}"

echo -e "${BLUE}🔍 Verifying cleanup for stack: ${STACK_NAME}${NC}"
echo -e "${BLUE}📍 Region: ${REGION}${NC}"
echo ""

# Counters
ISSUES_FOUND=0

# Function to log results
log_ok() {
    echo -e "${GREEN}✅${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
    ((ISSUES_FOUND++))
}

# Function to check CloudFormation stacks
check_cloudformation_stacks() {
    echo -e "${BLUE}Checking CloudFormation stacks...${NC}"
    
    STACKS=$(aws cloudformation list-stacks \
        --region "$REGION" \
        --query "StackSummaries[?StackName=='$STACK_NAME' && StackStatus!='DELETE_COMPLETE'].{Name:StackName,Status:StackStatus}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$STACKS" ]; then
        log_warning "Stack still exists: $STACKS"
    else
        log_ok "Main stack successfully deleted"
    fi
}

# Function to check MediaConnect resources
check_mediaconnect_resources() {
    echo -e "${BLUE}Checking MediaConnect resources...${NC}"
    
    FLOWS=$(aws mediaconnect list-flows \
        --region "$REGION" \
        --query "Flows[?contains(Name, 'StreamInspection') || contains(Name, 'LiveStream')].{Name:Name,Status:Status}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$FLOWS" ]; then
        log_warning "MediaConnect flows still exist: $FLOWS"
    else
        log_ok "No MediaConnect flows remaining"
    fi
}

# Function to check MediaLive resources
check_medialive_resources() {
    echo -e "${BLUE}Checking MediaLive resources...${NC}"
    
    INPUTS=$(aws medialive list-inputs \
        --region "$REGION" \
        --query "Inputs[?contains(to_string(Tags), 'StreamInspection')].{Id:Id,Name:Name,State:State}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$INPUTS" ]; then
        log_warning "MediaLive inputs still exist: $INPUTS"
    else
        log_ok "No MediaLive inputs remaining"
    fi
    
    CHANNELS=$(aws medialive list-channels \
        --region "$REGION" \
        --query "Channels[?contains(to_string(Tags), 'StreamInspection')].{Id:Id,Name:Name,State:State}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$CHANNELS" ]; then
        log_warning "MediaLive channels still exist: $CHANNELS"
    else
        log_ok "No MediaLive channels remaining"
    fi
}

# Function to check CloudWatch resources
check_cloudwatch_resources() {
    echo -e "${BLUE}Checking CloudWatch resources...${NC}"
    
    LOG_GROUPS=$(aws logs describe-log-groups \
        --region "$REGION" \
        --query "logGroups[?contains(logGroupName, 'StreamInspection') || contains(logGroupName, 'stream-inspection')].logGroupName" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$LOG_GROUPS" ]; then
        log_warning "CloudWatch log groups still exist: $LOG_GROUPS"
    else
        log_ok "No CloudWatch log groups remaining"
    fi
}

# Main verification process
main() {
    echo -e "${BLUE}🚀 Starting cleanup verification...${NC}"
    echo ""
    
    check_cloudformation_stacks
    check_mediaconnect_resources
    check_medialive_resources
    check_cloudwatch_resources
    
    echo ""
    if [ $ISSUES_FOUND -eq 0 ]; then
        echo -e "${GREEN}✅ Cleanup verification completed successfully${NC}"
        echo -e "${GREEN}🎉 All resources appear to be cleaned up${NC}"
    else
        echo -e "${YELLOW}⚠️  Cleanup verification found $ISSUES_FOUND potential issues${NC}"
        echo -e "${YELLOW}💡 Consider running 'npm run cleanup:residual' to clean up remaining resources${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📊 Monitor your AWS billing dashboard for any remaining charges${NC}"
}

# Run main function
main "$@"
