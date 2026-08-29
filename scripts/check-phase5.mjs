import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { sortCanonicalText } from './canonical-order.mjs'
import { validateReleaseBootstrapContract, validatePreviewContract } from './release-policy.mjs'
import { validateWorkflowPolicy } from './workflow-policy.mjs'

const failures = []
const readText = (path) => readFileSync(path, 'utf8')
const packageJson = JSON.parse(readText('package.json'))
const previewContract = JSON.parse(readText('specs/phase5-preview.json'))
const releaseContract = JSON.parse(readText('specs/phase5-release.json'))
const workflowDirectory = '.github/workflows'
const expectedWorkflows = [
  'ci.yml',
  'codeql.yml',
  'release-build.yml',
  'release-publish.yml',
  'release-readiness.yml',
]
const workflowNames = sortCanonicalText(
  readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/u.test(name)),
)

if (JSON.stringify(workflowNames) !== JSON.stringify(sortCanonicalText(expectedWorkflows))) {
  failures.push(
    'Phase 5 workflows must be exactly ci.yml, codeql.yml, release-build.yml, release-publish.yml, and release-readiness.yml',
  )
}

const workflowSources = {}
for (const name of expectedWorkflows) {
  const path = `${workflowDirectory}/${name}`
  if (!existsSync(path)) {
    failures.push(`missing Phase 5 workflow: ${path}`)
    continue
  }
  workflowSources[name] = readText(path)
}

failures.push(
  ...validatePreviewContract(previewContract, packageJson),
  ...validateReleaseBootstrapContract(releaseContract, packageJson),
  ...validateWorkflowPolicy(workflowSources),
)

if (failures.length > 0) {
  for (const failure of new Set(failures)) console.error(`phase5: ${failure}`)
  process.exitCode = 1
} else {
  console.log('phase5=bootstrap-authorized')
}
