import { existsSync, readFileSync } from 'node:fs'

const failures = []
const contract = JSON.parse(readFileSync('specs/v1-behavior.json', 'utf8'))
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

for (const path of ['README.md', 'MIGRATION.md', 'examples', 'dist/index.js', 'sbom.json']) {
  if (!existsSync(path)) failures.push(`missing Phase 4 evidence: ${path}`)
}
if (contract.schemaVersion !== 6) failures.push('Phase 4 requires behavior schema version 6')
if (
  JSON.stringify(contract.publicApi?.callableMethods) !==
  JSON.stringify(['promise', 'intro', 'outro'])
) {
  failures.push('Phase 4 requires the exact documented callable methods')
}
if (
  (packageJson.files ?? []).includes('MIGRATION.md') ||
  (packageJson.files ?? []).includes('examples')
) {
  failures.push('public documentation additions must remain outside the npm payload')
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`phase4: ${failure}`)
  process.exit(1)
}

console.log('phase4=pass')
