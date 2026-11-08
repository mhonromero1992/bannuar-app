module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.after.js'],
  moduleNameMapper: {
    '^@env$': '<rootDir>/__mocks__/env.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|@notifee|@react-native-firebase|@react-native-documents|styled-components)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/support/', '<rootDir>/__tests__/fixtures/'],
};
