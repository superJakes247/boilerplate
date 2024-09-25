#!/bin/bash

GREEN="\033[0;32m"

cp ~/tester-vm-setup-ubuntu-main/files/.bashrc $HOME
echo -e "${GREEN}Bash Aliases added \n ==================\n"

#vscode extensions
code --install-extension dzhavat.bracket-pair-toggler
code --install-extension ms-azuretools.vscode-docker
code --install-extension IronGeek.vscode-env
code --install-extension usernamehw.errorlens
code --install-extension dbaeumer.vscode-eslint
code --install-extension oliversturm.fix-json
code --install-extension eamodio.gitlens
code --install-extension rangav.vscode-thunder-client
code --install-extension scala-lang.scala
code --install-extension golang.go
code --install-extension GitLab.gitlab-workflow
echo -e "${GREEN}VSCode Extensions Installed \n ==================\n"

mkdir -p  $HOME/.config/Code/User/
cp ~/tester-vm-setup-ubuntu-main/files/settings.json $HOME/.config/Code/User/
echo -e "${GREEN}VSCode Settings added \n ==================\n"

#kubectl
mkdir -p ~/.kube && touch ~/.kube/config
sudo snap install kubectl --classic
kubectl version --client
echo -e "${GREEN}kubectl Installed \n ==================\n"

#set docker permissions
sudo chmod 666 /var/run/docker.sock
sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker

