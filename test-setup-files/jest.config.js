// For a detailed explanation regarding each configuration property, visit:
// https://jestjs.io/docs/en/configuration.html

module.exports = {
  setupFilesAfterEnv: ['./jest.setup'],
  testEnvironment: 'node',
  verbose: true,
  globalTeardown: './jest.teardown',
  runner: 'groups',
};
