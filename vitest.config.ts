import { coverageConfigDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    hookTimeout: 120_000,
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['config/**', ...coverageConfigDefaults.exclude],
      reporter: ['text', ['json', { file: 'coverage-final.json' }]],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
        perFile: true,
        autoUpdate: false,
      },
    },
    include: ['test/**/*.test.ts'],
    exclude: ['dist', 'config'],
    fakeTimers: {
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    },
  },
})
