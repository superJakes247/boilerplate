#!/bin/bash
echo Enter first name
read FN

echo Enter last name
read LN

echo Enter email
read EMAIL

git config --global user.name "$FN $LN"
git config --global user.email "$EMAIL"

ssh-keygen -f ~/.ssh/id_rsa -t rsa -N ""

echo [SSH Public Key]
echo [ -- Paste the following public key into Gitlab -- ]
echo
cat ~/.ssh/id_rsa.pub
echo
