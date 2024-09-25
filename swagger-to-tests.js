/* eslint-disable no-await-in-loop */
/* eslint-disable max-statements */
/* eslint-disable no-restricted-syntax */

const SwaggerParser = require('@apidevtools/swagger-parser');
const fs = require('fs-extra');
const _ = require('lodash');
const find = require('find');
const { mock } = require('mock-json-schema');
const { infoLog, chalk } = require('./_common');

const lintFiles = require('./lint-files');
const paramsToTests = require('./params-to-tests');

const createFileData = (method, path, urlDefName, urlFilePath, jsonFilePath, params, pathParams, body, fileName, paramCombos, isAcceptanceTest) => {
  const skipped = () => ((method === 'get') ? '' : '.skip');

  const paramsInTestName = () => ((paramCombos)
    ? `${paramCombos}`
    : '');

  const importUrl = () => ((paramCombos)
    ? ''
    : `import { ${urlDefName} } from '${urlFilePath.replace('.js', '')}';`
  );

  const requireSchema = () => ((fileName && !paramCombos && !isAcceptanceTest)
    ? `import ${_.camelCase(fileName)} from '${jsonFilePath.replace('/data/generated', '..')}';`
    : '');

  const isCombos = () => ((paramCombos)
    ? `const url = ${urlDefName}(${paramCombos});`
    : `const url = ${urlDefName}({${params}${pathParams}});`);

  const postBody = () => ((body) ? `,data: ${body}` : '');

  const expectSchema = () => {
    let expectation;
    if (fileName && !paramCombos && !isAcceptanceTest) {
      expectation = `expect(response.status).toBe(200, { log:[url, response.data] });\nexpect(response.data).toHaveValidSchema(${_.camelCase(fileName)}, { log:[url, response.data] });`;
    } else if (isAcceptanceTest) {
      expectation = 'expect(response.status).toBe(200, { log:[url, response.data] });\nexpect(response.data).toMatchSnapshot();';
    } else {
      expectation = 'expect(response.status).toBe(200, { log:[url, response.data] });';
    }
    return expectation;
  };

  const testFileData = `${importUrl()}
      ${requireSchema()}
      test${skipped()}('can ${method.toUpperCase()} on path ${path} ${paramsInTestName()}', async() => {
                  
      ${isCombos()}
      
      const response = await request({...url${postBody()}})
      
      ${expectSchema()}
      });`;
  return testFileData;
};

const writeFile = (testsFilePath, testFileData, isAcceptanceTest) => {
  if (fs.existsSync(testsFilePath)) {
    fs.writeFileSync(testsFilePath.replace('.test.js', '-GENERATED.js'), testFileData, { mode: 0o777 });
    infoLog(chalk.yellowBright('GENERATED TESTS (Rename as required): '), testsFilePath.replace('.test.js', '-GENERATED.test.js'));
  } else {
    fs.writeFileSync(testsFilePath, isAcceptanceTest ? `
    /**\n* @group acceptance\n*/
    import { request, MockServer } from '@agct/test-utilities';

     let mockServer;
      
      beforeEach(async () => {
        mockServer = new MockServer(['api-1', 'api-2']);
        await mockServer.init();
      });
      
      afterEach(async () => {
        await mockServer.tearDown();
      });      
      `
      : '/**\n* @group pre-verification\n*/\nimport { request } from \'@agct/test-utilities\';\n', { mode: 0o777 });
    fs.appendFileSync(testsFilePath, testFileData, { mode: 0o777 });
  }
};

module.exports = async (destPath, options) => {
  find.file(/swagger\.json$/, './generated/', async (files) => {
    for (const file of files) {
      const apiName = file.split('/').reverse()[1];
      const urlPath = '../urls';
      const jsonPath = '../schemas';
      const destinationPath = destPath || `./generated/${apiName}/${(options.acceptance ? '__acceptance__' : '__verification__')}`;
      const testsPath = destinationPath;

      const swaggerJson = fs.readJsonSync(file);
      const swagger = JSON.parse(JSON.stringify(swaggerJson));

      // add in missing swagger file info to be able to parse
      swagger.info = {};
      swagger.info.version = '1.0.0';
      swagger.info.title = 'Swagger';

      try {
        const deRef = await SwaggerParser.dereference(swagger);

        let urlFuncNames = '';

        for (const [path, value] of Object.entries(deRef.paths)) {
          const exludeKeys = ['/start', '/stop', '/ping', '/health', '/git-version'];

          if (!exludeKeys.includes(path)) {
            for (const [method, values] of Object.entries(value)) {
              if (!values.tags) { values.tags = ['_']; }
              const tag = _.kebabCase(values.tags[0].replace('REST', '').replace('API', ''));
              const urlFilePath = `${urlPath}/${tag}-urls.js`;

              urlFuncNames = `${urlFuncNames}${_.camelCase(`${method}${path}`)},`;
              let params = '';
              let pathParams = '';
              let body;
              const parameters = values.parameters || [];
              for (const param of parameters) {
                if (['query'].includes(param.in)) {
                  params = `${params}${param.name},`;
                }
                if (['path'].includes(param.in)) {
                  pathParams = `${pathParams}${_.camelCase(param.name)},`;
                }
                if (['body'].includes(param.in)) {
                  body = JSON.stringify(mock(param.schema), null, 2);
                }
              }
              // give dir permissions
              fs.ensureDirSync(testsPath);
              fs.chmodSync(testsPath, 0o777);
              fs.lchownSync(testsPath, 1000, 1000);

              let fileName;
              let jsonFilePath = '';
              if (Object.prototype.hasOwnProperty.call(values.responses, '200') || Object.prototype.hasOwnProperty.call(values.responses, '201')) {
                const regx = /[/]/g;
                fileName = path.replace(regx, '-');
                jsonFilePath = `${jsonPath}/${method}${fileName}.json`;
              }

              const urlDefName = _.camelCase(`${method}${path}`);

              const testsFilePath = `${testsPath}/_${_.upperCase(method)}-${_.kebabCase(path)}.test.js`;

              if (options.combos) {
                paramsToTests(urlFilePath, urlDefName, method, path, jsonFilePath, params, pathParams, body, fileName, testsFilePath, createFileData, writeFile);
              }

              if (options.acceptance) {
                const paramCombos = undefined;
                const isAcceptanceTest = options.acceptance;
                const testFileDataAcc = createFileData(method, path, urlDefName, urlFilePath, jsonFilePath, params, pathParams, body, fileName, paramCombos, isAcceptanceTest);
                writeFile(testsFilePath, testFileDataAcc, isAcceptanceTest);
              } else {
                const testFileData = createFileData(method, path, urlDefName, urlFilePath, jsonFilePath, params, pathParams, body, fileName);
                writeFile(testsFilePath, testFileData);
              }
            }
          }
        }
        infoLog(chalk.green('CREATED TESTS IN FOLDER: '), testsPath);
        lintFiles(destPath);
      } catch (err) {
        infoLog(chalk.redBright('ERROR: Could not parse swagger file (call the swagger police)'), '\n', chalk.red(err.message));
      }
    }
  }).error((err) => {
    if (err) {
      infoLog(chalk.redBright('ERROR: missing ./generated/swagger.json'), chalk.yellowBright('USE COMMAND: pull-swagger-file <url> to create the file'));
    }
  });
};
