import { readdirSync, readFileSync } from 'node:fs'

import { validatePackagePolicy } from './package-policy.mjs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const failures = validatePackagePolicy(packageJson, readdirSync('.'))

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure)
  }
  process.exit(1)
}

console.log('package-policy=valid')
