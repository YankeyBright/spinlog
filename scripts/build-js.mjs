import { rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, 'dist')

// Resolve cleanup from this script so invocation location cannot redirect it.
rmSync(outputDirectory, { force: true, recursive: true })

await build({
  absWorkingDir: projectRoot,
  entryPoints: {
    index: resolve(projectRoot, 'src/index.ts'),
    styles: resolve(projectRoot, 'src/styles.ts'),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22.13',
  outdir: outputDirectory,
  minify: true,
  treeShaking: true,
  sourcemap: 'linked',
  sourcesContent: true,
  legalComments: 'none',
  external: ['node:*'],
  logLevel: 'info',
})
