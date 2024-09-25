const chalk = require('chalk');
const CryptoJS = require('crypto-js');
const util = require('util');

const debugLog = util.debuglog('debug');

const secretKey = 'U2FsdGVkX18zKSOTOPSb6t1Ly848bBRq/EAKDG2rJXE=';
const getBytes = (hash) => CryptoJS.AES.decrypt(hash, secretKey);
const decrypt = (hash) => getBytes(hash).toString(CryptoJS.enc.Utf8);

const testEnv = process.env.TEST_ENV;
const dataEnv = process.env.TEST_DATA_ENV;

let env;
if (dataEnv === undefined && testEnv === undefined) {
  debugLog(chalk.whiteBright.bgYellow.bold('No "TEST_DATA_ENV" or "TEST_ENV" defined, defaulting to "dev"'));
  env = 'dev';
} else if (dataEnv === undefined) {
  debugLog(chalk.whiteBright.bgYellow.bold(`No "TEST_DATA_ENV" defined using "TEST_ENV=${testEnv}"`));
  env = testEnv;
} else {
  env = dataEnv;
}

debugLog(chalk.whiteBright.bgCyan.bold(`##### Running in environment: ${env} ####`));

const envAuth = {
  dev: {
    username: 'TestAutomationRead',
    password: decrypt('U2FsdGVkX1+k2/lwPXV0ZAYuvVHB7Yqsh6Njm1KpvRY='),
  },
  int: {
    username: 'TestAutomationRead',
    password: decrypt('U2FsdGVkX19DNX1SwGsBpJ/aKX5uNgWIilVhH/UY7x4='),
  },
  uat: {
    username: 'TestAutomationRead',
    password: decrypt('U2FsdGVkX1/GngCjUJSUnViDKNrOWu7pIelpKQ4JCUs='),
  },
};

const microServicesDBInstance = {
  dev: 'sql-micro-services.dev.matt.net',
  int: 'sql-micro-services.int.matt.net',
  uat: 'sql-micro-services.uat.matt.net',
};

const genesysDBInstance = {
  dev: 'sql-genesys.dev.matt.net',
  uat: 'sql-genesys.uat.matt.net',
};

const dbs = {
  stagingRetailDWH: {
    dev: 'sql-mart.dev.matt.net', // staging only exists on mart primary
    int: 'sql-mart.int.matt.net',
    uat: 'sql-mart.uat.matt.net',
    database: 'StagingRetailDWH',
  },
  mart: {
    dev: 'sql-mart-sec.dev.matt.net', // stay on sec as per api-mart-proxy
    int: 'sql-mart-sec.int.matt.net', // stay on sec as per api-mart-proxy
    uat: 'sql-mart.uat.matt.net',
    database: 'StatementRetailDWH',
  },
  martPrimary: {
    dev: 'sql-mart.dev.matt.net',
    int: 'sql-mart.int.matt.net',
    uat: 'sql-mart.uat.matt.net',
    database: 'StatementRetailDWH',
  },
  martCI: {
    dev: 'db-mart', // local docker DB
    int: 'db-mart', // local docker DB
    uat: 'db-mart', // local docker DB
    database: 'StatementRetailDWH',
    username: 'dbdeploy',
    password: 'l337m4573R',
    port: 1433,
  },
  membershipReboot: {
    ...microServicesDBInstance,
    database: 'MembershipReboot',
  },

  digiata_AG_RE_STP_BR: {
    dev: 'sql-digiata.dev.matt.net',
    int: 'sql-digiata.int.matt.net',
    uat: 'sql-digiata.uat.matt.net',
    database: 'AG_RE_STP_BR',
    username: 'Banking_Writer',
    password: decrypt('U2FsdGVkX1+6oNLwrFaouGVUZO2fKqg18iLOGk+86Rk='),
  },

  siebel: {
    dev: 'sql-siebel.dev.matt.net',
    int: 'sql-siebel.int.matt.net',
    uat: 'sql-siebel.uat.matt.net',
    database: 'siebeldb',
  },

  web: {
    dev: 'sql-siebel.dev.matt.net',
    int: 'sql-siebel.int.matt.net',
    uat: 'sql-siebel.uat.matt.net',
    database: 'web',
  },

  retailODS: {
    ...microServicesDBInstance,
    database: 'RetailODS',
  },
  retailInstructions: {
    ...microServicesDBInstance,
    database: 'RetailInstructions',
  },
  retailInstruments: {
    ...microServicesDBInstance,
    database: 'RetailInstruments',
  },
  retailMicroServices: {
    ...microServicesDBInstance,
    database: 'RetailMicroServices',
  },
  apiModelDelink: {
    ...microServicesDBInstance,
    database: 'api-model-delink',
  },
  apiModelRebalance: {
    ...microServicesDBInstance,
    database: 'api-model-rebalance',
  },
  apiKyc: {
    ...microServicesDBInstance,
    database: 'api-kyc',
  },
  apiAppian: {
    ...microServicesDBInstance,
    database: 'api-appian',
    username: 'api-appian-user',
    password: decrypt('U2FsdGVkX19UwCFYtrMI/OP4KTkPiP4XwlrQRcfiomE='),
  },
  genesys: {
    ...genesysDBInstance,
    database: 'g_ucs',
  },
  product: {
    ...microServicesDBInstance,
    database: 'Product',
  },
};

const config = (dbName, options = {}) => ({
  server: dbs[dbName][env],
  database: dbs[dbName].database,
  user: (dbs[dbName].username) ? dbs[dbName].username : envAuth[env].username,
  password: (dbs[dbName].password) ? dbs[dbName].password : envAuth[env].password,
  port: (dbs[dbName].port) ? dbs[dbName].port : 64495,
  connectionTimeout: 60000,
  requestTimeout: (options.requestTimeout) ? options.requestTimeout : 80000,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

module.exports = {
  dbs,
  env,
  config,
};
