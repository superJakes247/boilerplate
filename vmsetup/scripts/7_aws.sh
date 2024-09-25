#!/bin/bash

set -eo pipefail

if [ "$EUID" = 0 ]; then
    echo -e "Error: This script should not be run with sudo/as root.  Exiting...\n"
    exit 1
fi

# Set colours for pretty output
Blue='\033[1;34m'
Green='\033[1;32m'
Red='\033[1;31m'
Yellow='\033[1;33m'
NoColour='\033[0m'

# Download the AWS CLI if it does not already exist
if ! command -v aws &> /dev/null
then
    echo -e "${Yellow}Downloading and installing AWS CLI tool...\n${NoColour}"
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
    unzip -qq /tmp/awscliv2.zip -d /tmp/
    sudo bash /tmp/aws/install
    sudo rm -rf /tmp/aws awscliv2.zip 
    sudo mv /usr/local/bin/aws /usr/bin/aws
fi

aws --version || { echo -e "${Red}Error: AWS CLI is not working correctly. Consider re-installing. Exiting...\n" ; exit 1; }

# Download the docker-credential-ecr-login
echo -e "${Blue}<--Installing the docker-credential-ecr-login helper-->${NoColour}"
sudo curl -o /usr/local/bin/docker-credential-ecr-login https://amazon-ecr-credential-helper-releases.s3.us-east-2.amazonaws.com/0.7.1/linux-amd64/docker-credential-ecr-login
sudo chmod 755 /usr/local/bin/docker-credential-ecr-login
docker-credential-ecr-login -v || { echo -e "${Red}Error: docker-credential-ecr-login helper failed to run. Consider re-installing. Exiting...\n" ; exit 1; }
echo -e "${Green}Success: installed docker-credential-ecr-login helper successfully.${NoColour}"


# Create config necessary for interacting with ECR
echo -e "\n${Blue}<--Creating and populating configuration files and directories-->\n${NoColour}"
mkdir -p $HOME/.docker $HOME/.ecr $HOME/.aws

if [ -e $HOME/.docker/config.json ]
then
    if grep -q "\"credsStore\": \"ecr-login\"" $HOME/.docker/config.json; then
      echo -e "${Yellow}Note: Config for ecr-login already present.\n${NoColour}"
    else
      echo -e "${Yellow}Note: $HOME/.docker/config.json already exists. Prepending {\"credsStore\": \"ecr-login\"} to JSON object.${NoColour}"
      echo -e "{\n\t\"credsStore\": \"ecr-login\",$(tail -c +2 $HOME/.docker/config.json)" > $HOME/.docker/config.json
    fi
else
    echo '{ "credsStore": "ecr-login" }' > $HOME/.docker/config.json
fi
echo -e "${Green}Success: $HOME/.docker/config.json is valid.\n${NoColour}"

echo -e "${Blue}<--Setting config to allow for SSO login and attempting login-->\n${NoColour}"

# Set configuration for pulling from ECR using SSO login
echo "[profile ecr-pull]
sso_start_url = https://agl-aws-sso.awsapps.com/start
sso_region = eu-west-1
sso_account_id = 860638170744
sso_role_name = AG_Ecr_Pull 
region = af-south-1
output = json
" > $HOME/.aws/config

# Set the default AWS_PROFILE to point to ecr-pull -- this allows the credential rotator to ascertain which SSO login profile to use
export AWS_PROFILE="ecr-pull"

EXIT_CODE=0
aws sts get-caller-identity &> /dev/null || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e "${Yellow}Session already exists for SSO.\n${NoColour}" ;
else 
  echo -e "${Yellow}Session has expired or does not exist. Kicking off another SSO login...\n${NoColour}"
  aws sso login
  echo -e "${Green}Success: performed a login via SSO.\n${NoColour}"
fi

# Set environment variables for Docker and ECR credential rotator
declare -a EnvironmentVariables=('AWS_ECR_CACHE_DIR="$HOME/.ecr"' 'DOCKER_CONFIG="$HOME/.docker"' 'AWS_PROFILE="ecr-pull"')
UNIX_RC_FILE=""
if [ -n "$BASH_VERSION" ]; then
  UNIX_RC_FILE="$HOME/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
  UNIX_RC_FILE="$HOME/.zshrc"
else
  echo -e "${RED}Error: Shell is not bash or zsh. Cannot set environment variables in rc file.\n${NoColour}"
fi

if [[ -e $UNIX_RC_FILE ]]; then
  echo -e "${Blue}<--Setting AWS_ECR_CACHE_DIR, DOCKER_CONFIG, and AWS_PROFILE in ${UNIX_RC_FILE}-->${NoColour}\n"
  for ev in ${EnvironmentVariables[@]}; do
    grep "$ev" "$UNIX_RC_FILE" &> /dev/null || { echo "export $ev" >> "$UNIX_RC_FILE"; }
  done
  source "$UNIX_RC_FILE"
fi

echo -e "${Green}Success: set AWS_ECR_CACHE_DIR=$AWS_ECR_CACHE_DIR, DOCKER_CONFIG=$DOCKER_CONFIG, and AWS_PROFILE=$AWS_PROFILE\n${NoColour}"

# Check if credentials loaded correctly
echo -e "${Blue}<--Checking AWS account information-->\n${NoColour}"
aws sts get-caller-identity && { echo -e "${Green}Success: verified account information.\n${NoColour}" ; } || { echo -e "${Yellow}Warning: Request failed to AWS CLI. Make sure your IAM credentials are set-up.\n${NoColour}" ; }

# Check if a docker image can be pulled from ECR
echo -e "${Blue}<--Testing docker pull command on quay/curl/curl image-->\n${NoColour}"

EXIT_CODE=0
docker pull 860638170744.dkr.ecr.af-south-1.amazonaws.com/quay/curl/curl:latest || EXIT_CODE=$?

# Check the exit status of the request
if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e "${Green}Success: Docker pull from ECR was successful.\n${NoColour}"
else
  echo -e "${Red}Failed: Docker pull from ECR was unsuccessful. Ensure you have the correct permissions to access shared-global in AWS.\n${NoColour}"
  exit $EXIT_CODE
fi

# Finished script
echo -e "${Green}<--Finished: Successfully configured AWS/ECR for local development.-->\n${NoColour}"

sudo reboot