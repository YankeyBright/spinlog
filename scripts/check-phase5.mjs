import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { sortCanonicalText } from './canonical-order.mjs'
import { parseWorkflow } from './workflow-policy.mjs'
import { validatePreviewContract, validateReleaseWorkflows } from './release-policy.mjs'

const failures = []
const readText = (path) => readFileSync(path, 'utf8')
const packageJson = JSON.parse(readText('package.json'))
const contract = JSON.parse(readText('specs/phase5-preview.json'))
const workflowDirectory = '.github/workflows'
const expectedWorkflows = ['ci.yml', 'codeql.yml', 'release-readiness.yml']
const workflowNames = sortCanonicalText(
  readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/u.test(name)),
)

if (JSON.stringify(workflowNames) !== JSON.stringify(sortCanonicalText(expectedWorkflows))) {
  failures.push('Phase 5 workflows must be exactly ci.yml, codeql.yml, and release-readiness.yml')
}

const workflows = {}
for (const name of expectedWorkflows) {
  const path = `${workflowDirectory}/${name}`
  if (!existsSync(path)) {
    failures.push(`missing Phase 5 workflow: ${path}`)
    continue
  }
  const parsed = parseWorkflow(readText(path), name)
  failures.push(...parsed.failures)
  workflows[name] = parsed.value
}

failures.push(
  ...validatePreviewContract(contract, packageJson),
  ...validateReleaseWorkflows(workflows),
)

if (failures.length > 0) {
  for (const failure of new Set(failures)) console.error(`phase5: ${failure}`)
  process.exitCode = 1
} else {
  console.log('phase5=hold')
}
