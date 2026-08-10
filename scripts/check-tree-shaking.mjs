import { gzipSync } from 'node:zlib'

import { build } from 'esbuild'

async function bundle(contents, sourcefile) {
  const result = await build({
    stdin: { contents, resolveDir: process.cwd(), sourcefile },
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'node',
    treeShaking: true,
    logLevel: 'silent',
  })
  const output = result.outputFiles[0]?.contents
  if (!output) throw new Error(`esbuild produced no output for ${sourcefile}`)
  return gzipSync(output, { level: 9 }).byteLength
}

const stylesBytes = await bundle(
  "import { red } from './dist/styles.js'; console.log(red('value'))",
  'styles-consumer.mjs',
)
const rootBytes = await bundle(
  "import { red } from './dist/index.js'; console.log(red('value'))",
  'root-consumer.mjs',
)

if (stylesBytes > 400) {
  throw new Error(`single-style consumer bundle is ${stylesBytes} bytes gzip; limit is 400`)
}
if (stylesBytes * 3 >= rootBytes) {
  throw new Error('styles subpath must remain at least three times smaller than the root import')
}

console.log(`tree-shaking=pass styles=${stylesBytes} root=${rootBytes}`)
