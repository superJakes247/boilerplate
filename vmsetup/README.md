# tester-vm-setup-ubuntu

This setup works best when doing it on premises. We've noticed issues when setting up a VM remotely
## Step 1 (Download Virtualbox)

Install Oracle Virtual Box on your windows machine: [virtualbox website](https://www.virtualbox.org/wiki/Downloads)

## Step 2 (Download 22.04 Jammy Jellyfish ISO)

Download the Desktop ISO: [22-04 Jammy Jellyfish](https://xubuntu.org/download/)

Navigate to the 22.04 Jammy Jellyfish section, click United Kingdom, and download the file with extension `.iso`

## Step 3 (Create Virtual Machine)
Open Virtual Box and create a new virtual machine:
```bash
Name: anything you like eg. matthewja-vm
Type: Linux
Version: Ubuntu 64 bit
Memory: 18000MB
Hard disk: Create virtual hard disk now, VDI, dynamically allocated, 100GB

Once created click settings to make additional changes
General: Set 'bidirectional' for Shared Clipboard and Drag'n'Drop
System: Deselect the Floppy drive, Select 4 CPUs
Display: Select 128MB of video memory
Storage: Under Controller: IDE, select 'empty' and mount (click blue disk) the ISO you downloaded in step 2
Shared Folders: First add a new folder on your windows machine C Drive and call it 'Share'. Then add this newly created folder as the shared folder on the VM Select the 'Auto-mount' option.
```
## Step 4 (Install Operating System)
Start the machine and install the operating system by following the install wizard with these options:
- Install Xubuntu
- English (US)
- Minimal installation
- Download updates while installing Xubuntu
- Erase disk and install Xubuntu.

Use all other defaults
- Use `username-vm` for computer's name. eg `matthewja-vm`
- Use your AG username for the user eg. `matthewja`
- Choose a password
- Click continue
- Once installed, close the VM and restart it
## Step 5 (Install Guest Additions)

***see troubleshooting below if you cant run sudo commands yet
```bash
sudo apt update
sudo apt install -y build-essential linux-headers-$(uname -r)
sudo mount /dev/cdrom /media
cd /media
sudo ./VBoxLinuxAdditions.run
sudo adduser $USER vboxsf
sudo reboot
```
Alternative, follow the instructions here: [Xubuntu Guest Additions](https://www.itzgeek.com/post/how-to-install-virtualbox-guest-additions-on-ubuntu-20-04/)

Reboot and maximise the window, you should have full screen mode.
Open file explorer and you should have access to the shared folder you created in step 3
# Step 6 (Run shell scripts)
This step involves running the shell scripts that are located [here](https://gitlab.gray.net/retail/testing/tester-vm-setup-ubuntu/-/tree/main/scripts) in the VM. In order to do that we need to get the scripts into the VM. You can do that in a variety of ways, and I've used this way previously:

1. In your VM open Firefox and navigate [here](https://gitlab.gray.net/retail/testing/tester-vm-setup-ubuntu)
2. Download the repo using .zip. That should result in the repo being downloaded into your VMs `Downloads` folder

![Zip](/files/zip%20pic.PNG)

3. Open a new terminal and **copy and paste** the following commands one by one (your clipboard should be bi-directional now):
```bash
sudo apt install unzip
cd ~/Downloads
unzip tester-vm-setup-ubuntu-main.zip -d ~
cd ~/tester-vm-setup-ubuntu-main
```
4. Run each shell script:
```bash
cd ~/tester-vm-setup-ubuntu-main/scripts
sudo ./1_dns.sh
sudo ./2_javaRuntimeEnv.sh
sudo ./3_certificates.sh
sudo ./4_software.sh
./5_configureSSH.sh
./6_extras.sh
./7_aws.sh
```

Alternatively, run the auto setup script with:
```bash
cd ~/tester-vm-setup-ubuntu-main
sudo ./testerAutoSetup.sh
./scripts/5_configureSSH.sh
./scripts/6_extras.sh
```
Follow all prompts and copy the SSH key generated which you will add to Gitlab

# TROUBLESHOOTING
- docker permissions issue: 
```bash
sudo chmod 666 /var/run/docker.sock
```
- x509 error: 
```bash
sudo service docker restart
```
- hostname issue: 
```bash
ensure host name on `/etc/hosts` and `/etc/hostnames` are the same
```
- If your user doesnt have root permissions:
```bash
sudo su
usermod -aG sudo $USER
exit
sudo reboot
```
- SSL issues: Error while fetching extensions. XHR failed
```bash
https://stackoverflowteams.com/c/allangray/questions/333/336#336
```

- Guest additions not working/ full screen mode not working
```bash
Try "half minimising" the window and then maximising it again
VERR_PDM_MEDIA_LOCKED issue: VirtualBox Menu > Devices > Optical Drives > Remove disk from virtual drive
```

- User not on sudoers file (user cannot use SUDO)

Update the /etc/sudoers file to allow your user to use SUDO
```bash
su root 
nano /etc/sudoers
```
edit the file, add your user below the root users permissions
```bash
matthewja ALL=(ALL)  ALL
```

- Error while installing extensions: self signed certificate in certificate chain self signed certificate in certificate chain
```
File > Preferences > Settings
Search for Proxy
Uncheck the Http: Proxy Strict SSL option
```

- curl: (35) error:0A000152:SSL routines::unsafe legacy renegotiation disabled: 
[resolution](https://stackoverflow.com/questions/75763525/curl-35-error0a000152ssl-routinesunsafe-legacy-renegotiation-disabled)
```
sudo nano /etc/ssl/openssl.cnf
Add the below config to the file at [system_default_sect]
Options = UnsafeLegacyRenegotiation
```

- unhealthy Rabbit MQ containers:
```
We noticed an issue where the Docker healtheck consistently fails, even though in reality the WGET or CURL command passes. 
The issue is with the version of Docker being used (in conjunction with the docker-compose version)
To resolve this you need to downgrade your Docker version to 25 or lower. The install scripts in this repo have already been updated [here](https://gitlab.gray.net/retail/testing/tester-vm-setup-ubuntu/-/blob/main/scripts/4_software.sh?ref_type=heads#L64)
which forces the compatible version to be installed. 
```