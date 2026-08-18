export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.mjs" },
  reporters: ["clear-text", "html", "progress"],
  testFiles: ["apps/**/*.test.ts"],
  mutate: ["apps/cms/src/blocks.ts", "apps/web/src/lib/cms.ts"],
  incremental: true,
  incrementalFile: ".stryker/incremental.json",
  concurrency: 1,
  ignorePatterns: ["**/.next/**", "**/.next-*/**", "reports/**", "data/**"],
  cleanTempDir: true,
};
