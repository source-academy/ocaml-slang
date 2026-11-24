/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@sourceacademy/conductor/common$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/common/index.js",
    "^@sourceacademy/conductor/conduit$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conduit/index.js",
    "^@sourceacademy/conductor/types$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/types/index.js",
    "^@sourceacademy/conductor/util$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/util/index.js",
    "^@sourceacademy/conductor/module$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/module/index.js",
    "^@sourceacademy/conductor/runner$":
      "<rootDir>/node_modules/@sourceacademy/conductor/dist/conductor/runner/index.js",
  },
  transformIgnorePatterns: [
    "<rootDir>/dist/",
    "/node_modules/(?!@sourceacademy/conductor/).+\\.js$",
  ],
};
