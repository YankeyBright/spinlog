import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'

export function digestFile(path) {
  const contents = readFileSync(path)
  return {
    sha256: createHash('sha256').update(contents).digest('hex'),
    sha512: createHash('sha512').update(contents).digest('hex'),
    size: statSync(path).size,
  }
}

export function writeCanonicalJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
