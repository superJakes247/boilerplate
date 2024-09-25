#!/bin/sh

GREEN="\033[0;32m"

#system
sudo wget -O /usr/local/share/ca-certificates/AllanGrayRootCA.crt --no-check-certificate \
  'https://issuingca1-agct/certsrv/RootCert/rootSHA256.cer'

sudo wget -O /usr/local/share/ca-certificates/AllanGrayIssuingCA1.crt --no-check-certificate \
  'https://issuingca1-agct/certsrv/RootCert/issuingca1SHA256.cer'

sudo wget -O /usr/local/share/ca-certificates/AllanGrayIssuingCA2.crt --no-check-certificate \
  'https://issuingca1-agct/certsrv/RootCert/issuingca2SHA256.cer'

sudo dpkg-reconfigure -p critical ca-certificates
sudo update-ca-certificates

keytool -importcert -alias AllanGrayRootCA.cer     -file /usr/local/share/ca-certificates/AllanGrayRootCA.crt     -storepass changeit -noprompt && \
keytool -importcert -alias AllanGrayIssuingCA1.cer -file /usr/local/share/ca-certificates/AllanGrayIssuingCA1.crt -storepass changeit -noprompt && \
keytool -importcert -alias AllanGrayIssuingCA2.cer -file /usr/local/share/ca-certificates/AllanGrayIssuingCA2.crt -storepass changeit -noprompt

echo -e "${GREEN}Certificates Installed \n ==================\n"
