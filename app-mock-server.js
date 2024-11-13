/* eslint-disable no-console */
import chalk from 'chalk';
import fs from 'fs';
import util from 'util';

const debugLog = util.debuglog('verbose');
chalk.enabled = true;
chalk.level = 3;
const appRootUrl = 'http://app-fund-administration:80';

jest.setTimeout(process.env.NODE_DEBUG ? 1000000 : 50000);

beforeAll((done) => {
  jest.spyOn(global.console, 'error').mockImplementation((e) => done(new Error(e)));
  done();
});

class MockServer {
  constructor() {
    this.fixtureRegistry = [];
  }

  async initialize(page) {
    this.page = page;
    await this.page.setRequestInterception(true);

    this.handleError = this.handleError.bind(this);
    this.handleRequest = this.handleRequest.bind(this);

    this.page.on('error', this.handleError);
    this.page.on('request', this.handleRequest);
  }

  async handleRequest(request) {
    const url = request.url();
    const method = request.method();

    if (url.includes(['/product/api/'])) {
      debugLog(chalk.cyanBright(`request: ${method} ${url}`));

      const fixture = this.fixtureRegistry.find((f) => f.url === url && f.method === method);
      if (fixture) {
        debugLog(chalk.greenBright(`mocked: ${method} ${url}`));
        const body = fixture.file ? fs.readFileSync(fixture.file) : JSON.stringify(fixture.body);

        request.respond({
          status: fixture.status || 200,
          contentType: 'application/json',
          body,
        });
        return true;
      }
      this.handleError(new Error(`UNHANDLED: ${method} ${url}`));
      return false;
    }
    request.continue();
    return false;
  }

  handleError(error) {
    console.error(chalk.red(error.toString()));
    return this;
  }

  loadFixtures(fixtures) {
    const fixturesToLoad = fixtures.map(({
      method, url, status, body,
    }) => ({
      method,
      url: `${appRootUrl.replace(':80', '')}${url}`,
      status,
      body,
    }));
    this.fixtureRegistry = [...fixturesToLoad, ...this.fixtureRegistry];
    return this;
  }

  removeFixture(fixture) {
    const fixturesToLoad = fixture.map(({
      method, url, status, body,
    }) => ({
      method,
      url: `${appRootUrl.replace(':80', '')}${url}`,
      status,
      body,
    }));
    this.fixtureRegistry = this.fixtureRegistry.filter((item) => item.url !== fixturesToLoad.url);
    return this;
  }
}

export default MockServer;
