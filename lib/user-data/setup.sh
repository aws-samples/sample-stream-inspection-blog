#!/bin/bash
set -e

# Simple Security Appliance Setup Script
VPC_ID=$1
STACK_NAME=$2
INSTALL_SURICATA=${3:-false}

# Get instance metadata
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_IP=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/local-ipv4)
INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/placement/region)

echo "Starting security appliance setup..."

# Update system and install packages
yum update -y
yum install -y iptables-services jq amazon-cloudwatch-agent

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# Configure iptables
systemctl enable iptables
systemctl start iptables

# Disable source/destination check
aws ec2 modify-instance-attribute --instance-id $INSTANCE_ID --no-source-dest-check --region $REGION

# Set default policies
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT

# Flush existing rules
iptables -t nat -F
iptables -t mangle -F
iptables -F
iptables -X

# Get primary interface
PRIMARY_INTERFACE=$(ip route | grep default | awk '{print $5}')

# Configure NAT for GWLB traffic
for gwlb_ip in $(aws ec2 describe-network-interfaces --filters Name=vpc-id,Values=$VPC_ID --region $REGION | jq '.NetworkInterfaces[] | select(.InterfaceType=="gateway_load_balancer") |.PrivateIpAddress' -r)
do
  iptables -t nat -A PREROUTING -p udp -s $gwlb_ip -d $INSTANCE_IP -i $PRIMARY_INTERFACE -j DNAT --to-destination $gwlb_ip:6081
  iptables -t nat -A POSTROUTING -p udp --dport 6081 -s $gwlb_ip -d $gwlb_ip -o $PRIMARY_INTERFACE -j MASQUERADE
done

# Allow health check
iptables -A INPUT -p tcp --dport 80 -j ACCEPT

# Save iptables rules
service iptables save

# Install Suricata if requested
if [[ "$INSTALL_SURICATA" == "true" ]]; then
  echo "Installing Suricata..."
  /opt/security-appliance/install-suricata.sh
fi

# Create simple health check server
cat > /opt/health_server.py << 'EOF'
#!/usr/bin/env python3
import http.server
import socketserver
import json

class HealthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"healthy": True, "service": "security-appliance"}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

PORT = 80
with socketserver.TCPServer(("", PORT), HealthHandler) as httpd:
    httpd.serve_forever()
EOF

chmod +x /opt/health_server.py

# Create systemd service for health server
cat > /etc/systemd/system/health-server.service << 'EOF'
[Unit]
Description=Health Check Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/health_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Start health server
systemctl daemon-reload
systemctl enable health-server
systemctl start health-server

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/cloud-init-output.log",
            "log_group_name": "/$STACK_NAME/ec2/security-appliance/setup",
            "log_stream_name": "{instance_id}",
            "timezone": "UTC"
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

echo "Security appliance setup completed"
