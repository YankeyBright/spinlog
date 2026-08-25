import { parseDocument } from 'yaml'

import { sortCanonicalText } from './canonical-order.mjs'
import { validateReleaseWorkflows } from './release-policy.mjs'

const PINNED_ACTION = /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)?@[a-f0-9]{40}$/
const ALLOWED_ACTIONS = new Set([
  'actions/checkout',
  'actions/download-artifact',
  'actions/setup-node',
  'actions/upload-artifact',
  'actions/attest',
  'github/codeql-action/init',
  'github/codeql-action/analyze',
])
const CI_CONCURRENCY_GROUP = `ci-\${{ github.workflow }}-\${{ github.ref }}`
const WORKFLOW_NAMES = ['ci.yml', 'codeql.yml', 'release-readiness.yml']
const BASELINE_STATUS_OUTPUT = `\${{ steps.baseline.outputs.present }}`
const CANDIDATE_BASELINE_CONDITION = `\${{ needs.baseline-status.outputs.present == 'true' }}`
const BASELINE_STATUS_COMMAND = `if test -f bench/baseline.json; then
  echo "present=true" >> "$GITHUB_OUTPUT"
else
  echo "Committed benchmark baseline is absent; candidate verification is deferred."
  echo "present=false" >> "$GITHUB_OUTPUT"
fi`
const CI_COMMANDS = new Set([
  'npm ci --ignore-scripts',
  'npm run check:foundation\nnpm run check:phase4\nnpm run test:stability',
  'npm audit --audit-level=low',
  "npm ci --ignore-scripts\nnpm run build\nnpm run sbom\nnpm run pack:check\nnode -e \"require('fs').mkdirSync('artifacts/package',{recursive:true})\"\nnpm pack --json --ignore-scripts --pack-destination artifacts/package",
  'node scripts/verify-packed-runtime.mjs artifacts/package',
  BASELINE_STATUS_COMMAND,
  'npm run build\nnpm run benchmark',
  'node bench/aggregate-baseline.mjs artifacts/phase3/baseline-runs/phase3-baseline-run-1/benchmark.json artifacts/phase3/baseline-runs/phase3-baseline-run-2/benchmark.json artifacts/phase3/baseline-runs/phase3-baseline-run-3/benchmark.json artifacts/phase3/baseline-runs/phase3-baseline-run-4/benchmark.json artifacts/phase3/baseline-runs/phase3-baseline-run-5/benchmark.json --out artifacts/phase3/baseline-candidate.json',
  'npm run verify:candidate\nnpm run check:phases',
])

function equals(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function steps(workflow) {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job?.steps ?? [])
}

function findKeys(value, names) {
  if (Array.isArray(value)) return value.flatMap((entry) => findKeys(entry, names))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, entry]) => [
    ...(names.has(key) ? [key] : []),
    ...findKeys(entry, names),
  ])
}

function validateActions(workflow, name, failures) {
  for (const step of steps(workflow)) {
    if (typeof step.uses === 'string' && !PINNED_ACTION.test(step.uses)) {
      failures.push(`${name} action must be pinned to a full SHA: ${step.uses}`)
    }
    if (typeof step.uses === 'string' && !ALLOWED_ACTIONS.has(step.uses.split('@')[0])) {
      failures.push(`${name} uses an unapproved action: ${step.uses}`)
    }
    if (typeof step.uses === 'string' && step.uses.startsWith('actions/cache@')) {
      failures.push(`${name} must not use a standalone cache action`)
    }
  }
}

function validateCommands(workflow, name, allowed, failures) {
  for (const step of steps(workflow)) {
    if (typeof step.run === 'string' && !allowed.has(step.run.trim())) {
      failures.push(`${name} contains an unapproved command in step: ${step.name ?? '<unnamed>'}`)
    }
  }
}

function validateReadOnly(workflow, name, failures) {
  if (!equals(workflow.permissions, { contents: 'read' })) {
    failures.push(`${name} permissions must be exactly contents: read`)
  }
  const restricted = findKeys(workflow, new Set(['id-token', 'environment', 'registry-url']))
  if (restricted.length > 0) failures.push(`${name} contains restricted release configuration`)
  const credentials = new Set(['NPM_TOKEN', 'NODE_AUTH_TOKEN', 'GITHUB_TOKEN'])
  if (
    findKeys(workflow, credentials).length > 0 ||
    /\b(?:NPM_TOKEN|NODE_AUTH_TOKEN|GITHUB_TOKEN)\b/.test(JSON.stringify(workflow))
  ) {
    failures.push(`${name} contains publication credentials`)
  }
}

function validateCi(workflow, failures) {
  if (
    !equals(workflow.on, { push: { branches: ['main'] }, pull_request: { branches: ['main'] } })
  ) {
    failures.push('ci.yml must trigger only for main push and pull requests')
  }
  validateReadOnly(workflow, 'ci.yml', failures)
  if (
    workflow.concurrency?.group !== CI_CONCURRENCY_GROUP ||
    workflow.concurrency?.['cancel-in-progress'] !== true
  ) {
    failures.push('ci.yml must use the frozen cancellation concurrency policy')
  }
  const quality = workflow.jobs?.quality
  const packedArtifact = workflow.jobs?.['packed-artifact']
  const consumer = workflow.jobs?.['packed-consumer']
  const baselineStatus = workflow.jobs?.['baseline-status']
  if (
    !equals(quality?.strategy?.matrix?.['node-version'], [
      '22.18.0',
      '22.x',
      '24.0.0',
      '24.x',
      '26.0.0',
      '26.x',
    ])
  ) {
    failures.push('ci.yml quality must test the complete supported Node matrix')
  }
  if (packedArtifact?.needs !== 'quality') {
    failures.push('ci.yml packed artifact must be built only after the quality matrix')
  }
  if (
    !equals(consumer?.strategy?.matrix?.os, ['ubuntu-latest', 'windows-latest', 'macos-latest'])
  ) {
    failures.push('ci.yml consumer job must test Ubuntu, Windows, and macOS')
  }
  if (!equals(consumer?.strategy?.matrix?.['node-version'], ['22.13.0', '24.x', '26.x'])) {
    failures.push('ci.yml consumer job must test the frozen runtime major matrix')
  }
  if (
    consumer?.needs !== 'packed-artifact' ||
    steps({ jobs: { consumer } }).some((step) => step.run === 'npm ci --ignore-scripts')
  ) {
    failures.push('ci.yml consumer job must install only the prebuilt packed runtime')
  }
  const baselineRun = workflow.jobs?.['benchmark-baseline-run']
  const baselineCandidate = workflow.jobs?.['benchmark-baseline-candidate']
  const candidate = workflow.jobs?.candidate
  const baselineReport = steps({ jobs: { baselineStatus } }).find((step) => step?.id === 'baseline')
  if (!equals(baselineRun?.strategy?.matrix?.slot, [1, 2, 3, 4, 5])) {
    failures.push('ci.yml must collect baseline inputs in five independent matrix slots')
  }
  if (!equals(baselineRun?.needs, ['quality', 'packed-consumer']) || 'if' in (baselineRun ?? {})) {
    failures.push('ci.yml baseline inputs must run only after successful quality and consumer jobs')
  }
  if (baselineCandidate?.needs !== 'benchmark-baseline-run') {
    failures.push('ci.yml baseline candidate must aggregate only after all baseline inputs pass')
  }
  if (
    baselineStatus?.['runs-on'] !== 'ubuntu-latest' ||
    baselineStatus?.outputs?.present !== BASELINE_STATUS_OUTPUT ||
    baselineReport?.run?.trim() !== BASELINE_STATUS_COMMAND
  ) {
    failures.push('ci.yml must report whether the reviewed benchmark baseline is committed')
  }
  if (
    !equals(candidate?.needs, ['quality', 'packed-consumer', 'baseline-status']) ||
    candidate?.if !== CANDIDATE_BASELINE_CONDITION
  ) {
    failures.push('ci.yml candidate verification must run only with a committed benchmark baseline')
  }
  if (JSON.stringify(workflow).includes('--out bench/baseline.json')) {
    failures.push('ci.yml must never overwrite the committed benchmark baseline')
  }
  if (/node-version:\s*(?:current|latest)/iu.test(JSON.stringify(workflow))) {
    failures.push('ci.yml must not use floating Current or latest Node aliases')
  }
  validateCommands(workflow, 'ci.yml', CI_COMMANDS, failures)
}

function validateCodeql(workflow, failures) {
  if (
    !equals(workflow.on, {
      push: { branches: ['main'] },
      pull_request: { branches: ['main'] },
      schedule: [{ cron: '30 2 * * 1' }],
    })
  ) {
    failures.push('codeql.yml must run on main changes, pull requests, and a weekly schedule')
  }
  if (!equals(workflow.permissions, { contents: 'read' })) {
    failures.push('codeql.yml top-level permissions must be exactly contents: read')
  }
  const analyze = workflow.jobs?.analyze
  if (
    analyze?.['runs-on'] !== 'ubuntu-latest' ||
    !equals(analyze?.permissions, { contents: 'read', 'security-events': 'write' })
  ) {
    failures.push('codeql.yml analysis must use least-privilege CodeQL permissions')
  }
}

export function parseWorkflow(source, name) {
  const document = parseDocument(source)
  if (document.errors.length > 0) {
    return {
      failures: document.errors.map((error) => `${name} is invalid YAML: ${error.message}`),
      value: {},
    }
  }
  const value = document.toJS()
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    return { failures: [`${name} must contain a YAML mapping`], value: {} }
  }
  return { failures: [], value }
}

export function validateWorkflowPolicy(sources) {
  const failures = []
  if (!equals(sortCanonicalText(Object.keys(sources)), WORKFLOW_NAMES)) {
    failures.push('workflows must be exactly ci.yml, codeql.yml, and release-readiness.yml')
    return failures
  }
  const parsed = Object.fromEntries(
    Object.entries(sources).map(([name, source]) => {
      const result = parseWorkflow(source, name)
      failures.push(...result.failures)
      return [name, result.value]
    }),
  )
  validateCi(parsed['ci.yml'], failures)
  validateCodeql(parsed['codeql.yml'], failures)
  failures.push(...validateReleaseWorkflows(parsed))
  for (const [name, workflow] of Object.entries(parsed)) validateActions(workflow, name, failures)
  return [...new Set(failures)]
}
