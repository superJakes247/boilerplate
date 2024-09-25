/* eslint-disable no-param-reassign */
const axios = require('axios').default;
const https = require('https');
const fs = require('fs-extra');
const { format, subMilliseconds } = require('date-fns');
const {
  apiName, chalk,
} = require('./_common');

let testingEnvUrl;
if (process.env.TEST_ENV) {
  testingEnvUrl = `https://api.${process.env.TEST_ENV}.gray.net`;
}
let baseURL = process.env.TEST_ENV_URL || testingEnvUrl;

if (process.env.CI_COMMIT_REF_NAME) {
  baseURL = baseURL.replace(':3000', ':80');
}

if (baseURL === undefined) {
  throw new Error(chalk.redBright(
    'MISSING ENVIRONMENT VARIABLE:',
    chalk.red(
      '\nPlease specify either a full',
      chalk.yellowBright('TEST_ENV_URL'),
      chalk.gray('eg. TEST_ENV_URL=http://api-test:3000'),
      'OR',
      chalk.yellowBright('TEST_ENV'),
      chalk.gray('eg. TEST_ENV=dev'),
    ),
  ));
}

const request = axios.create({
  baseURL,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  validateStatus: (status) => status > 0,
});

request.interceptors.request.use((x) => {
  x.meta = x.meta || {};
  x.meta.beginTimer = new Date().getTime();

  request.endpoint = { method: x.method.toUpperCase(), path: x.url, queryStringParameters: x?.params };
  return x;
});

request.interceptors.response.use((x) => {
  if (!fs.existsSync(`./generated/${apiName}/request.log.json`)) {
    fs.outputFileSync(`./generated/${apiName}/request.log.json`, '');
  }
  fs.appendFileSync(
    `./generated/${apiName}/request.log.json`,
    `${JSON.stringify({
      url: x.config.url,
      method: x.config.method.toUpperCase(),
      timestamp: new Date().toISOString(),
    }, null, 2)}|`,
    { mode: 0o777 },
  );

  if (process.env.DRAW_SEQ_DIAGRAM !== 'false' && typeof process.env.DRAW_SEQ_DIAGRAM !== 'undefined') {
    fs.outputFileSync(
      `./generated/${apiName}/sequence/${process.env.DRAW_SEQ_DIAGRAM}/request.log.json`,
      `${JSON.stringify({
        path: x.config.url,
        method: x.config.method.toUpperCase(),
        from: 'endpoint',
        to: apiName,
        timestamp: format(subMilliseconds(new Date(), 200), 'yyyy-mm-dd HH:mm:ss.SSS'),
      }, null, 2)}`,
    );
  }
  x.responseTime = new Date().getTime() - x.config.meta.beginTimer;
  return x;
});

request.defaults.headers.common['X-Source-System'] = 'testing';

module.exports = request;
