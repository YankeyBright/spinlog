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
const WORKFLOW_NAMES = [
  'ci.yml',
  'codeql.yml',
  'release-build.yml',
  'release-publish.yml',
  'release-readiness.yml',
]
const BASELINE_STATUS_OUTPUT = `\${{ steps.baseline.outputs.present }}`
const CANDIDATE_BASELINE_CONDITION = `\${{ needs.baseline-status.outputs.present == 'true' }}`
const SOURCE_COMMIT_EXPRESSION = `\${{ github.event.pull_request.head.sha || github.sha }}`
const BASELINE_STATUS_COMMAND = `if test -f bench/baseline.json; then
  echo "present=true" >> "$GITHUB_OUTPUT"
else
  echo "Committed benchmark baseline is absent; candidate verification is deferred."
  echo "present=false" >> "$GITHUB_OUTPUT"
fi`
const RELEASE_READ_PERMISSIONS = Object.freeze({ contents: 'read' })
const RELEASE_ATTEST_PERMISSIONS = Object.freeze({
  contents: 'read',
  'id-token': 'write',
  attestations: 'write',
})
const RELEASE_NODE_MATRIX = Object.freeze(['22.13.0', '24.19.0', '26.0.0'])
const RELEASE_CONSUMER_NODE_MATRIX = Object.freeze(['22.13.0', '24.x', '26.x'])
const RELEASE_CONSUMER_OS_MATRIX = Object.freeze([
  'ubuntu-latest',
  'windows-latest',
  'macos-latest',
])
const MATRIX_OS_EXPRESSION = '$' + '{{ matrix.os }}'
const RELEASE_COMMANDS = new Set([
  'npm ci --ignore-scripts',
  'npm run check:foundation\nnpm run check:phase4\nnpm run test:stability',
  'npm audit --audit-level=low',
  'echo "NPM_VERSION=$(npm --version)" >> "$GITHUB_ENV"',
  'npm run verify:preview\nnpm run check:release-ancestry\nnpm run check:phase3\nnpm run check:phase5',
  "npm run build\nnpm run sbom\nnpm run pack:check\nnode -e \"require('fs').mkdirSync('artifacts/release',{recursive:true})\"\nnpm pack --json --ignore-scripts --pack-destination artifacts/release\nnode scripts/create-release-manifest.mjs artifacts/release\nnode scripts/verify-release-artifact.mjs artifacts/release\nnode scripts/verify-packed-runtime.mjs artifacts/release",
  'node scripts/verify-packed-runtime.mjs artifacts/release',
  'node scripts/verify-release-artifact.mjs artifacts/release',
])
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
  return Object.values(workflow?.jobs ?? {}).flatMap((job) => job?.steps ?? [])
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
  const quality = workflow?.jobs?.quality
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
  const baselineMeasure = steps({ jobs: { baselineRun } }).find(
    (step) => step?.name === 'Build And Measure Baseline Input',
  )
  const candidateVerify = steps({ jobs: { candidate } }).find(
    (step) => step?.name === 'Verify Candidate Against The Committed Baseline',
  )
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
  if (
    !equals(baselineMeasure?.env, {
      BENCHMARK_RUN_SLOT: `\${{ matrix.slot }}`,
      BENCHMARK_SOURCE_COMMIT: SOURCE_COMMIT_EXPRESSION,
    }) ||
    !equals(candidateVerify?.env, { BENCHMARK_SOURCE_COMMIT: SOURCE_COMMIT_EXPRESSION })
  ) {
    failures.push('ci.yml benchmark evidence must use the immutable source commit SHA')
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

function hasAction(workflow, action) {
  const workflowSteps = workflow?.steps ?? steps(workflow)
  return workflowSteps.some(
    (step) => typeof step.uses === 'string' && step.uses.split('@')[0] === action,
  )
}

function hasCommand(job, fragment) {
  return (job?.steps ?? []).some(
    (step) => typeof step.run === 'string' && step.run.trim().includes(fragment),
  )
}

function validateReleaseBuild(workflow, failures) {
  const call = workflow?.on?.workflow_call
  if (!call || typeof call !== 'object' || Array.isArray(call)) {
    failures.push('release-build.yml must be a reusable workflow')
  }
  if (!equals(workflow?.permissions, RELEASE_READ_PERMISSIONS)) {
    failures.push('release-build.yml must grant only read-only contents by default')
  }
  const jobNames = sortCanonicalText(Object.keys(workflow?.jobs ?? {}))
  if (!equals(jobNames, ['attest', 'consumer', 'package', 'quality'])) {
    failures.push('release-build.yml must contain quality, package, consumer, and attest jobs only')
  }

  const quality = workflow.jobs?.quality
  if (
    quality?.['runs-on'] !== 'ubuntu-latest' ||
    quality?.['timeout-minutes'] !== 35 ||
    !equals(quality?.strategy?.matrix?.['node-version'], RELEASE_NODE_MATRIX) ||
    quality?.needs !== undefined
  ) {
    failures.push('release-build.yml quality must cover Node 22, 24, and 26 before packaging')
  }

  const packageJob = workflow?.jobs?.package
  if (
    packageJob?.needs !== 'quality' ||
    packageJob?.['runs-on'] !== 'ubuntu-latest' ||
    packageJob?.['timeout-minutes'] !== 25
  ) {
    failures.push('release-build.yml package must run on Node 24 after the quality matrix')
  }
  if (
    !(packageJob?.steps ?? steps(packageJob)).some(
      (step) =>
        step.uses?.startsWith('actions/setup-node@') && step.with?.['node-version'] === '24.19.0',
    )
  ) {
    failures.push('release-build.yml package must use Node 24.19.0')
  }

  const consumer = workflow?.jobs?.consumer
  if (
    consumer?.needs !== 'package' ||
    consumer?.['runs-on'] !== MATRIX_OS_EXPRESSION ||
    consumer?.['timeout-minutes'] !== 15 ||
    !equals(consumer?.strategy?.matrix?.os, RELEASE_CONSUMER_OS_MATRIX) ||
    !equals(consumer?.strategy?.matrix?.['node-version'], RELEASE_CONSUMER_NODE_MATRIX)
  ) {
    failures.push(
      'release-build.yml consumer must verify the packed runtime on Node 22, 24, and 26',
    )
  }

  const attest = workflow?.jobs?.attest
  if (
    !equals(attest?.needs, ['package', 'consumer']) ||
    attest?.['runs-on'] !== 'ubuntu-latest' ||
    attest?.['timeout-minutes'] !== 10 ||
    !equals(attest?.permissions, RELEASE_ATTEST_PERMISSIONS)
  ) {
    failures.push(
      'release-build.yml attestation must wait for consumers with minimal write permissions',
    )
  }
  if (
    !hasAction(attest, 'actions/download-artifact') ||
    !hasAction(attest, 'actions/attest') ||
    !hasAction(attest, 'actions/upload-artifact')
  ) {
    failures.push(
      'release-build.yml must download, attest, and upload the verified release artifact',
    )
  }
  if (!hasAction(packageJob, 'actions/upload-artifact')) {
    failures.push(
      'release-build.yml package must upload the candidate artifact for consumer verification',
    )
  }
  for (const command of [
    'npm pack --json --ignore-scripts --pack-destination artifacts/release',
    'node scripts/create-release-manifest.mjs artifacts/release',
    'node scripts/verify-release-artifact.mjs artifacts/release',
    'node scripts/verify-packed-runtime.mjs artifacts/release',
  ]) {
    if (!hasCommand(packageJob, command)) {
      failures.push(`release-build.yml package must run ${command}`)
    }
  }
  if (!hasCommand(attest, 'node scripts/verify-release-artifact.mjs artifacts/release')) {
    failures.push('release-build.yml attestation must reverify the manifest and integrity')
  }
  if (
    !(attest?.steps ?? steps(attest)).some(
      (step) =>
        step.uses?.startsWith('actions/attest@') &&
        step.with?.['subject-path'] === 'artifacts/release/spinlog-0.2.0.tgz',
    )
  ) {
    failures.push('release-build.yml attestation must cover the exact 0.2.0 tarball')
  }

  validateCommands(workflow, 'release-build.yml', RELEASE_COMMANDS, failures)
  const serialized = JSON.stringify(workflow)
  if (
    /\b(?:npm\s+publish|gh\s+release|NPM_TOKEN|NODE_AUTH_TOKEN|registry-url)\b/iu.test(
      serialized,
    ) ||
    findKeys(workflow, new Set(['environment', 'secrets'])).length > 0
  ) {
    failures.push(
      'release-build.yml must not publish, use tokens, select latest, or use a release environment',
    )
  }
}

function validateReleasePublish(workflow, failures) {
  if (!equals(workflow?.on, { push: { tags: ['v0.2.0'] } })) {
    failures.push('release-publish.yml must trigger only on the immutable v0.2.0 tag')
  }
  if (!equals(workflow?.permissions, RELEASE_READ_PERMISSIONS)) {
    failures.push('release-publish.yml must grant only read-only contents by default')
  }
  const jobNames = sortCanonicalText(Object.keys(workflow?.jobs ?? {}))
  if (!equals(jobNames, ['release-build'])) {
    failures.push('release-publish.yml must contain only the reusable release-build caller')
  }
  const caller = workflow?.jobs?.['release-build']
  if (
    caller?.uses !== './.github/workflows/release-build.yml' ||
    !equals(caller?.permissions, RELEASE_ATTEST_PERMISSIONS) ||
    'environment' in (caller ?? {}) ||
    'secrets' in (caller ?? {}) ||
    'steps' in (caller ?? {})
  ) {
    failures.push('release-publish.yml must call the reviewed builder without publish credentials')
  }
  const serialized = JSON.stringify(workflow)
  if (
    /\b(?:npm\s+publish|gh\s+release|NPM_TOKEN|NODE_AUTH_TOKEN|latest|registry-url)\b/iu.test(
      serialized,
    ) ||
    findKeys(workflow, new Set(['environment', 'secrets'])).length > 0
  ) {
    failures.push('release-publish.yml bootstrap must not publish, use tokens, or select latest')
  }
}

export function validateReleaseAutomationWorkflows(workflows) {
  const failures = []
  validateReleaseBuild(workflows?.['release-build.yml'], failures)
  validateReleasePublish(workflows?.['release-publish.yml'], failures)
  return [...new Set(failures)]
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
    failures.push(
      'workflows must be exactly ci.yml, codeql.yml, release-build.yml, release-publish.yml, and release-readiness.yml',
    )
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
  failures.push(...validateReleaseAutomationWorkflows(parsed))
  for (const [name, workflow] of Object.entries(parsed)) validateActions(workflow, name, failures)
  return [...new Set(failures)]
}
