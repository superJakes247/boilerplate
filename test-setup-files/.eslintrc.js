module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true,
  },
  plugins: ['jest'],
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'max-len': 0,
    'no-empty-pattern': 0,
    'global-require': 0,
    'import/prefer-default-export': 0,
    'import/no-extraneous-dependencies': 0,
    'no-undef': 1,
    'no-restricted-globals': 1,
    'import/no-named-default': 0,
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
  },
};
