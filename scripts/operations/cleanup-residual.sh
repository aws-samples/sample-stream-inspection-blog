#!/bin/bash

# cleanup-residual.sh - Clean up residual AWS resources after CDK stack destruction
# This script removes resources that may not be automatically cleaned up by CDK destroy

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
DRY_RUN="${DRY_RUN:-false}"

echo -e "${BLUE}🧹 Stream Inspection Stack - Residual Resource Cleanup${NC}"
echo -e "${BLUE}📍 Stack: ${STACK_NAME}${NC}"
echo -e "${BLUE}📍 Region: ${REGION}${NC}"
if [ "$DRY_RUN" = "true" ]; then
    echo -e "${CYAN}📍 Mode: DRY RUN (no resources will be deleted)${NC}"
fi
echo ""

# Function to log actions
log_action() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

log_error() {
    echo -e "${RED}❌${NC} $1"
}

log_info() {
    echo -e "${CYAN}ℹ️${NC} $1"
}

# Function to execute command with dry run support
execute_command() {
    local cmd="$1"
    local description="$2"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would execute: $cmd"
        return 0
    else
        if eval "$cmd" 2>/dev/null; then
            log_action "$description"
            return 0
        else
            log_error "Failed: $description"
            return 1
        fi
    fi
}

# Function to clean up MediaConnect flows
cleanup_mediaconnect_flows() {
    echo -e "${BLUE}Cleaning up MediaConnect flows...${NC}"
    
    local flows=$(aws mediaconnect list-flows \
        --region "$REGION" \
        --query "Flows[?contains(Name, 'StreamInspection') || contains(Name, 'LiveStream') || contains(Name, 'stream-inspection')].FlowArn" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$flows" ] && [ "$flows" != "None" ]; then
        for flow_arn in $flows; do
            # Stop flow first if running
            execute_command "aws mediaconnect stop-flow --flow-arn '$flow_arn' --region '$REGION'" \
                "Stopped MediaConnect flow: $(basename $flow_arn)"
            sleep 2
            # Delete flow
            execute_command "aws mediaconnect delete-flow --flow-arn '$flow_arn' --region '$REGION'" \
                "Deleted MediaConnect flow: $(basename $flow_arn)"
        done
    else
        log_action "No MediaConnect flows found"
    fi
}

# Function to clean up MediaLive resources
cleanup_medialive_resources() {
    echo -e "${BLUE}Cleaning up MediaLive resources...${NC}"
    
    # Clean up channels first
    local channels=$(aws medialive list-channels \
        --region "$REGION" \
        --query "Channels[?contains(to_string(Tags), 'StreamInspection') || contains(Name, 'StreamInspection')].Id" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$channels" ] && [ "$channels" != "None" ]; then
        for channel_id in $channels; do
            # Stop channel first if running
            execute_command "aws medialive stop-channel --channel-id '$channel_id' --region '$REGION'" \
                "Stopped MediaLive channel: $channel_id"
            sleep 5
            # Delete channel
            execute_command "aws medialive delete-channel --channel-id '$channel_id' --region '$REGION'" \
                "Deleted MediaLive channel: $channel_id"
        done
    else
        log_action "No MediaLive channels found"
    fi
    
    # Clean up inputs
    local inputs=$(aws medialive list-inputs \
        --region "$REGION" \
        --query "Inputs[?contains(to_string(Tags), 'StreamInspection') || contains(Name, 'StreamInspection')].Id" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$inputs" ] && [ "$inputs" != "None" ]; then
        for input_id in $inputs; do
            execute_command "aws medialive delete-input --input-id '$input_id' --region '$REGION'" \
                "Deleted MediaLive input: $input_id"
        done
    else
        log_action "No MediaLive inputs found"
    fi
}

# Function to clean up MediaPackage resources
cleanup_mediapackage_resources() {
    echo -e "${BLUE}Cleaning up MediaPackage resources...${NC}"
    
    # Clean up origin endpoints
    local endpoints=$(aws mediapackage list-origin-endpoints \
        --region "$REGION" \
        --query "OriginEndpoints[?contains(Id, 'StreamInspection') || contains(Id, 'stream-inspection')].Id" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$endpoints" ] && [ "$endpoints" != "None" ]; then
        for endpoint_id in $endpoints; do
            execute_command "aws mediapackage delete-origin-endpoint --id '$endpoint_id' --region '$REGION'" \
                "Deleted MediaPackage origin endpoint: $endpoint_id"
        done
    else
        log_action "No MediaPackage origin endpoints found"
    fi
    
    # Clean up channels
    local channels=$(aws mediapackage list-channels \
        --region "$REGION" \
        --query "Channels[?contains(Id, 'StreamInspection') || contains(Id, 'stream-inspection')].Id" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$channels" ] && [ "$channels" != "None" ]; then
        for channel_id in $channels; do
            execute_command "aws mediapackage delete-channel --id '$channel_id' --region '$REGION'" \
                "Deleted MediaPackage channel: $channel_id"
        done
    else
        log_action "No MediaPackage channels found"
    fi
}

# Function to clean up CloudWatch log groups
cleanup_log_groups() {
    echo -e "${BLUE}Cleaning up CloudWatch log groups...${NC}"
    
    local log_groups=$(aws logs describe-log-groups \
        --region "$REGION" \
        --query "logGroups[?contains(logGroupName, 'StreamInspection') || contains(logGroupName, 'stream-inspection') || contains(logGroupName, '/aws/lambda/StreamInspection') || contains(logGroupName, '/aws/mediaconnect/') || contains(logGroupName, '/aws/medialive/')].logGroupName" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$log_groups" ] && [ "$log_groups" != "None" ]; then
        for log_group in $log_groups; do
            execute_command "aws logs delete-log-group --log-group-name '$log_group' --region '$REGION'" \
                "Deleted log group: $log_group"
        done
    else
        log_action "No orphaned log groups found"
    fi
}

# Function to clean up S3 buckets
cleanup_s3_buckets() {
    echo -e "${BLUE}Cleaning up S3 buckets...${NC}"
    
    local buckets=$(aws s3api list-buckets \
        --query "Buckets[?contains(Name, 'streaminspection') || contains(Name, 'stream-inspection') || contains(Name, 'gwlb-access-logs')].Name" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$buckets" ] && [ "$buckets" != "None" ]; then
        for bucket in $buckets; do
            # Empty bucket first
            execute_command "aws s3 rm 's3://$bucket' --recursive --region '$REGION'" \
                "Emptied bucket: $bucket"
            # Delete bucket
            execute_command "aws s3api delete-bucket --bucket '$bucket' --region '$REGION'" \
                "Deleted bucket: $bucket"
        done
    else
        log_action "No orphaned S3 buckets found"
    fi
}

# Function to clean up Load Balancers
cleanup_load_balancers() {
    echo -e "${BLUE}Cleaning up Load Balancers...${NC}"
    
    # Gateway Load Balancers
    local gwlbs=$(aws elbv2 describe-load-balancers \
        --region "$REGION" \
        --query "LoadBalancers[?Type=='gateway' && contains(to_string(Tags), 'StreamInspection')].LoadBalancerArn" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$gwlbs" ] && [ "$gwlbs" != "None" ]; then
        for gwlb_arn in $gwlbs; do
            execute_command "aws elbv2 delete-load-balancer --load-balancer-arn '$gwlb_arn' --region '$REGION'" \
                "Deleted Gateway Load Balancer: $(basename $gwlb_arn)"
        done
    else
        log_action "No Gateway Load Balancers found"
    fi
    
    # Target Groups
    local target_groups=$(aws elbv2 describe-target-groups \
        --region "$REGION" \
        --query "TargetGroups[?contains(to_string(Tags), 'StreamInspection')].TargetGroupArn" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$target_groups" ] && [ "$target_groups" != "None" ]; then
        for tg_arn in $target_groups; do
            execute_command "aws elbv2 delete-target-group --target-group-arn '$tg_arn' --region '$REGION'" \
                "Deleted target group: $(basename $tg_arn)"
        done
    else
        log_action "No target groups found"
    fi
}

# Function to clean up Auto Scaling Groups
cleanup_auto_scaling_groups() {
    echo -e "${BLUE}Cleaning up Auto Scaling Groups...${NC}"
    
    local asgs=$(aws autoscaling describe-auto-scaling-groups \
        --region "$REGION" \
        --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'StreamInspection') || contains(AutoScalingGroupName, 'SecurityAppliances')].AutoScalingGroupName" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$asgs" ] && [ "$asgs" != "None" ]; then
        for asg_name in $asgs; do
            # Scale down to 0 first
            execute_command "aws autoscaling update-auto-scaling-group --auto-scaling-group-name '$asg_name' --desired-capacity 0 --min-size 0 --region '$REGION'" \
                "Scaled down ASG: $asg_name"
            sleep 10
            # Delete ASG
            execute_command "aws autoscaling delete-auto-scaling-group --auto-scaling-group-name '$asg_name' --force-delete --region '$REGION'" \
                "Deleted Auto Scaling Group: $asg_name"
        done
    else
        log_action "No Auto Scaling Groups found"
    fi
}

# Function to clean up Launch Templates
cleanup_launch_templates() {
    echo -e "${BLUE}Cleaning up Launch Templates...${NC}"
    
    local templates=$(aws ec2 describe-launch-templates \
        --region "$REGION" \
        --query "LaunchTemplates[?contains(to_string(Tags), 'StreamInspection')].LaunchTemplateId" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$templates" ] && [ "$templates" != "None" ]; then
        for template_id in $templates; do
            execute_command "aws ec2 delete-launch-template --launch-template-id '$template_id' --region '$REGION'" \
                "Deleted launch template: $template_id"
        done
    else
        log_action "No launch templates found"
    fi
}

# Function to clean up VPC endpoints
cleanup_vpc_endpoints() {
    echo -e "${BLUE}Cleaning up VPC endpoints...${NC}"
    
    local vpc_endpoints=$(aws ec2 describe-vpc-endpoints \
        --region "$REGION" \
        --query "VpcEndpoints[?contains(to_string(Tags), 'StreamInspection')].VpcEndpointId" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$vpc_endpoints" ] && [ "$vpc_endpoints" != "None" ]; then
        for endpoint in $vpc_endpoints; do
            execute_command "aws ec2 delete-vpc-endpoint --vpc-endpoint-id '$endpoint' --region '$REGION'" \
                "Deleted VPC endpoint: $endpoint"
        done
    else
        log_action "No orphaned VPC endpoints found"
    fi
}

# Function to clean up Security Groups
cleanup_security_groups() {
    echo -e "${BLUE}Cleaning up Security Groups...${NC}"
    
    local security_groups=$(aws ec2 describe-security-groups \
        --region "$REGION" \
        --query "SecurityGroups[?contains(to_string(Tags), 'StreamInspection') && GroupName!='default'].GroupId" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$security_groups" ] && [ "$security_groups" != "None" ]; then
        for sg_id in $security_groups; do
            execute_command "aws ec2 delete-security-group --group-id '$sg_id' --region '$REGION'" \
                "Deleted security group: $sg_id"
        done
    else
        log_action "No orphaned security groups found"
    fi
}

# Function to clean up Key Pairs
cleanup_key_pairs() {
    echo -e "${BLUE}Cleaning up Key Pairs...${NC}"
    
    local key_pairs=$(aws ec2 describe-key-pairs \
        --region "$REGION" \
        --query "KeyPairs[?contains(to_string(Tags), 'StreamInspection')].KeyName" \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$key_pairs" ] && [ "$key_pairs" != "None" ]; then
        for key_name in $key_pairs; do
            execute_command "aws ec2 delete-key-pair --key-name '$key_name' --region '$REGION'" \
                "Deleted key pair: $key_name"
        done
    else
        log_action "No orphaned key pairs found"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --dry-run          Show what would be deleted without actually deleting"
    echo "  --stack-name NAME  Specify stack name (default: StreamInspectionBlogStack)"
    echo "  --region REGION    Specify AWS region (default: from AWS config)"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  STACK_NAME         Stack name to clean up"
    echo "  AWS_DEFAULT_REGION AWS region"
    echo "  DRY_RUN           Set to 'true' for dry run mode"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="true"
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

# Main cleanup process
main() {
    if [ "$DRY_RUN" != "true" ]; then
        echo -e "${YELLOW}⚠️  This will permanently delete AWS resources that may incur charges${NC}"
        echo -e "${YELLOW}⚠️  Make sure you have stopped all streaming resources first${NC}"
        echo ""
        
        read -p "Continue with cleanup? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cleanup cancelled"
            exit 0
        fi
    fi
    
    echo -e "${BLUE}🚀 Starting residual resource cleanup...${NC}"
    echo ""
    
    # Clean up in dependency order
    cleanup_mediaconnect_flows
    cleanup_medialive_resources
    cleanup_mediapackage_resources
    cleanup_auto_scaling_groups
    cleanup_launch_templates
    cleanup_load_balancers
    cleanup_security_groups
    cleanup_key_pairs
    cleanup_vpc_endpoints
    cleanup_log_groups
    cleanup_s3_buckets
    
    echo ""
    if [ "$DRY_RUN" = "true" ]; then
        echo -e "${CYAN}🔍 Dry run completed - no resources were actually deleted${NC}"
        echo -e "${BLUE}💡 Run without --dry-run to perform actual cleanup${NC}"
    else
        echo -e "${GREEN}✅ Residual resource cleanup completed${NC}"
        echo -e "${BLUE}💡 Run 'npm run cleanup:verify' to verify cleanup${NC}"
        echo -e "${BLUE}📊 Monitor your AWS billing dashboard for any remaining charges${NC}"
    fi
}

# Run main function
main "$@"
