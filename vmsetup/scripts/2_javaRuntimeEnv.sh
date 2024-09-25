#!/bin/bash

GREEN="\033[0;32m"

# installing JRE installs the KEYTOOL app that is required to install the SSL certificates
sudo apt-get update -y
sudo apt-get install default-jre -y

echo -e "${GREEN}JRE Installed \n ==================\n"
