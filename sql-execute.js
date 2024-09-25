const sql = require('mssql');
const fs = require('fs-extra');
const chalk = require('chalk');
const { config } = require('../config');

chalk.enabled = true;
chalk.level = 3;

async function sqlExecute({
  db = 'mart', name, params = [], conf, showRowsAffected, requestTimeout,
}) {
  let result;
  let paramList;
  let hasOutputVariable = false;
  let sqlConfig;
  try {
    let response;
    await sql.close();
    sqlConfig = conf || config(db, { requestTimeout });

    const conn = await sql.connect(sqlConfig);
    const request = new sql.Request(conn);

    if (params) {
      params.forEach((param) => {
        if (param.output) {
          hasOutputVariable = true;
          if (param.name) {
            request.output(param.name, sql[param.type ? param.type : 'VarChar']());
          }
        } else {
          request.input(param.name, sql[param.type ? param.type : 'VarChar'](), param.value);
        }
      });
      paramList = `(${params.map((m) => `'${m.value}'`).join(',')})`;
    }

    const rawObjectType = await request.query(`SELECT type_desc FROM sys.objects WHERE object_id = OBJECT_ID(N'${name}')`);
    const objectType = rawObjectType.recordset[0].type_desc;

    switch (objectType) {
      case 'SQL_SCALAR_FUNCTION':
        response = await request.query(`SELECT ${name} ${paramList}`);
        break;
      case 'SQL_TABLE_VALUED_FUNCTION':
        response = await request.query(`SELECT * FROM ${name} ${paramList}`);
        break;
      case 'SQL_STORED_PROCEDURE':
        response = await request.execute(name);
        break;
      case 'VIEW':
        if (params.length > 0) {
          throw new Error('Error: parameters should not be passed to views');
        } else {
          response = await request.query(`SELECT * FROM ${name}`);
        }
        break;
      default:
        response = await request.query(`SELECT * FROM ${name} ${paramList}`);
    }

    if (showRowsAffected) {
      result = { recordset: response.recordset, rowsAffected: response.rowsAffected };
    } else {
      result = (hasOutputVariable) ? response.output : response.recordset;
    }

    return result;
  } catch (err) {
    throw new Error(`${chalk.redBright('Execute Error: ')}${chalk.red(err)}`);
  } finally {
    // eslint-disable-next-line no-unsafe-finally
    if (!name.includes('.')) throw new Error(`${chalk.redBright('Error: ')}${chalk.red('Schema is missing from the SP/View/Func name')} ${name}`);
    const [schema, coverageName] = (name).split('.');
    const path = './generated/stored-procedures/proc-execute.log.json';
    if (!fs.existsSync(path)) {
      fs.outputFileSync(path, '');
    }

    fs.appendFileSync(
      path,
      `${JSON.stringify({
        schema, name: coverageName, fullName: name, type: result?.type, db: sqlConfig.database, conf: JSON.stringify(sqlConfig),
      })}|`,
      { mode: 0o777 },
    );
    await sql.close();
  }
}

module.exports = sqlExecute;
