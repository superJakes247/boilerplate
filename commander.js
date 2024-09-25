#!/usr/bin/env node

const { program } = require('commander');

const dummyFunction = (param) => {
  console.log(`this is a test function ${param}`)
}

program
  .command('init [path]')
  .description('copy all the jest and js config needed to run the tests')
  .option('-r ,--replace <api-name>', 'override all existing config')
  .option('-a ,--append', 'add to / merge into existing config')
  .option('-m ,--merge <api-name>', 'attempt to merge into existing config')
  .action((path, options) => {
    dummyFunction(path, options);
  });

program
  .command('pull-swagger-file <url>')
  .description('download swagger file from url, url is the path to swagger.json/swagger.yml')
  .action((url) => {
    dummyFunction(url);
  });

program
  .command('schemas [path]')
  .description('generate/update schemas from swagger file')
  .action((path) => {
    dummyFunction(path);
  });

program
  .command('urls [path]')
  .description('generate/update url definitions from swagger file')
  .action((path) => {
    dummyFunction(path);
  });

program
  .command('tests [path]')
  .description('generate/update tests from swagger file')
  .option('-c ,--combos', 'create tests with param combinations')
  .option('-acc ,--acceptance', 'create acceptance tests')
  .action((path, options) => {
    dummyFunction(path, options);
  });

program
  .command('auto-index <path>')
  .description('automatically create index files for nested json files')
  .action((path) => {
    dummyFunction(path);
  });

program
  .command('create-sql-mock <path>')
  .description('convert sql table data into an mocked proc, view or seed script')
  .action((path) => {
    dummyFunction(path);
  });

program
  .command('create-catalog-info')
  .description('creates the backstage catalog-info.yaml for an API')
  .action(() => {
    dummyFunction();
  });

program
  .command('xml-to-json <xmlPath> <jsonPath>')
  .description('convert xml derived from SQL using FOR XML PATH to JSON')
  .action((xmlPath, jsonPath) => {
    dummyFunction(xmlPath, jsonPath);
  });

program.parse(process.argv);
