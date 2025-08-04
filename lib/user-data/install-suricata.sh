#!/bin/bash
set -e

echo "Installing Suricata..."

# Install dependencies
amazon-linux-extras install -y epel
yum -y install git automake autoconf libtool gcc libpcap-devel pcre2-devel pcre-devel libyaml-devel file-devel zlib-devel jansson-devel nss-devel libcap-ng-devel libnet-devel tar make libnetfilter_queue-devel lua-devel PyYAML lz4-devel

# Install Rust
curl -ks https://sh.rustup.rs -sSf | sh -s -- --profile minimal --default-toolchain 1.63.0 --no-modify-path -y
export PATH=/root/.cargo/bin:$PATH

# Build libmaxminddb
cd /tmp
rm -rf libmaxminddb
git clone --recursive https://github.com/maxmind/libmaxminddb
cd libmaxminddb
./bootstrap
./configure
make && make install
ldconfig
cp /usr/local/lib/libmaxminddb.so.0 /usr/lib64/

# Download and build Suricata
cd /tmp
curl -ks https://www.openinfosecfoundation.org/download/suricata-7.0.2.tar.gz -o suricata-7.0.2.tar.gz
tar -zxf suricata-7.0.2.tar.gz
cd suricata-7.0.2

./configure --disable-gccmarch-native --prefix=/ --sysconfdir=/etc/ --localstatedir=/var/ --enable-lua --enable-geoip --enable-nfqueue --enable-rust
make -j$(nproc)
make install install-conf

# Create directories and user
useradd --system --no-create-home --shell /bin/false suricata
mkdir -p /var/log/suricata /var/lib/suricata/rules /var/run/suricata /etc/suricata/
chown -R suricata:suricata /var/log/suricata /var/lib/suricata /var/run/suricata /etc/suricata/

# Copy configuration
cp /opt/security-appliance/suricata.yaml /etc/suricata/suricata.yaml
chown suricata:suricata /etc/suricata/suricata.yaml

# Create basic rules
cat > /var/lib/suricata/rules/suricata.rules << 'EOF'
# Basic rules
alert tcp any any -> any any (msg:"TCP traffic"; sid:1000001; rev:1;)
alert udp any any -> any 6081 (msg:"GENEVE traffic"; sid:1000002; rev:1;)
EOF
chown suricata:suricata /var/lib/suricata/rules/suricata.rules

# Create systemd service
cat > /etc/systemd/system/suricata.service << 'EOF'
[Unit]
Description=Suricata IDS
After=network.target

[Service]
Type=simple
User=suricata
Group=suricata
ExecStart=/usr/bin/suricata -c /etc/suricata/suricata.yaml --pidfile /var/run/suricata/suricata.pid -q 0 -v
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Start Suricata
systemctl daemon-reload
systemctl enable suricata
systemctl start suricata

# Cleanup
rm -rf /tmp/suricata-* /tmp/libmaxminddb

echo "Suricata installation completed"
