const chalk = require('chalk');
const sql = require('mssql');

let request;

async function sqlMockExecute({
  config, sqlQuery,
}) {
  try {
    await sql.close();

    const conn = await sql.connect(config);
    request = new sql.Request(conn);

    const result = await request.query(sqlQuery).catch((errors) => {
      const mainError = errors.originalError.info.message;
      if (process.env.NODE_DEBUG === 'debug') {
        const errorArray = [mainError];
        const precedingErrors = Object.values(errors.precedingErrors);
        precedingErrors.forEach((error) => {
          errorArray.push(error.originalError.info.message);
        });
        throw new Error(errorArray.join('\nError: '));
      } else {
        throw new Error(mainError);
      }
    });
    return result;
  } catch (err) {
    throw new Error(chalk.red(`${err}`));
  } finally {
    await sql.close();
  }
}

module.exports = sqlMockExecute;
