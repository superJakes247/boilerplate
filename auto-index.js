/* eslint-disable no-restricted-syntax */
const _ = require('lodash');
const fs = require('fs-extra');
const find = require('find');
const lintFiles = require('./lint-files');
const { infoLog, chalk } = require('./_common');

module.exports = (location) => {
  try {
    const files = find.fileSync(/\.json$/, location);
    const indexData = [];
    const fileNames = [];

    for (const file of files) {
      const fileArray = file.split('/');
      const fileArr = [...fileArray];

      fileArray.forEach(() => {
        const x = fileArr.pop();
        const locs = location.split('/');
        if (!locs.includes(x)) {
          const name = _.camelCase(x.replace('.json', ''));
          if (x.includes('.json')) {
            fileNames.push({ filePath: file, name });
          }
          const defaultImport = (x.includes('.json'))
            ? `export { default as ${name} } from './${x}';`
            : `import * as ${name} from './${x}';\n\nexport { ${name} };\n`;

          const indexFileData = defaultImport;
          const indexFilePath = `${fileArr.join('/')}/index.js`;
          indexData.push(JSON.stringify({ indexFileData, indexFilePath }));
        }
      });
    }

    const fixtureFilesUsedList = [];
    const testFiles = find.fileSync(/\.test\.js$/, '.');
    for (const testFile of testFiles) {
      const fileData = fs.readFileSync(testFile, 'utf-8');
      fileNames.forEach((fixtureFileName) => {
        fixtureFilesUsedList.push({ fixtureFileName: fixtureFileName.filePath, isUsed: fileData.includes(fixtureFileName.name) });
      });
    }

    const fixtureFilesList = _.groupBy(fixtureFilesUsedList, (i) => i.fixtureFileName);
    infoLog(' ');
    for (const [key, value] of Object.entries(fixtureFilesList)) {
      if (value.every((x) => x.isUsed === false)) {
        infoLog(chalk.red('EXTRA FIXTURE FOUND:'), key, chalk.redBright('USE: "-- -u" to automatically remove'));
        if (process.argv.includes('-u')) {
          fs.unlinkSync(key);
          infoLog(chalk.red('DELETED:'), chalk.redBright(key));
        }
      }
    }

    const uniqImports = [...new Set(indexData)];
    const uniqImportsJson = uniqImports.map((ui) => JSON.parse(ui));
    const groupedImports = _.groupBy(uniqImportsJson, (uij) => uij.indexFilePath);
    infoLog(' ');
    for (const [key, value] of Object.entries(groupedImports)) {
      const indexFileDatas = value.map((ifd) => ifd.indexFileData).join('\n');

      const indexDirPath = key.replace('/index.js', '');
      fs.ensureDirSync(indexDirPath);
      fs.chmodSync(indexDirPath, 0o777);
      fs.lchownSync(indexDirPath, 1000, 1000);

      fs.writeFileSync(key, indexFileDatas, { mode: 0o777 });
      infoLog(chalk.green('CREATED/UPDATED FIXTURE INDEX:'), key);
    }
    lintFiles(`./${location}`);
  } catch (err) {
    infoLog(err, chalk.redBright('ERROR: Auto indexing failed'));
  }
};
