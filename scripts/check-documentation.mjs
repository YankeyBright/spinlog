import { existsSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

import { DOCUMENTED_EXAMPLES, validateDocumentation } from './documentation-policy.mjs'

const documentPaths = ['README.md', 'MIGRATION.md']
const documents = Object.fromEntries(
  documentPaths.map((path) => [path, readFileSync(path, 'utf8')]),
)
const examples = Object.fromEntries(
  DOCUMENTED_EXAMPLES.map(({ path }) => [path, readFileSync(path, 'utf8')]),
)
const linkedPaths = new Set(
  [
    ...documentPaths,
    ...DOCUMENTED_EXAMPLES.map(({ path }) => path),
    'LICENSE',
    'SECURITY.md',
    'specs/v1-public-api.d.ts',
    'specs/v1-styles-api.d.ts',
    'specs/v1-behavior.json',
  ].filter(existsSync),
)
const failures = validateDocumentation({
  availablePaths: linkedPaths,
  contract: JSON.parse(readFileSync('specs/v1-behavior.json', 'utf8')),
  documents,
  examples,
  packageJson: JSON.parse(readFileSync('package.json', 'utf8')),
  runtimeSbom: JSON.parse(readFileSync('sbom.json', 'utf8')),
  sizeBytes: gzipSync(readFileSync('dist/index.js'), { level: 9 }).length,
})

if (failures.length > 0) {
  for (const failure of failures) console.error(`documentation: ${failure}`)
  process.exit(1)
}

console.log(`documentation=pass examples=${DOCUMENTED_EXAMPLES.length}`)
