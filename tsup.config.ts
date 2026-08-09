import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  minify: true,
  sourcemap: false,
  dts: false,
  treeshake: true,
  clean: true,
  platform: 'node',
  target: 'node22',
})
