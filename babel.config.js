module.exports = api => {
  // Tests import @env from __mocks__/env.js (jest.config.js), which points at a mock project. The
  // plugin would otherwise inline .env, or the live project's defaults, into the code under test.
  const test = api.env('test');
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: test
      ? []
      : [
          [
            'module:react-native-dotenv',
            {
              // Values from .env are built into the app (README: Configuration). Only public values
              // belong there; the service role key never does.
              moduleName: '@env',
              path: '.env',
              safe: false,
              allowUndefined: true,
            },
          ],
        ],
  };
};
