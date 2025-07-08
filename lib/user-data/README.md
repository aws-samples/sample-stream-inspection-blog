# Security Appliance User Data Scripts

Simple user data scripts for configuring security appliance instances.

## Files

- `setup.sh` - Main setup script that configures the security appliance
- `install-suricata.sh` - Optional Suricata IDS installation script  
- `suricata.yaml` - Basic Suricata configuration file

## What setup.sh does

1. **System Setup**
   - Updates packages
   - Installs required tools (iptables, jq, CloudWatch agent)
   - Enables IP forwarding

2. **Network Configuration**
   - Configures iptables for traffic forwarding
   - Sets up NAT rules for Gateway Load Balancer
   - Disables source/destination checks

3. **Health Check**
   - Creates simple HTTP health server on port 80
   - Returns JSON health status for load balancer checks

4. **Monitoring**
   - Configures CloudWatch agent for log collection
   - Sends setup logs to CloudWatch

5. **Optional Suricata**
   - Can install Suricata IDS if third parameter is "true"
   - Compiles from source with GENEVE support

## Usage

The setup script is called automatically by the CDK user data:
```bash
./setup.sh <VPC_ID> <STACK_NAME> <INSTALL_SURICATA>
```

- `VPC_ID` - VPC ID for finding Gateway Load Balancer IPs
- `STACK_NAME` - CloudFormation stack name for logging
- `INSTALL_SURICATA` - "true" to install Suricata, "false" to skip

## Health Check

The health server provides a simple endpoint:
- `GET /health` - Returns `{"healthy": true, "service": "security-appliance"}`

This is used by the Gateway Load Balancer for health checks.
