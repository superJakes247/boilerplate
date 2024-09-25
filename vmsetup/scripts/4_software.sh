#!/bin/bash

GREEN="\033[0;32m"

#ubuntu
sudo apt update -y
sudo apt upgrade -y
echo -e "${GREEN}Ubuntu Updated \n ==================\n"

#curl
sudo apt install curl -y
echo -e "${GREEN}Curl Installed \n ==================\n"

#git
sudo apt install git -y
echo -e "${GREEN}Git Installed \n ==================\n"

#xclip
sudo apt install xclip
echo -e "${GREEN}Xclip Installed \n ==================\n"

#chromium
sudo apt install chromium-browser
echo -e "${GREEN}Chromium Installed \n ==================\n"

#ci tools
curl "https://theluggage-agct.gray.net/artifactory/generic-development/ci/install.sh" | sudo bash
curl https://theluggage-agct.gray.net/artifactory/generic-development/ag-deploy/install.sh | sudo bash
echo -e "${GREEN}CI Tools Installed \n ==================\n"

#node
curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
sudo apt-get install -y nodejs
echo -e "${GREEN}Node Installed \n ==================\n"

#npm
sudo apt install npm -y
echo -e "${GREEN}NPM Installed \n ==================\n"

#chrome
sudo apt update -y
sudo apt upgrade -y
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
echo -e "${GREEN}Chrome Installed \n ==================\n"

#vscode
sudo apt update && sudo apt upgrade -y
sudo apt install software-properties-common apt-transport-https wget -y
wget -O- https://packages.microsoft.com/keys/microsoft.asc | sudo gpg --dearmor | sudo tee /usr/share/keyrings/vscode.gpg
echo deb [arch=amd64 signed-by=/usr/share/keyrings/vscode.gpg] https://packages.microsoft.com/repos/vscode stable main | sudo tee /etc/apt/sources.list.d/vscode.list
sudo apt update -y
sudo apt install code -y
echo -e "${GREEN}VSCode Installed \n ==================\n"

#docker
# sudo apt update -y
# sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
# curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
# sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable"
# apt-cache policy docker-ce
# sudo apt install docker-ce -y
# sudo usermod -aG docker ${USER}
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
VERSION_STRING=5:25.0.5-1~ubuntu.22.04~jammy
sudo apt-get install docker-ce=$VERSION_STRING docker-ce-cli=$VERSION_STRING containerd.io docker-buildx-plugin docker-compose-plugin
echo -e "${GREEN}Docker Installed \n ==================\n"

#docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose -v
echo -e "${GREEN}Docker Compose Installed \n ==================\n"


# Configure NPM
sudo npm config set -g registry https://theluggage-agct.gray.net/artifactory/api/npm/npm-development
sudo npm config set -g cafile "/etc/ssl/certs/ca-certificates.crt"
sudo chmod 666 /var/run/docker.sock
echo -e "${GREEN}Npm Config Installed \n ==================\n"

# Mousepad
sudo apt install mousepad -y

# Set machine time automatically
sudo apt update
sudo apt install ntp
sudo systemctl status ntp
echo -e "${GREEN}Machine Time set to automatic \n ==================\n"