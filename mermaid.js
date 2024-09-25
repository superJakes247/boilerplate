/* eslint-disable no-restricted-syntax */
const fs = require('fs-extra');
const _ = require('lodash');
const find = require('find');
const { apiName, chalk, debugLogger } = require('./_common');

const staticFolder = '../documentation/';
const generatedFolderPath = `./generated/${apiName}/sequence`;

const sequenceDiagram = async () => {
  const folderPaths = [];
  try {
    if (fs.existsSync(generatedFolderPath)) {
      const folders = find.fileSync(/\.json$/, generatedFolderPath);
      for (const folder of folders) {
        const filePaths = folder.split('/');
        filePaths.pop();
        const folderPath = filePaths.join('/');
        folderPaths.push(folderPath);
      }

      for (const folderPath of [...new Set(folderPaths)]) {
        const files = find.fileSync(/\.json$/, folderPath);
        const sequenceDiagramLogs = [];

        for (const file of files) {
          const fileData = fs.readJSONSync(file);
          sequenceDiagramLogs.push(fileData);
        }

        const mermaidSeqDiagramClean = [...sequenceDiagramLogs.flat()]
          .filter((f) => !f.path.includes('queues'));

        const sortSeq = _.sortBy(mermaidSeqDiagramClean, ['timestamp']);

        const removeDuplicates = [...new Set(sortSeq.map((m) => JSON.stringify(m)))].map((n) => JSON.parse(n));

        const mermaidSeqDiagram = removeDuplicates.map(((a) => `  ${a.from}->>+${a.to}: ${a.method} - ${a?.path}`));
        mermaidSeqDiagram.push('```');
        mermaidSeqDiagram.unshift(`  title: ${apiName}-${sortSeq[0].method}-${sortSeq[0].path}`);
        mermaidSeqDiagram.unshift('  autoNumber');
        mermaidSeqDiagram.unshift('  Actor endpoint');

        mermaidSeqDiagram.unshift('sequenceDiagram');
        mermaidSeqDiagram.unshift('```mermaid');

        fs.ensureDirSync(staticFolder);
        fs.chmodSync(staticFolder, 0o777);
        fs.lchownSync(staticFolder, 1000, 1000);

        const fileName = folderPath.split('/').pop();
        const diagramFileName = `${staticFolder}${fileName}.md`;
        fs.outputFileSync(diagramFileName, mermaidSeqDiagram.join('\n'));
      }

      fs.removeSync(`./generated/${apiName}/sequence/`);
    }
  } catch (err) {
    // continue regardless of error
  }
};

const drawSequenceDiagram = async (name, data = []) => {
  if (!name) throw new Error(chalk.red('DRAW SEQUENCE DIAGRAM: filename is required'));
  const fName = _.kebabCase(name);
  process.env.DRAW_SEQ_DIAGRAM = fName || false;

  fs.outputFileSync(
    `./generated/${apiName}/sequence/${fName}/overrides.json`,
    `${JSON.stringify(data, null, 2)}`,
  );

  debugLogger(chalk.yellowBright(`SEQUENCE DIAGRAM: Diagram "${name}" md written to ./documentation`));
  return true;
};

module.exports = { sequenceDiagram, drawSequenceDiagram };
