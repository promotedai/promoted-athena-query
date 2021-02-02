module.exports = {
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  transformIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!<rootDir>/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 100,
      lines: 95,
      statements: 95,
    },
  },
  coverageReporters: ['text'],
};
