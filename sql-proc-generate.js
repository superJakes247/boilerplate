/* eslint-disable no-await-in-loop */
const util = require('util');
const chalk = require('chalk');
const fs = require('fs-extra');
const differenceWith = require('lodash.differencewith');
const isEqual = require('lodash.isequal');
const camelCase = require('camelcase');
const sqlQueryExecute = require('../sql-execute');
const sqlMockExecute = require('../sql-mock-execute');
const commonConfig = require('../../config');
const fixtureSchema = require('./fixtures-schema.json');
const dependencies = require('../dependencies');
const { dependencyDiagram } = require('../dependency-diagram');

const debugLog = util.debuglog('debug');
// eslint-disable-next-line no-console
const infoLog = console.log;
// eslint-disable-next-line no-console
const tableLog = console.table;

chalk.enabled = true;
chalk.level = 3;

const cleanUpSQLFixtures = async (config) => {
  await sqlMockExecute({
    config,
    sqlQuery: `
  DECLARE @cmd nvarchar(MAX) = '';
  
  WITH x AS (
      SELECT TOP 10000 
             PL.Id                                            AS Id
            ,PARSENAME(PL.OriginalName,1)                     AS OriginalName
            ,ISNULL(SO.name,'')                               AS name
            ,QUOTENAME(SCHEMA_NAME(ISNULL(SO.schema_id,1)))   AS SchemaName
            ,ISNULL(SEP.major_id,-1)                          AS major_id
        FROM tSQLt.Private_RenamedObjectLog PL
        LEFT JOIN sys.objects SO
          ON ObjectId = object_id
        LEFT JOIN sys.extended_properties SEP
          ON SEP.major_id = SO.object_id
         AND SEP.name = 'tSQLt.FakeTable_OrgTableName'
       ORDER BY SO.create_date DESC
  )
  SELECT @cmd = @cmd 
         + CASE WHEN x.name = '' OR OriginalName = x.name 
                THEN N'DELETE tSQLt.Private_RenamedObjectLog WHERE Id = ' + CAST(x.Id AS nvarchar) + N';'
                ELSE N'DROP ' 
                   + N'TABLE'   --Replace this with a CASE statement to deal with other object types
                   + N' ' + SchemaName + '.' + QUOTENAME(x.OriginalName) + '; ' 
                   + NCHAR(13) + NCHAR(10) + N'EXEC sp_rename ''' + SchemaName + N'.' 
                                           + QUOTENAME(x.name) + N''',''' + OriginalName + N''';'
                   + NCHAR(13) + NCHAR(10) + N'IF OBJECT_ID('''+SchemaName + N'.' + QUOTENAME(x.name)+N''') IS NULL'
                   + NCHAR(13) + NCHAR(10) + N'BEGIN'
                   + CASE WHEN x.major_id != -1 
                          THEN NCHAR(13) + NCHAR(10) + N'    EXEC sp_dropextendedproperty ''tSQLt.FakeTable_OrgTableName'',''SCHEMA'',''' 
                             + PARSENAME(SchemaName,1) + N''',''TABLE'',''' + OriginalName + N''';'
                          ELSE ''
                     END
                   + NCHAR(13) + NCHAR(10) + N'    DELETE tSQLt.Private_RenamedObjectLog WHERE Id = ' + CAST(x.Id AS nvarchar) + N';'
                   + NCHAR(13) + NCHAR(10) + N'END'
           END
         + NCHAR(13) + NCHAR(10)
         + NCHAR(13) + NCHAR(10)
    FROM x;
  
  
  --PRINT @cmd;
  EXEC (@cmd);
  `,
  });

  debugLog(chalk.cyanBright('SQLMock :'), chalk.cyan('cleared all mock tables'));
};

class SQLMock {
  constructor(db) {
    const dbSplit = db.url.split('/').filter(Boolean);
    const dbParts = dbSplit[1].split(':');
    this.db = [...dbParts, dbSplit[2], db.username, db.password];
  }

  async init() {
    this.config = {
      server: this.db[0],
      port: parseInt(this.db[1], 10),
      database: this.db[2],
      user: this.db[3] || 'dbdeploy',
      password: this.db[4] || 'l337m4573R',
      connectionTimeout: 60000,
      requestTimeout: 80000,
      options: { encrypt: true, trustServerCertificate: true },
    };
    debugLog(chalk.blackBright.bold('Test:'), chalk.blackBright(expect.getState().currentTestName));
    debugLog(chalk.cyanBright('SQLMock :'), chalk.blue(`connecting to ${this.config.server}/${this.config.database}`));
    await cleanUpSQLFixtures(this.config);
    process.env.DRAW_SEQ_DIAGRAM = false;
    return this;
  }

  async loadSQLFixtures(fixtures) {
    this.loadedFixtures = [];
    fixtures.map((fixture, index) => {
      // eslint-disable-next-line no-mixed-operators
      const nth = (n) => ['st', 'nd', 'rd'][((n + 90) % 100 - 10) % 10 - 1] || 'th';
      return expect(fixture).toHaveValidSQLSchema(fixtureSchema, [`SQLMock : ${index + 1}${nth(index + 1)} fixture file has an issue, check import and file contents`]);
    });

    // eslint-disable-next-line no-restricted-syntax
    for (const fixture of fixtures) {
      const start = performance.now();

      let fixtureSQL = '';
      const enableIdentity = (fixture?.enableIdentity === true) ? '1' : '0';
      const enableComputedColumns = (fixture?.enableComputedColumns === true) ? '1' : '0';
      const enableConstraints = (fixture?.enableConstraints === true) ? '1' : '0';

      const createFakeTable = `\n\nEXEC tSQLt.FakeTable ${fixture.table.split('.').map((f) => `'${f}'`).join(',')},${enableIdentity},${enableComputedColumns},${enableConstraints}`;
      fixtureSQL += createFakeTable;
      const batchSize = 1000; // SQL Server limit is 1000

      // get all columns and give them null values
      const getTableColumns = await sqlMockExecute({
        config: this.config,
        sqlQuery: `SELECT name  FROM sys.columns WHERE object_id = OBJECT_ID('${fixture.table}') AND is_identity != 1`,
      });
      const columns = getTableColumns?.recordset?.map((t) => t.name);
      const columnsNullValues = columns.reduce((acc, item) => ({ ...acc, [item]: null }), {});

      fixture.data.map((c, idx) => {
        const dataMerged = { ...columnsNullValues, ...c };
        const insert = `\nINSERT INTO ${fixture.table} (${Object.keys(dataMerged).map((col) => `[${col.replace(/\[(.*?)\]/g, '$1')}]`).join(',')})\nVALUES`;

        let rowInsert = '';
        if ((idx === 0) || ((idx + 1) % batchSize === 0)) {
          rowInsert += insert; // start a new batch
        }
        // v.toString().startsWith('0x00') to allow for varbinary strings
        // v.toString().includes('getdate()') to allow for dynamic dates
        rowInsert += `\n\t(${Object.values(dataMerged).map((v) => (
          (v === null || v.toString().startsWith('0x') || v.toString().includes('getdate()'))
            ? `${v}`
            : `'${v.toString().replaceAll('\'', '\'\'')}'`
        )).join(',')})`;
        if (((idx + 2) % batchSize !== 0) && ((idx + 1) < fixture.data.length)) {
          rowInsert += ',';
        }
        fixtureSQL += rowInsert;
        return rowInsert;
      });
      try {
        await sqlMockExecute({ config: this.config, sqlQuery: fixtureSQL });
      } catch (err) {
        throw new Error(`${chalk.redBright('SQLMock: Fixture error ')}${chalk.red(fixture.table)}\n${chalk.red(err)}`);
      }
      this.loadedFixtures.push(fixture.table.replace(/\[(.*?)\]/g, '$1'));

      const end = performance.now();
      debugLog(chalk.cyanBright('SQLMock :'), chalk.cyan(`seeded ${fixture.table}`), 'took', chalk.yellowBright(`${(end - start).toFixed(0)} ms`));
    }
    return this;
  }

  async sqlExecute({
    name = undefined, params = [], showRowsAffected = false,
  }) {
    const result = await sqlQueryExecute({
      conf: this.config, name, params, showRowsAffected,
    });
    this.proc = name;
    return result;
  }

  async tearDown() {
    await cleanUpSQLFixtures(this.config);
    let allTables = [];
    let missingFixtures = [];
    if (this.proc) {
      const allDependencies = await dependencies({ config: this.config, name: this.proc });

      if (process.env.DRAW_SEQ_DIAGRAM !== 'false') {
        dependencyDiagram(allDependencies);
      }
      // eslint-disable-next-line no-unused-expressions
      (process.env.NODE_DEBUG) ? tableLog(allDependencies) : '';
      allTables = allDependencies.filter((f) => f.isTable === 1).map((r) => r.name).filter(Boolean);
      const expectedTables = [...new Set(allTables.map((m) => m.replace(/\[(.*?)\]/g, '$1')))].sort();
      missingFixtures = differenceWith(expectedTables, this.loadedFixtures, isEqual);
    }

    if (process.env.GENERATE_MOCK_TABLES && this.proc) {
      let importFixturesList = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const tableName of allTables) {
        const sqlConfig = commonConfig.config(process.env.GENERATE_MOCK_TABLES);

        const res = await sqlMockExecute({ config: sqlConfig, sqlQuery: `SELECT top 1 * FROM ${tableName}  TABLESAMPLE (10000 ROWS) ORDER BY NEWID();` });

        const tableFixture = {
          table: tableName,
          data: res.recordset.reduce((ac, a) => ({ ...ac, [a]: '' }), {}),
        };
        const formatName = camelCase(tableName.replace(/\[(.*?)\]/g, '$1'));
        if (!fs.existsSync(`./__acceptance__/fixtures/sql/${formatName}/RENAME-ME.json`)) {
          fs.outputFileSync(`./__acceptance__/fixtures/sql/${formatName}/RENAME-ME.json`, JSON.stringify(tableFixture, null, 2));
          importFixturesList += `  sql.${formatName}.renameMe,\n`;
          infoLog(`${chalk.yellowBright('SQLMock : Generated fixture for ')}${chalk.yellow(tableName)} from ${chalk.yellow(`${sqlConfig.server}/${sqlConfig.database}`)}`);
        }
      }
      infoLog(chalk.yellowBright(`---------------IMPORT THESE FIXTURES---------------\nawait sqlMock.loadSQLFixtures([\n${importFixturesList}]);\n---------------------------------------------`));
    }

    if (missingFixtures.length > 0) {
      const missingFixturesErrors = missingFixtures.map((x) => `${chalk.redBright('SQLMock: ')}${chalk.red(x)} ${chalk.redBright('Unmocked \u274C \n')}`).join('');
      throw new Error(missingFixturesErrors);
    }
    return this;
  }
}

module.exports = SQLMock;
