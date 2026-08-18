export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.mjs" },
  reporters: ["clear-text", "html", "progress"],
  testFiles: ["apps/**/*.test.ts"],
  mutate: [
    "apps/cms/src/**/*.ts",
    "apps/web/src/**/*.ts",
    "apps/web/src/**/*.tsx",
  ],
  incremental: true,
  incrementalFile: ".stryker/incremental.json",
  cleanTempDir: true,
};
