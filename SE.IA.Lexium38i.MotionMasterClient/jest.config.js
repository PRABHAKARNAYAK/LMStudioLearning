module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/source"],
  testMatch: ["**/source/tests/**/*.(ts|js)", "**/?(*.)+(spec|test).(ts|js)"],
  moduleFileExtensions: ["ts", "js", "json", "node"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["html", "lcov"],
  transformIgnorePatterns: ["/node_modules/(?!@LXM38I)"],
  transform: {
    "^.+\\.mjs$": "babel-jest",
    "^.+\\.(ts|js)$": "ts-jest",
  },
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};
