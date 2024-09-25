/* eslint-disable complexity */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const _ = require('lodash');
const { mockServerClient } = require('mockserver-client');
const fs = require('fs-extra');
const find = require('find');
const shortHash = require('hash-sum');
const { diff } = require('jest-diff');
const { format, parseISO, add } = require('date-fns');
const goApiPathList = require('./goApiPathList.json');
const lintFiles = require('./lint-files');
const fixtureSchema = require('./fixtures-schema.json');
const {
  debugLogger, infoLog, chalk, apiName,
} = require('./_common');

const generateFixtures = (recordedRequestsAndResponses) => {
  const fixturePath = './__acceptance__/fixtures/';
  fs.ensureDirSync(fixturePath);
  fs.chmodSync(fixturePath, 0o777);
  fs.lchownSync(fixturePath, 1000, 1000);
  const testApiImportList = [];
  const testApiMockServerList = [];
  const testImportList = [];
  for (const item of recordedRequestsAndResponses) {
    const fixtureFullPath = fixturePath + item.path;
    fs.ensureDirSync(fixtureFullPath);
    fs.chmodSync(fixtureFullPath, 0o777);
    fs.lchownSync(fixtureFullPath, 1000, 1000);

    const fixtureFileData = {
      api: item.api,
      method: item.method,
      path: item.fullPath,
      queryStringParameters: item.queryStringParameters,
      statusCode: item.statusCode,
      contentType: item.contentType,
      requestBody: item.requestBody,
      body: item.body,
    };

    const jsonFilePath = `${fixtureFullPath}/${item.jsonFileName}`;

    // merge in current schema
    let currentJson = {};
    if (fs.existsSync(jsonFilePath)) {
      currentJson = fs.readJsonSync(jsonFilePath);

      // check for diffs from local json to new download
      const jsonDiff = diff(currentJson, JSON.parse(JSON.stringify(fixtureFileData)));
      if (JSON.stringify(currentJson) !== '{}' && !jsonDiff.includes('Compared values have no visual difference.') && !process.argv.includes('-u')) {
        infoLog(
          jsonFilePath,
          '\n',

          jsonDiff,
          '\n',

          chalk.yellowBright('PLEASE CONFIRM THESE DIFFS ARE EXPECTED'),
        );
        infoLog(chalk.yellowBright('LOCAL FIXTURE DIFFER FROM THOSE GENERATED :'), jsonFilePath, chalk.bgCyan('\nTO VIEW DIFFS use "TEST:ACCPETANCE:DEBUG"'), chalk.bgBlueBright('\nTO UPDATE THE FIXTURE SET SAVE IT AS AND EMPTY OBJECT{} AND RERUN GENERATE'));
      } else if (JSON.stringify(currentJson) === '{}' || process.argv.includes('-u')) {
        fs.writeFileSync(`${fixtureFullPath}/${item.jsonFileName}`, JSON.stringify(fixtureFileData, null, 2), { mode: 0o777 });
        infoLog(chalk.yellowBright('UPDATED'), jsonFilePath);
      }
    } else {
      fs.writeFileSync(`${fixtureFullPath}/${item.jsonFileName}`, JSON.stringify(fixtureFileData, null, 2), { mode: 0o777 });
      infoLog(chalk.green('CREATED FIXTURE:'), `${fixtureFullPath}/${item.jsonFileName}`);
    }

    testApiImportList.push(_.camelCase(item.api));
    testApiMockServerList.push(`'${item.api}'`);
    const fixtureImport = (`${item.path}/${item.jsonFileName.replace('.json', '')}`).split('/').map((fi) => _.camelCase(fi)).join('.');
    testImportList.push(fixtureImport.replace('..', '.'));
  }

  const files = find.fileSync(/\.json$/, fixturePath);
  const indexData = [];

  for (const file of files) {
    const fileArray = file.split('/');
    const fileArr = [...fileArray];

    fileArray.forEach(() => {
      const x = fileArr.pop();
      if (!['__acceptance__', 'fixtures'].includes(x)) {
        const name = _.camelCase(x.replace('.json', ''));
        const defaultImport = (x.includes('.json'))
          ? `export { default as ${name} } from './${x}';`
          : `import * as ${name} from './${x}';\n\nexport { ${name} };\n`;

        const indexFileData = defaultImport;
        const indexFilePath = `${fileArr.join('/')}/index.js`;
        indexData.push(JSON.stringify({ indexFileData, indexFilePath }));
      }
    });
  }

  const uniqImports = [...new Set(indexData)];
  const uniqImportsJson = uniqImports.map((ui) => JSON.parse(ui));
  const groupedImports = _.groupBy(uniqImportsJson, (uij) => uij.indexFilePath);

  for (const [key, value] of Object.entries(groupedImports)) {
    const indexFileDatas = value.map((ifd) => ifd.indexFileData).join('\n');

    const indexDirPath = key.replace('/index.js', '');
    fs.ensureDirSync(indexDirPath);
    fs.chmodSync(indexDirPath, 0o777);
    fs.lchownSync(indexDirPath, 1000, 1000);

    fs.writeFileSync(key, indexFileDatas, { mode: 0o777 });
    infoLog(chalk.green('CREATED/UPDATED FIXTURE INDEX:'), key);
  }

  lintFiles(fixturePath);
  infoLog(chalk.bold.whiteBright.bgYellow('\nCOPY THESE FIXTURE IMPORTS TO YOUR TEST:'), chalk.yellowBright(`
  -------------------------------------------------------------------- \n
  import { ${[...new Set(testApiImportList)]} } from './fixtures';
  -------------------------------------------------------------------- \n

  mockServer = new MockServer([
    ${[...new Set(testApiMockServerList)].join(',')}
  ]);

  await mockServer.loadFixtures([
  ${[...new Set(testImportList)].join(',\n')}
  ]);\n
  -------------------------------------------------------------------- \n`));
};

const mapRequests = (requests) => requests.map((item) => {
  let requestBody;
  let requestBodyType;
  switch ((item.body) ? item.body.type : 'NO BODY') {
    case 'JSON':
      requestBody = item.body.json;
      requestBodyType = 'JSON';
      break;
    case 'STRING':
      requestBody = item.body.string;
      requestBodyType = 'STRING';
      break;
    case 'NO BODY':
      requestBody = undefined;
      requestBodyType = '';
      break;
    default:
      requestBody = item.body;
      requestBodyType = '';
  }
  return ({
    method: item.method,
    path: item.path,
    queryStringParameters: JSON.stringify(item.queryStringParameters) || '{}',
    requestHeaders: item.headers,
    requestBody,
    requestBodyType,
    headers: item.headers,
  });
});

const isGoApi = (path) => {
  for (const [key, value] of Object.entries(goApiPathList)) {
    if (value.some((v) => path.includes(v))) {
      return key;
    }
  }
  return false;
};

class MockServer {
  constructor(apis) {
    const mockServers = [];
    if (!Array.isArray(apis)) throw new Error(chalk.redBright(`Error: ${chalk.red('Specify dependent APIs to mock')}, ${chalk.yellowBright('eg. new MockServer([\'api-1\', \'api-2\'])')}`));
    if (process.env.API_MOCK_SERVER_HOST) {
      const host = process.env.API_MOCK_SERVER_HOST;
      const port = process.env.API_MOCK_SERVER_PORT;
      debugLogger(chalk.magenta('MockServer:'), chalk.blue(`Creating ${chalk.blueBright(`${host}:${port}`)} mock`));
      mockServers.push({ api: process.env.API_MOCK_SERVER_HOST, mockServer: mockServerClient(host, port) });
    } else if (Array.isArray(apis)) {
      apis.forEach((api) => {
        const host = api;
        const port = 3000;
        debugLogger(chalk.magenta('MockServer:'), chalk.blue(`Creating ${chalk.blueBright(`${host}:${port}`)} mock`));
        mockServers.push({ api, mockServer: mockServerClient(host, port) });
      });
    } else {
      throw new Error(chalk.redBright(`Error: ${chalk.red('Specify dependent APIs to mock')}, ${chalk.yellowBright('eg. new MockServer([\'api-1\', \'api-2\'])')}`));
    }
    this.mockServers = mockServers;
  }

  async init() {
    fs.copySync(`${__dirname}/static/CertificateAuthorityCertificate.pem`, './CertificateAuthorityCertificate.pem', { overwrite: false });
    await Promise.all(this.mockServers.map(async (x) => {
      debugLogger(chalk.magenta('MockServer:'), chalk.blue(`Resetting ${chalk.blueBright(`${x.api}`)} mock`));
      await x.mockServer.reset();
    }));
    process.env.DRAW_SEQ_DIAGRAM = false;
    return this;
  }

  async mockResponse(mockServer, fixtureFile, options = {}) {
    let bypassServerList = [];
    if (process.env.BYPASS_API_MOCK_SERVER_HOST) {
      const defaultBypassServer = [{
        httpRequest: {
          path: '/.*',
        },
        httpOverrideForwardedRequest: {
          httpRequest: {
            headers: {
              Host: [
                process.env.BYPASS_API_MOCK_SERVER_HOST,
              ],
              Accept: [
                'application/json; charset=utf-8',
                '*',
              ],
            },
            secure: true,
          },
        },
      }];

      bypassServerList = process.env.BYPASS_API_MOCK_SERVER_HOST.includes('.json') ? fs.readJSONSync(process.env.BYPASS_API_MOCK_SERVER_HOST) : defaultBypassServer;

      const checkUniquePaths = bypassServerList.map((item) => item.httpRequest.path).length - [...new Set(bypassServerList.map((item) => item.httpRequest.path))].length;
      if (checkUniquePaths !== 0) throw new Error(chalk.redBright(`Error: ${chalk.red('BYPASS MOCK SERVER paths should be unique')} found ${chalk.yellowBright(JSON.stringify(bypassServerList.map((item) => ({ path: item.httpRequest.path }))))}`));
    }
    const mockFixture = (fixtureFile?.path) ? [{
      httpRequest: {
        method: fixtureFile.method,
        path: fixtureFile.path,
        headers: fixtureFile?.requestHeaders,
        queryStringParameters: fixtureFile.queryStringParameters,
        body: {
          type: 'JSON',
          json: (fixtureFile.requestBody) ? fixtureFile.requestBody : undefined,
          matchType: options.matchType || 'STRICT',
        },
      },
      httpResponse: {
        headers: {
          'Content-Type': [options.contentType || fixtureFile.contentType || 'application/json; charset=utf-8'],
          ...(fixtureFile?.headers || []),
        },
        statusCode: fixtureFile.statusCode,
        // eslint-disable-next-line no-nested-ternary
        body: (options.contentType === 'application/pdf' || fixtureFile.contentType === 'application/pdf') ? ({
          type: 'BINARY',
          base64Bytes: fixtureFile.body,
        }) : ((fixtureFile.body) ? fixtureFile.body : undefined),
      },
    }] : [];
    const mergedFixtureList = (process.env.BYPASS_API_MOCK_SERVER_HOST) ? [...bypassServerList, ...mockFixture] : mockFixture;

    // put /.*  at the end to catch all remaining paths
    const mergedFixtureListSorted = _.orderBy(mergedFixtureList, ['httpRequest.path'], 'desc');

    for (const fix of mergedFixtureListSorted) {
      await mockServer.mockAnyResponse(fix);
    }
    return this;
  }

  async loadFixtures(fixtureFiles, options = {}) {
    // Validate fixtures
    fixtureFiles.map((fixture, index) => {
      // eslint-disable-next-line no-mixed-operators
      const nth = (n) => ['st', 'nd', 'rd'][((n + 90) % 100 - 10) % 10 - 1] || 'th';
      return expect(fixture).toHaveValidSchema(fixtureSchema, [`MockServer: ${index + 1}${nth(index + 1)} fixture file has an issue, check import and file contents`]);
    });

    const distinctMockServers = (fixtureFiles.length > 0) ? fixtureFiles.map((item) => {
      const obj = this.mockServers.find((o) => (o.api === item.api || o.api === process.env.API_MOCK_SERVER_HOST));
      return { ...item, ...obj };
    }) : this.mockServers;

    const result = await Promise.all(distinctMockServers.map(async (f) => {
      let missingMockServers;
      if (f.mockServer) {
        await this.mockResponse(f.mockServer, f, options);
      } else {
        missingMockServers = f.api;
      }
      return missingMockServers;
    }));

    if (!result.every((a) => a === undefined)) {
      const distinctMissingMockServers = [...new Set(result.filter((f) => f !== undefined).map((a) => `"${a}"`))];
      throw new Error(chalk.redBright(`Error: ${chalk.red('Specify dependent APIs to mock')}, ${chalk.yellowBright(`eg. new MockServer([${distinctMissingMockServers}])`)}`));
    }

    return this;
  }

  async outgoingRequests(fixtureFile, options = {}) {
    const apiMockServer = this.mockServers.find((x) => (x.api === fixtureFile.api || x.api === process.env.API_MOCK_SERVER_HOST));
    const outgoingRequest = await apiMockServer.mockServer.retrieveRecordedRequests({
      path: fixtureFile.path,
      method: fixtureFile.method,
      body: {
        type: 'JSON',
        json: (fixtureFile.requestBody) ? JSON.stringify(fixtureFile.requestBody) : undefined,
        matchType: 'ONLY_MATCHING_FIELDS',
      },
    });

    this.retrievedRequests = mapRequests(outgoingRequest);
    this.retrievedRequests.map((req) => {
      const apiUnderTest = process.env.TEST_ENV_URL.replace('http://', '').replace(':3000', '');
      const fromApi = req.headers['X-Source-System'] ? req.headers['X-Source-System'][0] : apiUnderTest;
      const filePathsSplit = req.path
        .replace('/api/v1', '')
        .replace('/bff/v1', '')
        .replace('/', '')
        .split('/')
        .map((f) => (/^\d/.test(f) ? `id_${f}` : f))
        .filter((y) => y !== '');
      const toApi = (isGoApi(req.path)) ? isGoApi(req.path) : `api-${filePathsSplit[0].replace('api-', '')}`;
      const toApiMethodPath = _.kebabCase(_.kebabCase(`${req.method}-${filePathsSplit.slice(1).join('-')}`).replace(/[0-9]/g, ''));

      const storeagePath = './generated/outgoing-requests/';
      const testName = _.kebabCase(options.fileName) || _.kebabCase(expect.getState().currentTestName);

      const jsonPath = `${storeagePath}${toApi}/${toApiMethodPath}/from-${fromApi}/${testName}.json`;

      debugLogger(chalk.magenta('MockServer:'), chalk.green('Saved'), chalk.yellow('outgoing request payload:'), chalk.blackBright(jsonPath));
      fs.outputFileSync(jsonPath, JSON.stringify(req.requestBody, null, 2));
      return true;
    });

    return this.retrievedRequests;
  }

  async tearDown() {
    if (process.env.BYPASS_API_MOCK_SERVER_HOST) {
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((t) => setTimeout(t, 5000));
      const recordedRequestsAndResponses = await this.mockServers[0].mockServer.retrieveRecordedRequestsAndResponses();

      const requestsAndResponses = recordedRequestsAndResponses.map((x) => {
        const filePathsSplit = x.httpRequest.path
          .replace('/api/v1', '')
          .replace('/bff/v1', '')
          .replace('/', '')
          .split('/')
          .map((f) => (/^\d/.test(f) ? `id_${f}` : f))
          .filter((y) => y !== '');

        const paths = [...filePathsSplit];
        paths.pop();
        paths.shift();

        const fileName = filePathsSplit[filePathsSplit.length - 1];
        let requestBody;
        let requestBodyParams;

        switch ((x.httpRequest.body) ? x.httpRequest.body.type : 'NO BODY') {
          case 'JSON':
            requestBody = x.httpRequest.body.json;
            requestBodyParams = `-${shortHash(x.httpRequest.body.json)}`;
            break;
          case 'STRING':
            requestBody = x.httpRequest.body.string;
            requestBodyParams = `-${shortHash(x.httpRequest.body.string)}`;
            break;
          case 'NO BODY':
            requestBody = undefined;
            requestBodyParams = undefined;
            break;
          default:
            requestBody = x.httpRequest.body;
            requestBodyParams = `-${shortHash(x.httpRequest.body)}`;
        }

        let jsonFileName = (x.httpRequest.queryStringParameters)
          ? (`${fileName}-${Object.values(x.httpRequest.queryStringParameters)}`).replace(/,/g, '-')
          : fileName;

        jsonFileName = (x.httpRequest.body) ? `${jsonFileName}${requestBodyParams}` : jsonFileName;
        jsonFileName = /^\d/.test(jsonFileName) ? `id_${jsonFileName}` : jsonFileName;

        const fileNameDups = /(^(ABSA|FIRST|STAND|id_1-|AGLP|AGUT|AGRA|AGTF|AGOS|AGEN|AGLA|AGPR|AGPE|AGUF|AGUP)).*/;
        if (fileNameDups.test(jsonFileName)) {
          const pathPrefix = filePathsSplit[filePathsSplit.length - 2];
          jsonFileName = `${jsonFileName}-${pathPrefix}`;
        }

        let responseBody;
        switch ((x.httpResponse.body) ? x.httpResponse.body.type : 'NO BODY') {
          case 'JSON':
            responseBody = x.httpResponse.body.json;
            break;
          case 'STRING':
            responseBody = x.httpResponse.body.string;
            break;
          case 'BINARY':
            responseBody = x.httpResponse.body.base64Bytes;
            break;
          default:
            responseBody = (x.httpResponse.body) ? x.httpResponse.body : {};
        }

        const api = (isGoApi(x.httpRequest.path)) ? isGoApi(x.httpRequest.path) : `api-${filePathsSplit[0].replace('api-', '')}`;

        return ({
          api,
          fullPath: x.httpRequest.path,
          method: x.httpRequest.method,
          path: `${api}/${paths.join('/')}`,
          jsonFileName: `${jsonFileName}.json`,
          jsonFileVarName: _.camelCase(jsonFileName),
          queryStringParameters: x.httpRequest.queryStringParameters,
          requestBody: (x.httpRequest.body) ? requestBody : undefined,
          statusCode: x.httpResponse.statusCode,
          contentType: (x.httpResponse.headers && x.httpResponse.headers['Content-Type']) ? x.httpResponse.headers['Content-Type'][0] : undefined,
          body: responseBody,
        });
      });

      generateFixtures(requestsAndResponses);
      return this;
    }

    debugLogger(chalk.blackBright.bold('Test:'), chalk.blackBright(expect.getState().currentTestName));
    await Promise.all(this.mockServers.map(async (x) => {
      await this.validateFixtures(x.mockServer);
    }));
    await Promise.all(this.mockServers.map(async (x) => {
      debugLogger(chalk.magenta('MockServer:'), chalk.blue(`Resetting ${chalk.blueBright(`${x.api}`)} mock`));
      await x.mockServer.reset();
    }));
    debugLogger(' ');
    return this;
  }

  async validateFixtures(mockServer) {
    const allRequests = await mockServer.retrieveRecordedRequests({});
    const requests = mapRequests(allRequests);

    const debugLogs = [];
    const sequenceDiagramLogs = [];

    const results = await Promise.all(requests.map(async (req, index) => {
      let apiMockServerLog = [];
      apiMockServerLog = await mockServer.retrieveLogMessages({
        path: req.path,
        method: req.method,
        queryStringParameters: JSON.parse(req.queryStringParameters) || undefined,
        body: {
          type: 'JSON',
          json: (req.requestBody && req.requestBodyType === 'JSON') ? req.requestBody : undefined,
          matchType: 'ONLY_MATCHING_FIELDS',
        },
      });

      let getMatchedTimestamp = [];
      if (apiMockServerLog.length > 0) {
        getMatchedTimestamp = apiMockServerLog.map((l) => ({
          path: req.path,
          method: req.method,
          responedAt: l.substring(0, 100).match(/(.*)returning response/gi),
        }))
          .filter((p) => p.responedAt !== null)
          .map((m) => {
            const timestampParsed = parseISO(m.responedAt[0].replace(' - returning response', ''));
            const timestamp = (!timestampParsed.toString().includes('Invalid Date')) ? format(add(timestampParsed, { hours: 2 }), 'yyyy-mm-dd HH:mm:ss.SSS') : new Date().toISOString();

            return ({ ...m, timestamp });
          });
      }

      const regexFailedNoMatch = /no expectation for([\S\s]*?)returning response:([\S\s]*?)"statusCode" : 404,([\S\s]*?)"reasonPhrase" : "Not Found"/gs;
      const regexNoMatchRequestBody = /didn't match expectation:([\S\s]*?)because:([\s\S]*?)method matched([\s\S]*?)path matched([\s\S]*?)body didn't match/s;

      let noMatchLog;
      let noMatchRequestBody;
      let error;

      if (apiMockServerLog.length < 4) { // didnt find any matching logs :(
        const apiMockServerLogList = await mockServer.retrieveLogMessages({
          path: req.path,
          method: req.method,
          queryStringParameters: JSON.parse(req.queryStringParameters) || undefined,
        });

        const apiMockServerLogs = [].concat(...[apiMockServerLogList]);

        noMatchLog = apiMockServerLogs.filter((log) => regexFailedNoMatch.test(log));
        noMatchRequestBody = apiMockServerLogs.filter((log) => regexNoMatchRequestBody.test(log));
        apiMockServerLog = [...noMatchLog, ...noMatchRequestBody];
      }

      const regexFailedNoMatchTest = regexFailedNoMatch.test(apiMockServerLog.join('\n'));
      const requestBody = (req.requestBody) ? `${JSON.stringify(req.requestBody).substring(1, 180)} ...` : '';

      if (!regexFailedNoMatchTest) {
        debugLogs.push({ index, log: `${chalk.green('Request: ')} ${index} ${chalk.cyan(req.method, req.path, req.queryStringParameters, requestBody)} ${chalk.green('Mocked \u2713')}` });

        // ***************************
        const pathsSplit = req.path
          .replace('/api/v1', '')
          .replace('/bff/v1', '')
          .replace('/', '')
          .split('/');
        const api = (isGoApi(req.path)) ? isGoApi(req.path) : `api-${pathsSplit[0].replace('api-', '')}`;
        sequenceDiagramLogs.push({
          ...getMatchedTimestamp[0], from: apiName, to: api, method: req.method, path: req.path, queryStringParameters: req.queryStringParameters, requestBody: req.requestBody,
        });

        // ***************************
      } else {
        const noMatchReqBody = (noMatchRequestBody) ? (noMatchRequestBody.join('\n')) : undefined;
        debugLogs.push({ index, log: `${chalk.green('Request: ')} ${index} ${chalk.red(req.method, req.path, req.queryStringParameters, requestBody, noMatchReqBody)} ${chalk.redBright('Unmocked \u274C')}` });
        debugLogs.push({ index, log: `${chalk.blue('DEBUG UI: Open')} ${chalk.cyan.bold.underline('http://localhost:1080/mockserver/dashboard')} ${chalk.bold.yellowBright('to investigate')}` });
        error = `${chalk.redBright('Request: ')}${chalk.red(req.method, req.path, req.queryStringParameters, requestBody)}${chalk.redBright('Unmocked \u274C \n')}`;
      }

      return error;
    }));

    const logSorted = debugLogs.sort((a, b) => a.index - b.index).map((x) => x.log);
    debugLogger('\n', logSorted.join('\n'));

    if (process.env.DRAW_SEQ_DIAGRAM !== 'false') {
      fs.outputFileSync(
        `./generated/${apiName}/sequence/${process.env.DRAW_SEQ_DIAGRAM}/fixture.log.json`,
        `${JSON.stringify(sequenceDiagramLogs, null, 2)}`,
      );
    }

    const errors = results.filter((r) => r !== undefined);
    if (errors.length > 0) {
      throw new Error(errors);
    }

    // For CI look at the active expectations since logging is OFF
    // ONLY checking Method. Path and Query string params
    const retrieveActiveExpectations = await mockServer.retrieveActiveExpectations({});
    const activeExpectationsMapped = retrieveActiveExpectations.map((x) => ({
      method: x.httpRequest.method,
      path: x.httpRequest.path,
      queryStringParameters: (x.httpRequest.queryStringParameters)
        ? x.httpRequest.queryStringParameters
        : {},
    }));

    const regexGuid = /(\{){0,1}[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(\}){0,1}$/gi;

    const requestsMapped = requests.map((x) => ({
      method: x.method,
      path: regexGuid.test(x.path) ? x.path.replace(regexGuid, '.*') : x.path,
      queryStringParameters: (x.queryStringParameters)
        ? JSON.parse(x.queryStringParameters)
        : {},
    }));

    const missingFixtures = _.differenceWith(requestsMapped, activeExpectationsMapped, _.isMatch);
    if (missingFixtures.length > 0) {
      const missingFixturesErrors = missingFixtures.map((x) => `${chalk.redBright('Request: ')}${chalk.red(x.method, x.path, JSON.stringify(x.queryStringParameters))} ${chalk.redBright('Unmocked \u274C \n')}`);
      throw new Error(missingFixturesErrors);
    }

    return this;
  }
}

module.exports = MockServer;
