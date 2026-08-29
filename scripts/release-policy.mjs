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
export const RELEASE_BOOTSTRAP = Object.freeze({
  schemaVersion: 1,
  package: 'spinlog',
  version: '0.2.0',
  repository: 'YankeyBright/spinlog',
  status: 'bootstrap-authorized',
  publication: {
    tag: 'v0.2.0',
    distTag: 'next',
    registry: 'https://registry.npmjs.org/',
    access: 'public',
    artifact: 'attested-downloaded-tarball-only',
    authentication: {
      bootstrap: 'human-2fa',
      future: 'npm-trusted-publishing-oidc-only',
    },
    provenance: {
      bootstrap: 'github-artifact-attestation',
      future: 'npm-oidc-provenance',
    },
    stablePromotion: 'prohibited',
    githubRelease: 'prohibited',
  },
  workflow: {
    builder: 'release-build.yml',
    publisher: 'release-publish.yml',
    environment: 'npm-publish',
    authorization: 'protected-environment-approval-required',
  },
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

/** Validate the reviewed one-time public preview bootstrap contract. */
export function validateReleaseBootstrapContract(contract, packageJson) {
  const failures = []
  if (!isDeepStrictEqual(contract, RELEASE_BOOTSTRAP)) {
    failures.push('release bootstrap must exactly match the approved 0.2.0 next contract')
  }
  if (
    contract?.publication?.tag !== 'v0.2.0' ||
    contract?.publication?.distTag !== 'next' ||
    contract?.publication?.registry !== 'https://registry.npmjs.org/' ||
    contract?.publication?.access !== 'public'
  ) {
    failures.push('release bootstrap must identify only the v0.2.0 next HTTPS publication target')
  }
  if (
    contract?.publication?.artifact !== 'attested-downloaded-tarball-only' ||
    contract?.publication?.authentication?.bootstrap !== 'human-2fa' ||
    contract?.publication?.provenance?.bootstrap !== 'github-artifact-attestation'
  ) {
    failures.push('release bootstrap must require an attested downloaded tarball and human 2FA')
  }
  if (
    contract?.publication?.stablePromotion !== 'prohibited' ||
    contract?.publication?.githubRelease !== 'prohibited' ||
    contract?.workflow?.environment !== 'npm-publish' ||
    contract?.workflow?.authorization !== 'protected-environment-approval-required'
  ) {
    failures.push(
      'release bootstrap must prohibit latest promotion and require protected-environment approval',
    )
  }
  if (
    packageJson?.name !== RELEASE_BOOTSTRAP.package ||
    packageJson?.version !== RELEASE_BOOTSTRAP.version ||
    !isDeepStrictEqual(packageJson?.publishConfig, {
      access: 'public',
      provenance: true,
      registry: RELEASE_BOOTSTRAP.publication.registry,
      tag: RELEASE_BOOTSTRAP.publication.distTag,
    })
  ) {
    failures.push(
      'package identity and HTTPS next publish configuration must match the release bootstrap',
    )
  }
  return [...new Set(failures)]
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

/** Validate the immutable GitHub tag context used for the bootstrap artifact. */
export function validatePreviewContext(environment = process.env, packageJson = {}) {
  const failures = []
  if (environment.GITHUB_ACTIONS !== 'true')
    failures.push('preview context requires GitHub Actions')
  if (environment.GITHUB_REPOSITORY !== RELEASE_BOOTSTRAP.repository) {
    failures.push(`preview context requires ${RELEASE_BOOTSTRAP.repository}`)
  }
  if (environment.GITHUB_REF_NAME !== RELEASE_BOOTSTRAP.publication.tag) {
    failures.push(`preview context requires the ${RELEASE_BOOTSTRAP.publication.tag} tag`)
  }
  if (!/^[0-9a-f]{40}$/u.test(environment.GITHUB_SHA ?? '')) {
    failures.push('preview context requires a full GitHub source commit')
  }
  if (environment.NPM_TOKEN || environment.NODE_AUTH_TOKEN) {
    failures.push('preview context must not expose npm publication credentials')
  }
  if (
    packageJson.name !== RELEASE_BOOTSTRAP.package ||
    packageJson.version !== RELEASE_BOOTSTRAP.version
  ) {
    failures.push('preview context package identity must match the release bootstrap')
  }
  return [...new Set(failures)]
}
