import { readFileSync, readdirSync, statSync } from 'node:fs'

import { validateHttpsPolicy } from './https-policy.mjs'

const roots = [
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'MIGRATION.md',
  'README.md',
  'SECURITY.md',
  'SUPPORT.md',
  'package.json',
  'sbom.json',
  'specs',
  'scripts',
  '.github/workflows',
]
const extensions = new Set(['.json', '.md', '.mjs', '.yml', '.yaml'])

function collect(path) {
  const info = statSync(path)
  if (info.isFile()) return extensions.has(path.slice(path.lastIndexOf('.'))) ? [path] : []
  return readdirSync(path).flatMap((name) => collect(`${path}/${name}`))
}

const sources = Object.fromEntries(
  roots.flatMap((path) => collect(path)).map((path) => [path, readFileSync(path, 'utf8')]),
)
const failures = validateHttpsPolicy(sources)

if (failures.length > 0) {
  for (const failure of failures) console.error(`https: ${failure}`)
  process.exitCode = 1
} else {
  console.log('https=valid')
}
