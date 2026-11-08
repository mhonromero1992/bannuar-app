module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['android/', 'ios/', 'coverage/', 'node_modules/'],
  overrides: [
    {
      files: ['scripts/**/*.cjs', 'scripts/**/*.mjs', 'jest.setup.js', '__mocks__/**'],
      env: {node: true, jest: true},
    },
  ],
};
