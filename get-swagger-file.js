const https = require('https');
const axios = require('axios').default;
const fs = require('fs-extra');
const yaml = require('js-yaml');
const converter = require('swagger2openapi');
const { infoLog, chalk } = require('./_common');

const generatedPath = './generated';

const getSwaggerFile = async (url) => {
  infoLog(chalk.cyan('Fetching data from swagger url'));
  try {
    const response = await axios({
      method: 'get',
      url,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
    // write swagger file openapi3 to static folder
    const staticFilePath = (process.env.TEST_FILES) ? './generated' : '../static';
    const options = {
      patch: true,
      warnOnly: true,
      yaml: true,
      verbose: true,
    };
    const openapi3 = await converter.convert(response.data, options);
    const serverUrl = openapi3.openapi.servers[0].url;
    openapi3.openapi.servers = [
      { url: `https://api.dev.matt.net${serverUrl}` },
      { url: `https://api.int.matt.net${serverUrl}` },
      { url: `https://api.uat.matt.net${serverUrl}` },
    ];

    const ymlFile = yaml.dump(openapi3.openapi);

    if (!fs.existsSync(`${staticFilePath}/swagger.yaml`)) {
      fs.ensureDirSync(staticFilePath);
      fs.chmodSync(staticFilePath, 0o777);
      fs.lchownSync(staticFilePath, 1000, 1000);
      fs.outputFileSync(`${staticFilePath}/swagger.yaml`, ymlFile);
    }
    let data = {};

    if (typeof response.data !== typeof {}) {
      data = yaml.load(response.data);
    } else {
      data = response.data;
    }
    const basePath = data.basePath || data.servers[0].url || '/';
    const apiName = `api-${basePath.replace('/api/v1', '').replace('/bff/v1', '').replace('/', '')}`;
    const apiPath = `${generatedPath}/${apiName}`;
    const swaggerFilePath = `${apiPath}/swagger.json`;

    // give dir permissions
    fs.ensureDirSync(apiPath);
    fs.chmodSync(apiPath, 0o777);
    fs.lchownSync(apiPath, 1000, 1000);

    // write file to disk
    fs.writeFileSync(swaggerFilePath, JSON.stringify(data, null, 2), { mode: 0o777 });
    infoLog(chalk.green(`Saved file to disk \n ${swaggerFilePath} \n${staticFilePath}/swagger.yaml`));

    // give file permissions
    fs.lchownSync(swaggerFilePath, 1000, 1000);
    return ymlFile;
  } catch (error) { throw new Error(error); }
};

module.exports = getSwaggerFile;
