import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { NPM_SBOM_ARGUMENTS } from './generate-sbom.mjs'
import { sortCanonicalText } from './canonical-order.mjs'
import { validateSbom } from './sbom-policy.mjs'
import { validateWorkflowPolicy } from './workflow-policy.mjs'

const failures = []
const readText = (path) => readFileSync(path, 'utf8')
const packageJson = JSON.parse(readText('package.json'))
const bom = JSON.parse(readText('sbom.json'))
const workflowDirectory = '.github/workflows'
const workflowNames = sortCanonicalText(
  readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name)),
)
const workflows = Object.fromEntries(
  workflowNames.map((name) => [name, readText(`${workflowDirectory}/${name}`)]),
)

if (Number(process.versions.node.split('.')[0]) < 22)
  failures.push('Phase 1 release checks require Node >=22')
if (existsSync(`${workflowDirectory}/release.yml`))
  failures.push('release.yml must not exist before Phase 5')
if (packageJson.scripts?.sbom !== 'node scripts/generate-sbom.mjs') {
  failures.push('sbom script must use the checked-in npm SBOM adapter')
}
if ('@cyclonedx/cyclonedx-npm' in (packageJson.devDependencies ?? {})) {
  failures.push('the native npm SBOM adapter must not retain the external CycloneDX wrapper')
}
for (const argument of [
  'sbom',
  '--package-lock-only',
  '--omit=dev',
  '--omit=optional',
  '--omit=peer',
  '--sbom-format=cyclonedx',
  '--sbom-type=library',
]) {
  if (!NPM_SBOM_ARGUMENTS.includes(argument)) failures.push(`npm SBOM adapter must use ${argument}`)
}
failures.push(...validateSbom(bom, packageJson), ...validateWorkflowPolicy(workflows))

for (const path of [
  '.github/CODEOWNERS',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/dependabot.yml',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  'CHANGELOG.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'SUPPORT.md',
]) {
  if (!existsSync(path) || readText(path).trim() === '')
    failures.push(`${path} must be present and non-empty`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`phase1-release: ${failure}`)
  process.exitCode = 1
} else {
  console.log('phase1-release=pass')
}
