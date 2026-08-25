import { isDeepStrictEqual } from 'node:util'

const FREEZE = Object.freeze({
  schemaVersion: 3,
  package: 'spinlog',
  version: '0.2.0',
  repository: 'YankeyBright/spinlog',
  status: 'blocked',
  reason:
    'The pre-1.0 0.2 target-local rendering redesign changed runtime, contracts, terminal evidence, benchmarks, and package inputs after the prior preview receipt.',
})
const BLOCKED_PUBLICATION = Object.freeze({
  version: '0.2.0',
  tag: 'v0.2.0',
  distTag: 'next',
  registry: 'https://registry.npmjs.org/',
})
const REQUIRED_REVALIDATION = Object.freeze([
  'Review the pre-1.0 0.2 Phase 0 contract and Phase 2 runtime behavior.',
  'Complete three consecutive full green test runs, including target-local terminal coverage.',
  'Commit a new five-run Linux Node 24 benchmark baseline.',
  'Regenerate Phase 3 reproducibility, SBOM, consumer, and candidate evidence.',
  'Complete the Phase 4 documentation review.',
  'Create a new reviewed preview-release policy before restoring publication workflows.',
])
const READINESS_COMMAND = `npm run check:foundation
npm run check:phase3
npm run check:phase4
npm run test:stability`

/** Validate the explicit hold that supersedes the obsolete preview receipt. */
export function validatePreviewContract(contract, packageJson) {
  const failures = []
  for (const [key, expected] of Object.entries(FREEZE)) {
    if (!isDeepStrictEqual(contract?.[key], expected)) {
      failures.push(`release freeze ${key} must equal ${JSON.stringify(expected)}`)
    }
  }
  if (!isDeepStrictEqual(contract?.blockedPublication, BLOCKED_PUBLICATION)) {
    failures.push('release freeze must identify the blocked 0.2.0 next publication exactly')
  }
  if (!isDeepStrictEqual(contract?.requiredRevalidation, REQUIRED_REVALIDATION)) {
    failures.push('release freeze must list the complete revalidation sequence')
  }
  if (
    packageJson?.name !== FREEZE.package ||
    packageJson?.version !== FREEZE.version ||
    !isDeepStrictEqual(packageJson?.publishConfig, {
      access: 'public',
      provenance: true,
      registry: BLOCKED_PUBLICATION.registry,
      tag: BLOCKED_PUBLICATION.distTag,
    })
  ) {
    failures.push('package identity and future HTTPS preview configuration must remain frozen')
  }
  return failures
}

/** Validate that the temporary workflow can revalidate but cannot publish. */
export function validateReleaseWorkflows(workflows) {
  const failures = []
  const readiness = workflows?.['release-readiness.yml']
  if (!readiness) return ['release revalidation requires release-readiness.yml']

  if (!isDeepStrictEqual(readiness.on, { workflow_dispatch: null })) {
    failures.push('release-readiness.yml must be manual-only while publication is blocked')
  }
  if (!isDeepStrictEqual(readiness.permissions, { contents: 'read' })) {
    failures.push('release-readiness.yml must use read-only permissions')
  }
  const jobNames = Object.keys(readiness.jobs ?? {}).sort((left, right) =>
    left.localeCompare(right),
  )
  if (!isDeepStrictEqual(jobNames, ['verify'])) {
    failures.push('release-readiness.yml must contain only the revalidation job')
  }
  const job = readiness.jobs?.verify
  if (job?.['runs-on'] !== 'ubuntu-latest' || job?.['timeout-minutes'] !== 40) {
    failures.push('release-readiness.yml must use the reviewed Linux verification environment')
  }

  const commands = (job?.steps ?? []).flatMap((step) =>
    typeof step.run === 'string' ? [step.run.trim()] : [],
  )
  if (!commands.includes('npm ci --ignore-scripts') || !commands.includes(READINESS_COMMAND)) {
    failures.push(
      'release-readiness.yml must install safely and run the complete revalidation gate',
    )
  }
  for (const command of commands) {
    if (!['npm ci --ignore-scripts', READINESS_COMMAND].includes(command)) {
      failures.push('release-readiness.yml contains an unapproved command')
    }
  }

  const serialized = JSON.stringify(readiness)
  if (
    /\b(?:npm\s+publish|gh\s+release|actions\/attest|id-token|NPM_TOKEN|NODE_AUTH_TOKEN)\b/iu.test(
      serialized,
    )
  ) {
    failures.push(
      'release-readiness.yml must not contain publication, attestation, OIDC, or registry credentials',
    )
  }
  return [...new Set(failures)]
}

/** Preview-context validation remains a hard failure until a fresh release policy is approved. */
export function validatePreviewContext() {
  return ['preview publication is blocked pending the required revalidation sequence']
}
