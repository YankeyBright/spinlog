import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const limit = 4096
const bytes = gzipSync(readFileSync('dist/index.js'), { level: 9 }).byteLength

console.log(`size=${bytes}`)

if (bytes > limit) {
  console.error(`dist/index.js exceeds ${limit} bytes gzipped`)
  process.exit(1)
}
