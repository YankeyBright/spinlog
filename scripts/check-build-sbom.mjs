import { readFileSync } from 'node:fs'

import { BUILD_SBOM_PATH } from './generate-build-sbom.mjs'
import { validateBuildSbom } from './sbom-policy.mjs'

const bom = JSON.parse(readFileSync(BUILD_SBOM_PATH, 'utf8'))
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const failures = validateBuildSbom(bom, packageJson)

if (failures.length > 0) {
  for (const failure of failures) console.error(`build-sbom: ${failure}`)
  process.exitCode = 1
} else {
  console.log('build-sbom=valid')
}
