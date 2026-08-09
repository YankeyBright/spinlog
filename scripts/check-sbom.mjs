import { readFileSync } from 'node:fs'

import { validateSbom } from './sbom-policy.mjs'

const bom = JSON.parse(readFileSync('sbom.json', 'utf8'))
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const failures = validateSbom(bom, packageJson)

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`sbom: ${failure}`)
  }
  process.exit(1)
}

console.log('sbom=valid')
