#!/bin/bash

GREEN="\033[0;32m"

# Setup the DNS server configuration for Allan Gray

sudo cat > /etc/resolv.conf << EOL
# Dynamic resolv.conf(5) file for glibc resolver(3) generated by resolvconf(8)
#     DO NOT EDIT THIS FILE BY HAND -- YOUR CHANGES WILL BE OVERWRITTEN
nameserver 10.10.56.2
nameserver 10.10.56.3
nameserver 10.10.56.4

search gray.net
EOL

echo -e "${GREEN}DNS Setup \n ==================\n"