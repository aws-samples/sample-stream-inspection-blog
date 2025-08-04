#!/bin/bash

# verify-cleanup.sh - Verify that all resources have been cleaned up after stack destruction
# This script checks for any remaining AWS resources that could incur charges

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="${STACK_NAME:-StreamInspectionBlogStack}"
REGION="${AWS_DEFAULT_REGION:-$(aws configure get region)}"
VERBOSE="${VERBOSE:-false}"

echo -e "${BLUE}🔍 Stream Inspection Stack - Cleanup Verification${NC}"
echo -e "${BLUE}📍 Stack: ${STACK_NAME}${NC}"
echo -e "${BLUE}📍 Region: ${REGION}${NC}"
if [ "$VERBOSE" = "true" ]; then
    echo -e "${CYAN}📍 Mode: VERBOSE${NC}"
fi
echo ""

# Counters
ISSUES_FOUND=0
RESOURCES_CHECKED=0

# Function to log results
log_ok() {
    echo -e "${GREEN}✅${NC} $1"
    ((RESOURCES_CHECKED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
    ((ISSUES_FOUND++))
    ((RESOURCES_CHECKED++))
}

log_error() {
    echo -e "${RED}❌${NC} $1"
    ((ISSUES_FOUND++))
    ((RESOURCES_CHECKED++))
}

log_info() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${CYAN}ℹ️${NC} $1"
    fi
}

# Function to check CloudFormation stacks
check_cloudformation_stacks() {
    echo -e "${BLUE}Checking CloudFormation stacks...${NC}"
    
    local stacks=$(aws cloudformation list-stacks \
        --region "$REGION" \
        --query "StackSummaries[?StackName=='$STACK_NAME' && StackStatus!='DELETE_COMPLETE'].{Name:StackName,Status:StackStatus}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$stacks" ] && [ "$stacks" != "None" ]; then
        log_warning "Stack still exists: $stacks"
        log_info "Run 'npx cdk destroy $STACK_NAME' to delete the stack"
    else
        log_ok "Main stack successfully deleted"
    fi
    
    # Check for nested stacks
    local nested_stacks=$(aws cloudformation list-stacks \
        --region "$REGION" \
        --query "StackSummaries[?contains(StackName, '$STACK_NAME') && StackStatus!='DELETE_COMPLETE'].{Name:StackName,Status:StackStatus}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$nested_stacks" ] && [ "$nested_stacks" != "None" ]; then
        log_warning "Nested stacks still exist: $nested_stacks"
    else
        log_ok "No nested stacks remaining"
    fi
}

# Function to check MediaConnect resources
check_mediaconnect_resources() {
    echo -e "${BLUE}Checking MediaConnect resources...${NC}"
    
    local flows=$(aws mediaconnect list-flows \
        --region "$REGION" \
        --query "Flows[?contains(Name, 'StreamInspection') || contains(Name, 'LiveStream') || contains(Name, 'stream-inspection')].{Name:Name,Status:Status,FlowArn:FlowArn}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$flows" ] && [ "$flows" != "None" ]; then
        log_warning "MediaConnect flows still exist:"
        echo "$flows" | while read -r line; do
            log_info "  Flow: $line"
        done
        log_info "Run 'npm run cleanup:residual' to clean up MediaConnect flows"
    else
        log_ok "No MediaConnect flows remaining"
    fi
}

# Function to check MediaLive resources
check_medialive_resources() {
    echo -e "${BLUE}Checking MediaLive resources...${NC}"
    
    # Check inputs
    local inputs=$(aws medialive list-inputs \
        --region "$REGION" \
        --query "Inputs[?contains(to_string(Tags), 'StreamInspection') || contains(Name, 'StreamInspection')].{Id:Id,Name:Name,State:State}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$inputs" ] && [ "$inputs" != "None" ]; then
        log_warning "MediaLive inputs still exist:"
        echo "$inputs" | while read -r line; do
            log_info "  Input: $line"
        done
    else
        log_ok "No MediaLive inputs remaining"
    fi
    
    # Check channels
    local channels=$(aws medialive list-channels \
        --region "$REGION" \
        --query "Channels[?contains(to_string(Tags), 'StreamInspection') || contains(Name, 'StreamInspection')].{Id:Id,Name:Name,State:State}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$channels" ] && [ "$channels" != "None" ]; then
        log_warning "MediaLive channels still exist:"
        echo "$channels" | while read -r line; do
            log_info "  Channel: $line"
        done
    else
        log_ok "No MediaLive channels remaining"
    fi
}

# Function to check MediaPackage resources
check_mediapackage_resources() {
    echo -e "${BLUE}Checking MediaPackage resources...${NC}"
    
    # Check origin endpoints
    local endpoints=$(aws mediapackage list-origin-endpoints \
        --region "$REGION" \
        --query "OriginEndpoints[?contains(Id, 'StreamInspection') || contains(Id, 'stream-inspection')].{Id:Id,Url:Url}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$endpoints" ] && [ "$endpoints" != "None" ]; then
        log_warning "MediaPackage origin endpoints still exist:"
        echo "$endpoints" | while read -r line; do
            log_info "  Endpoint: $line"
        done
    else
        log_ok "No MediaPackage origin endpoints remaining"
    fi
    
    # Check channels
    local channels=$(aws mediapackage list-channels \
        --region "$REGION" \
        --query "Channels[?contains(Id, 'StreamInspection') || contains(Id, 'stream-inspection')].{Id:Id,Description:Description}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$channels" ] && [ "$channels" != "None" ]; then
        log_warning "MediaPackage channels still exist:"
        echo "$channels" | while read -r line; do
            log_info "  Channel: $line"
        done
    else
        log_ok "No MediaPackage channels remaining"
    fi
}

# Function to check EC2 resources
check_ec2_resources() {
    echo -e "${BLUE}Checking EC2 resources...${NC}"
    
    # Check instances
    local instances=$(aws ec2 describe-instances \
        --region "$REGION" \
        --query "Reservations[].Instances[?contains(to_string(Tags), 'StreamInspection') && State.Name!='terminated'].{Id:InstanceId,State:State.Name,Type:InstanceType}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$instances" ] && [ "$instances" != "None" ]; then
        log_warning "EC2 instances still exist:"
        echo "$instances" | while read -r line; do
            log_info "  Instance: $line"
        done
    else
        log_ok "No EC2 instances remaining"
    fi
    
    # Check Auto Scaling Groups
    local asgs=$(aws autoscaling describe-auto-scaling-groups \
        --region "$REGION" \
        --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'StreamInspection') || contains(AutoScalingGroupName, 'SecurityAppliances')].{Name:AutoScalingGroupName,Desired:DesiredCapacity,Min:MinSize,Max:MaxSize}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$asgs" ] && [ "$asgs" != "None" ]; then
        log_warning "Auto Scaling Groups still exist:"
        echo "$asgs" | while read -r line; do
            log_info "  ASG: $line"
        done
    else
        log_ok "No Auto Scaling Groups remaining"
    fi
    
    # Check Launch Templates
    local templates=$(aws ec2 describe-launch-templates \
        --region "$REGION" \
        --query "LaunchTemplates[?contains(to_string(Tags), 'StreamInspection')].{Id:LaunchTemplateId,Name:LaunchTemplateName}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$templates" ] && [ "$templates" != "None" ]; then
        log_warning "Launch Templates still exist:"
        echo "$templates" | while read -r line; do
            log_info "  Template: $line"
        done
    else
        log_ok "No Launch Templates remaining"
    fi
    
    # Check Key Pairs
    local key_pairs=$(aws ec2 describe-key-pairs \
        --region "$REGION" \
        --query "KeyPairs[?contains(to_string(Tags), 'StreamInspection')].{Name:KeyName,Id:KeyPairId}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$key_pairs" ] && [ "$key_pairs" != "None" ]; then
        log_warning "Key Pairs still exist:"
        echo "$key_pairs" | while read -r line; do
            log_info "  Key Pair: $line"
        done
    else
        log_ok "No Key Pairs remaining"
    fi
}

# Function to check Load Balancer resources
check_load_balancer_resources() {
    echo -e "${BLUE}Checking Load Balancer resources...${NC}"
    
    # Check Gateway Load Balancers
    local gwlbs=$(aws elbv2 describe-load-balancers \
        --region "$REGION" \
        --query "LoadBalancers[?Type=='gateway' && contains(to_string(Tags), 'StreamInspection')].{Name:LoadBalancerName,State:State.Code,Type:Type}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$gwlbs" ] && [ "$gwlbs" != "None" ]; then
        log_warning "Gateway Load Balancers still exist:"
        echo "$gwlbs" | while read -r line; do
            log_info "  GWLB: $line"
        done
    else
        log_ok "No Gateway Load Balancers remaining"
    fi
    
    # Check Target Groups
    local target_groups=$(aws elbv2 describe-target-groups \
        --region "$REGION" \
        --query "TargetGroups[?contains(to_string(Tags), 'StreamInspection')].{Name:TargetGroupName,Protocol:Protocol,Port:Port}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$target_groups" ] && [ "$target_groups" != "None" ]; then
        log_warning "Target Groups still exist:"
        echo "$target_groups" | while read -r line; do
            log_info "  Target Group: $line"
        done
    else
        log_ok "No Target Groups remaining"
    fi
}

# Function to check VPC resources
check_vpc_resources() {
    echo -e "${BLUE}Checking VPC resources...${NC}"
    
    # Check VPCs
    local vpcs=$(aws ec2 describe-vpcs \
        --region "$REGION" \
        --query "Vpcs[?contains(to_string(Tags), 'StreamInspection') && !IsDefault].{Id:VpcId,State:State,Cidr:CidrBlock}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$vpcs" ] && [ "$vpcs" != "None" ]; then
        log_warning "VPCs still exist:"
        echo "$vpcs" | while read -r line; do
            log_info "  VPC: $line"
        done
    else
        log_ok "No custom VPCs remaining"
    fi
    
    # Check VPC Endpoints
    local vpc_endpoints=$(aws ec2 describe-vpc-endpoints \
        --region "$REGION" \
        --query "VpcEndpoints[?contains(to_string(Tags), 'StreamInspection')].{Id:VpcEndpointId,Service:ServiceName,State:State}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$vpc_endpoints" ] && [ "$vpc_endpoints" != "None" ]; then
        log_warning "VPC Endpoints still exist:"
        echo "$vpc_endpoints" | while read -r line; do
            log_info "  VPC Endpoint: $line"
        done
    else
        log_ok "No VPC Endpoints remaining"
    fi
    
    # Check Security Groups
    local security_groups=$(aws ec2 describe-security-groups \
        --region "$REGION" \
        --query "SecurityGroups[?contains(to_string(Tags), 'StreamInspection') && GroupName!='default'].{Id:GroupId,Name:GroupName}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$security_groups" ] && [ "$security_groups" != "None" ]; then
        log_warning "Security Groups still exist:"
        echo "$security_groups" | while read -r line; do
            log_info "  Security Group: $line"
        done
    else
        log_ok "No custom Security Groups remaining"
    fi
}

# Function to check CloudWatch resources
check_cloudwatch_resources() {
    echo -e "${BLUE}Checking CloudWatch resources...${NC}"
    
    local log_groups=$(aws logs describe-log-groups \
        --region "$REGION" \
        --query "logGroups[?contains(logGroupName, 'StreamInspection') || contains(logGroupName, 'stream-inspection') || contains(logGroupName, '/aws/lambda/StreamInspection') || contains(logGroupName, '/aws/mediaconnect/') || contains(logGroupName, '/aws/medialive/')].{Name:logGroupName,Size:storedBytes}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$log_groups" ] && [ "$log_groups" != "None" ]; then
        log_warning "CloudWatch log groups still exist:"
        echo "$log_groups" | while read -r line; do
            log_info "  Log Group: $line"
        done
    else
        log_ok "No CloudWatch log groups remaining"
    fi
}

# Function to check S3 resources
check_s3_resources() {
    echo -e "${BLUE}Checking S3 resources...${NC}"
    
    local buckets=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, 'streaminspection') || contains(Name, 'stream-inspection') || contains(Name, 'gwlb-access-logs')].{Name:Name,Created:CreationDate}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$buckets" ] && [ "$buckets" != "None" ]; then
        log_warning "S3 buckets still exist:"
        echo "$buckets" | while read -r line; do
            log_info "  Bucket: $line"
            # Check if bucket has objects
            local bucket_name=$(echo "$line" | awk '{print $1}')
            local object_count=$(aws s3api list-objects-v2 --bucket "$bucket_name" --query 'KeyCount' --output text 2>/dev/null || echo "0")
            if [ "$object_count" != "0" ]; then
                log_info "    Objects in bucket: $object_count"
            fi
        done
    else
        log_ok "No S3 buckets remaining"
    fi
}

# Function to check Lambda resources
check_lambda_resources() {
    echo -e "${BLUE}Checking Lambda resources...${NC}"
    
    local functions=$(aws lambda list-functions \
        --region "$REGION" \
        --query "Functions[?contains(to_string(Tags), 'StreamInspection') || contains(FunctionName, 'StreamInspection')].{Name:FunctionName,Runtime:Runtime,Size:CodeSize}" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$functions" ] && [ "$functions" != "None" ]; then
        log_warning "Lambda functions still exist:"
        echo "$functions" | while read -r line; do
            log_info "  Function: $line"
        done
    else
        log_ok "No Lambda functions remaining"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --verbose          Show detailed information about found resources"
    echo "  --stack-name NAME  Specify stack name (default: StreamInspectionBlogStack)"
    echo "  --region REGION    Specify AWS region (default: from AWS config)"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  STACK_NAME         Stack name to verify"
    echo "  AWS_DEFAULT_REGION AWS region"
    echo "  VERBOSE           Set to 'true' for verbose output"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE="true"
            shift
            ;;
        --stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main verification process
main() {
    echo -e "${BLUE}🚀 Starting comprehensive cleanup verification...${NC}"
    echo ""
    
    check_cloudformation_stacks
    check_mediaconnect_resources
    check_medialive_resources
    check_mediapackage_resources
    check_ec2_resources
    check_load_balancer_resources
    check_vpc_resources
    check_lambda_resources
    check_cloudwatch_resources
    check_s3_resources
    
    echo ""
    echo -e "${BLUE}📊 Verification Summary:${NC}"
    echo -e "${CYAN}   Resources checked: $RESOURCES_CHECKED${NC}"
    
    if [ $ISSUES_FOUND -eq 0 ]; then
        echo -e "${GREEN}✅ Cleanup verification completed successfully${NC}"
        echo -e "${GREEN}🎉 All resources appear to be cleaned up${NC}"
        echo -e "${GREEN}💰 No resources found that should incur charges${NC}"
    else
        echo -e "${YELLOW}⚠️  Cleanup verification found $ISSUES_FOUND potential issues${NC}"
        echo -e "${YELLOW}💡 Consider running 'npm run cleanup:residual' to clean up remaining resources${NC}"
        echo -e "${YELLOW}💰 Some resources may continue to incur charges${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📊 Next Steps:${NC}"
    if [ $ISSUES_FOUND -gt 0 ]; then
        echo -e "${CYAN}   1. Run 'npm run cleanup:residual' to clean up remaining resources${NC}"
        echo -e "${CYAN}   2. Re-run this verification script to confirm cleanup${NC}"
        echo -e "${CYAN}   3. Monitor your AWS billing dashboard${NC}"
    else
        echo -e "${CYAN}   1. Monitor your AWS billing dashboard for any unexpected charges${NC}"
        echo -e "${CYAN}   2. Check AWS Cost Explorer for historical usage${NC}"
    fi
    
    # Exit with error code if issues found
    exit $ISSUES_FOUND
}

# Run main function
main "$@"
