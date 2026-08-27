import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

import { buildTransactionalOutput } from './build-output.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(projectRoot, 'dist')

await buildTransactionalOutput({
  projectRoot,
  outputDirectory,
  async build(stagingDirectory) {
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
      outdir: stagingDirectory,
      minify: true,
      treeShaking: true,
      sourcemap: 'linked',
      sourcesContent: true,
      legalComments: 'none',
      external: ['node:*'],
      logLevel: 'info',
    })
  },
})
