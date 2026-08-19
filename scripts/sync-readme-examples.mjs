import { readFileSync, writeFileSync } from 'node:fs'

import { DOCUMENTED_EXAMPLES, synchronizeExamples } from './documentation-policy.mjs'

const check = process.argv.includes('--check')
const documentPaths = [...new Set(DOCUMENTED_EXAMPLES.map(({ document }) => document))]
const documents = Object.fromEntries(
  documentPaths.map((path) => [path, readFileSync(path, 'utf8')]),
)
const examples = Object.fromEntries(
  DOCUMENTED_EXAMPLES.map(({ path }) => [path, readFileSync(path, 'utf8')]),
)
const synchronized = synchronizeExamples(documents, examples)
const drifted = documentPaths.filter((path) => synchronized[path] !== documents[path])

if (check && drifted.length > 0) {
  throw new Error(`documentation examples are out of date: ${drifted.join(', ')}`)
}
if (!check) {
  for (const path of drifted) writeFileSync(path, synchronized[path])
}

console.log(`documentation-examples=${check ? 'pass' : 'updated'} files=${documentPaths.length}`)
