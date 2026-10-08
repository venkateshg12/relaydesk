import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  setupFiles: ["<rootDir>/src/__tests__/helpers/env.ts"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  // The files share Redis (rate limits, presence) and one Postgres: run them one after another.
  maxWorkers: 1,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ES2022",
          target: "ES2022",
          moduleResolution: "bundler",
          resolveJsonModule: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testTimeout: 35000,
  verbose: true,
};

export default config;
