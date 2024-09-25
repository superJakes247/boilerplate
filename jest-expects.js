const chalk = require('chalk');
const shortHash = require('hash-sum');
const { diff } = require('jest-diff');
const { toMatchSnapshot } = require('jest-snapshot');
const { toMatchImageSnapshot } = require('jest-image-snapshot');
const toJsonSchema = require('to-json-schema');
const { Validator } = require('jsonschema');

jest.setTimeout(30000);

const jsonLog = (json) => `${JSON.stringify(json, null, 2).substring(0, 3000)} \n ...`;

const validator = new Validator();
function preValidateProperty(object, key, schema, options, ctx) {
  const value = object[key];
  if (typeof value === 'undefined') return;

  // Test if the schema declares a type, but the type keyword fails validation
  if (schema.type && validator.attributes.type.call(validator, value, schema, options, ctx.makeChild(schema, key))) {
    // If the type is "number" but the instance is not a number, cast it
    if (schema.type === 'number' && typeof value !== 'number') {
      object[key] = parseFloat(value);
      return;
    }
    if (schema.type === 'integer' && typeof value !== 'interger') {
      object[key] = parseInt(value);
    }
  }
}

const validationHandler = (responseBody, schema, log) => {
  let message = () => ({});
  const responseBodyClone = JSON.parse(JSON.stringify(responseBody));
  const { errors } = validator.validate(responseBodyClone, schema, { preValidateProperty });
  if (errors.length > 0) {
    // eslint-disable-next-line prefer-destructuring
    const allErrors = errors.map((x) => `${x.path.join('.')} => ${x.message}`);
    message = () => `${chalk.red(jsonLog(allErrors))} \n
    log: index: ${chalk.gray(jsonLog(log))}`;
  }

  const pass = errors.length === 0;
  return { actual: responseBody, message, pass };
};

const sortArrayOfObjects = (arr) => arr.sort((a, b) => shortHash(a) - shortHash(b));

const toJsonOptions = {
  arrays: { mode: 'first' },
  objects: {
    postProcessFnc: (schema, obj, defaultFnc) => ({ ...defaultFnc(schema, obj), required: Object.getOwnPropertyNames(obj) }),
  },
};

module.exports = expect.extend({
  toHaveValidSchema(responseBody, schema, log = []) {
    if (!schema) {
      const generatedSchema = toJsonSchema(responseBody, toJsonOptions);
      throw new Error(chalk.red(`Schema should look like :\n ${chalk.gray(JSON.stringify(generatedSchema, null, 2))}`));
    }
    return validationHandler(responseBody, schema, [responseBody, log]);
  },
  toBe(received, expected, log = []) {
    const pass = Object.is(received, expected);
    const message = pass
      ? () => `${diff(expected, received)}  \n
        log:\n${chalk.gray(jsonLog(log))}`
      : () => `${diff(expected, received)}  \n
      log:\n${chalk.gray(jsonLog(log))}`;

    return { actual: received, message, pass };
  },
  toMatchArraySnapshot(arrayList, options = 'toMatchMessagesSnapshot') {
    const results = [];
    sortArrayOfObjects(arrayList).forEach((item) => {
      const result = toMatchSnapshot.call(this, item, options);
      results.push(result);
    });
    const checkFailures = results.filter((x) => x.pass === false)[0];
    if (checkFailures) {
      return checkFailures;
    }
    return results.filter((x) => x.pass === true)[0];
  },
  toMatchImageSnapshot,
});
