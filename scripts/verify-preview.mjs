import { readFileSync } from 'node:fs'

import { validatePreviewContext, validateReleaseBootstrapContract } from './release-policy.mjs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const contract = JSON.parse(readFileSync('specs/phase5-release.json', 'utf8'))
const failures = [
  ...validateReleaseBootstrapContract(contract, packageJson),
  ...validatePreviewContext(process.env, packageJson),
]
if (
  process.env.npm_config_registry &&
  process.env.npm_config_registry !== 'https://registry.npmjs.org/'
) {
  failures.push('npm registry configuration must use HTTPS registry.npmjs.org')
}
if (Number.parseInt(process.versions.node, 10) !== 24)
  failures.push('preview builder must run on Node 24')

if (failures.length > 0) {
  for (const failure of new Set(failures)) console.error(`preview: ${failure}`)
  process.exitCode = 1
} else {
  console.log('preview-context=valid')
}
