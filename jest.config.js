module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    "**/tests/**/*.ts"  // Tests are in ./tests directory with .ts extension
  ],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  testTimeout: 60000  // Longer timeout for Solana tests
};