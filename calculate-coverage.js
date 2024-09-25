/* eslint-disable no-restricted-syntax */
const fs = require('fs-extra');
const { match, parse } = require('matchit');
const _ = require('lodash');
const { generatePairwiseOptions } = require('@fluidframework/test-pairwise-generator');
const {
  infoLog, chalk, apiName,
} = require('./_common');

const requestLogPath = `./generated/${apiName}/request.log.json`;

const testCasePermutations = (pairwiseOptions) => pairwiseOptions.map((a) => {
  let obj = {};
  let requiredProps = [];
  const v = Object.values(a);

  for (const [key, value] of Object.entries(a)) {
    // saving for required fields
    if (value.includes('required')) {
      requiredProps = [...requiredProps, key];
    }
    // removing fields
    if (!value.includes('-missing')) {
      obj = { ...obj, [key]: value };
    } else {
      obj = { ...obj };
    }
  }

  const k = Object.keys(obj);
  // checking all required fields present && no invalid
  if (requiredProps.every((re) => k.includes(re)) && v.every((i) => !i.includes('invalid'))) {
    obj = { ...obj, scenario: 'positive case' };
  } else if (requiredProps.some((re) => !k.includes(re))) {
    obj = { ...obj, scenario: 'negative case missing required param' };
  } else if (v.some((i) => i.includes('invalid'))) {
    obj = { ...obj, scenario: 'negative case invalid param' };
  }

  return obj;
});

const testCommand = process?.env?.test_command || '';
const suffix = testCommand.replace('test:acceptance', ' ').replace('test:ci', ' ');

module.exports = async (endpoints) => {
  try {
    if (fs.pathExistsSync(requestLogPath) && !process.env.JEST_GROUP_SQL_ACCEPTANCE) {
      const requestLogs = fs.readFileSync(requestLogPath, 'utf-8');
      const requestLog = requestLogs.split('|').filter(Boolean).map((xx) => JSON.parse(xx)).map((n) => ({ ...n, url: n?.url.replace('$', '') }));

      const d = new Date();
      const yearMonth = `${d.getFullYear()}-${(`0${d.getMonth() + 1}`).slice(-2)}`;

      const ep = endpoints.sort((a, b) => ((a.url > b.url) ? -1 : 1)).map((n) => ({ ...n, url: n?.url.replace('$', '') }));

      ep.map((m, index) => {
        if (m.url.match(/:/gi)?.length > 1) {
          return ep.push(ep.splice(index, 1)[0]);
        }
        return true;
      });

      const filterMethod = requestLog.map((r) => {
        const eps = ep.filter((e) => e.method === r.method);
        const routes = eps.map((x) => x.url).map(parse);

        return ({
          method: r.method,
          url: match(r.url.split('?')[0], routes).length > 0 ? match(r.url.split('?')[0], routes)[0].old : '',
          testCount: match(r.url.split('?')[0], routes).length > 0,
        });
      });

      const result = endpoints.map((n) => ({ ...n, url: n?.url.replace('$', '') })).map((e) => {
        const pairwiseOptions = generatePairwiseOptions(e.parameterOptions);
        let testCases = testCasePermutations(pairwiseOptions);
        if (testCases.length === 0) {
          testCases = ['positive test', 'negative test'];
        }
        let testCount = 0;
        filterMethod.map((u) => {
          if (u.method === e.method && u.url === e.url) {
            testCount += 1;
          }
          return testCount;
        });
        return ({
          ...e, testCount, testCountPredicted: testCases.length, testCasePermutation: testCases, yearMonth, apiName, teamName: _.kebabCase(process.env.CI_PROJECT_NAMESPACE || 'unknown'),
        });
      }).sort((a, b) => ((a.url > b.url) ? -1 : 1));

      const endpointCoverageResults = _.orderBy(result, ['path'], ['method']);

      let coverageOutput = '\n\n';
      let testCasesOutput = '\n\n';

      // if acceptance tests then save results
      if (!(process.env.TEST_DATA_ENV || process.env.TEST_ENV)) {
        endpointCoverageResults.forEach((r) => {
          const status = chalk.black((` ${r.testCount}/${r.testCountPredicted} TESTS`).padEnd(13, ' '));
          let bgColor;
          switch (true) {
            case (r.testCount >= r.testCountPredicted):
              bgColor = chalk.bgGreen(status);
              break;
            case (r.testCount > 0 && r.testCount < r.testCountPredicted):
              bgColor = chalk.bgYellow(status);
              break;
            default:
              bgColor = chalk.bgRed(status);
              break;
          }

          coverageOutput += `${bgColor}  ${r.method.padEnd(8, ' ')}  ${r.url}\n`;
          testCasesOutput += `${bgColor}  ${r.method.padEnd(8, ' ')}  ${r.url}\n${chalk.gray.bgBlack(JSON.stringify(r.testCasePermutation, null, 2))}\n`;
        });

        const thiMonthsCoverage = endpointCoverageResults.map(({ testCasePermutation, parameterOptions, ...keepAttrs }) => keepAttrs);

        fs.outputFileSync(`./generated/test-count-per-endpoint/${apiName}/${_.kebabCase(yearMonth + suffix)}.json`, JSON.stringify(thiMonthsCoverage, null, 2));
      } else {
        // if verification tests use different scale
        endpointCoverageResults.forEach((r) => {
          const status = chalk.black((` ${r.testCount}/${r.testCountPredicted} TESTS`).padEnd(12, ' '));
          let bgColor;
          switch (true) {
            case (r.testCount >= 1):
              bgColor = chalk.bgGreen(status);
              break;
            case (r.testCount < 1 && r.method === 'GET'):
              bgColor = chalk.bgRed(status);
              break;
            default:
              bgColor = chalk.bgYellow(status);
              break;
          }

          coverageOutput += `${bgColor}  ${r.method.padEnd(8, ' ')}  ${r.url}\n`;
        });

        if (process.argv.includes('-push-coverage')) {
          const thiMonthsCoverage = endpointCoverageResults.map(({ testCasePermutation, parameterOptions, ...keepAttrs }) => keepAttrs);
          fs.outputFileSync(`./generated/test-count-per-endpoint/${apiName}/${_.kebabCase(yearMonth + suffix)}.json`, JSON.stringify(thiMonthsCoverage, null, 2));
        }
      }

      if (process.argv.includes('-test-scenarios')) {
        infoLog(testCasesOutput);
      } else {
        infoLog(coverageOutput);
      }

      // remove request log file
      fs.unlinkSync(requestLogPath);
    }
  } catch (err) {
    // continue regardless of error
  }
};
