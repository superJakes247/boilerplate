/* eslint-disable no-console */
// import CryptoJS from 'crypto-js';
const CryptoJS = require('crypto-js');

if (process.argv.length !== 5) {
  console.log('Please provide all options in the command \n encrypt/decrypt value encryptionKey');
} else if (process.argv[2] === 'encrypt') {
  const unencryptedString = process.argv[3];
  const encrypted = CryptoJS.AES.encrypt(unencryptedString, process.argv[4]).toString();
  console.log(encrypted);
} else if (process.argv[2] === 'decrypt') {
  const encryptedString = process.argv[3];
  const decrypted = CryptoJS.AES.decrypt(encryptedString, process.argv[4]).toString(CryptoJS.enc.Utf8);
  console.log(decrypted);
} else {
  console.log('Command not structured properly \n specify:  "encrypt/decrypt value encryptionKey"');
}
