module.exports = {
  testTimeout: 30000,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testEnvironment: 'jsdom'
    },
    {
      displayName: 'selenium',
      testMatch: ['<rootDir>/tests/selenium/**/*.spec.js'],
      testEnvironment: 'node'
    }
  ]
};
