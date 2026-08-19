import { parseDocument } from 'yaml'

import { sortCanonicalText } from './canonical-order.mjs'

const PINNED_ACTION = /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/
const ALLOWED_ACTIONS = new Set([
  'actions/checkout',
  'actions/download-artifact',
  'actions/setup-node',
  'actions/upload-artifact',
])
const CI_CONCURRENCY_GROUP = `ci-\${{ github.workflow }}-\${{ github.ref }}`
const WORKFLOW_NAMES = ['ci.yml', 'release-readiness.yml']
const READINESS_COMMANDS = new Set([
  'npm ci --ignore-scripts',
  'npm run check:phases',
  'npm run verify:release',
  'npm audit --audit-level=low',
  'npm pack --dry-run --json --ignore-scripts',
])
const CI_COMMANDS = new Set([
  'npm ci --ignore-scripts',
  'npm run check:phases',
  'npm audit --audit-level=low',
  'npm run build\nnpm run test:consumer\nnpm run pack:check',
  'npm run build\nnpm run benchmark',
  'node bench/aggregate-baseline.mjs artifacts/phase3/baseline-runs/phase3-baseline-run-1/benchmark.json artifacts/phase3/baseline-runs/phase3-baseline-run-2/benchmark.json artifacts/phase3/baseline-runs/phase3-baseline-run-3/benchmark.json artifacts/phase3/baseline-runs/phase3-baseline-run-4/benchmark.json artifacts/phase3/baseline-runs/phase3-baseline-run-5/benchmark.json --out artifacts/phase3/baseline-candidate.json',
  'npm run verify:candidate',
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
  const consumer = workflow.jobs?.['cross-platform']
  if (!equals(quality?.strategy?.matrix?.['node-version'], ['22.13.0', '22.x', '24.0.0', '24.x'])) {
    failures.push('ci.yml quality must test the complete supported Node matrix')
  }
  if (!equals(consumer?.strategy?.matrix?.os, ['windows-latest', 'macos-latest'])) {
    failures.push('ci.yml consumer job must test Windows and macOS')
  }
  if (!equals(consumer?.strategy?.matrix?.['node-version'], ['22.13.0', '24.x'])) {
    failures.push('ci.yml consumer job must test minimum and current Node versions')
  }
  const baselineRun = workflow.jobs?.['benchmark-baseline-run']
  const baselineCandidate = workflow.jobs?.['benchmark-baseline-candidate']
  const candidate = workflow.jobs?.candidate
  if (!equals(baselineRun?.strategy?.matrix?.slot, [1, 2, 3, 4, 5])) {
    failures.push('ci.yml must collect baseline inputs in five independent matrix slots')
  }
  if (!equals(baselineRun?.needs, ['quality', 'cross-platform']) || 'if' in (baselineRun ?? {})) {
    failures.push('ci.yml baseline inputs must run only after successful quality and consumer jobs')
  }
  if (baselineCandidate?.needs !== 'benchmark-baseline-run') {
    failures.push('ci.yml baseline candidate must aggregate only after all baseline inputs pass')
  }
  if (!equals(candidate?.needs, ['quality', 'cross-platform']) || 'if' in (candidate ?? {})) {
    failures.push('ci.yml candidate verification must fail closed after quality and consumer jobs')
  }
  if (JSON.stringify(workflow).includes('--out bench/baseline.json')) {
    failures.push('ci.yml must never overwrite the committed benchmark baseline')
  }
  validateCommands(workflow, 'ci.yml', CI_COMMANDS, failures)
}

function validateReadiness(workflow, failures) {
  if (!equals(workflow.on, { workflow_dispatch: null })) {
    failures.push('release-readiness.yml must be manual only')
  }
  validateReadOnly(workflow, 'release-readiness.yml', failures)
  if (workflow.jobs?.verify?.['runs-on'] !== 'ubuntu-latest') {
    failures.push('release-readiness.yml must use the frozen Linux verification runner')
  }
  const setup = steps(workflow).find(
    (step) => typeof step.uses === 'string' && step.uses.startsWith('actions/setup-node@'),
  )
  if (
    setup?.with?.['node-version'] !== '24.x' ||
    setup?.with?.['package-manager-cache'] !== false ||
    'cache' in (setup?.with ?? {})
  ) {
    failures.push('release-readiness.yml must use Node 24 with package-manager caching disabled')
  }
  validateCommands(workflow, 'release-readiness.yml', READINESS_COMMANDS, failures)
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
    failures.push('pre-Phase-5 workflows must be exactly ci.yml and release-readiness.yml')
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
  validateReadiness(parsed['release-readiness.yml'], failures)
  for (const [name, workflow] of Object.entries(parsed)) validateActions(workflow, name, failures)
  return [...new Set(failures)]
}
