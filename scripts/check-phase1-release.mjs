import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { NPM_SBOM_ARGUMENTS } from './generate-sbom.mjs'

const failures = []

function require(condition, message) {
  if (!condition) failures.push(message)
}

function readText(path) {
  if (!existsSync(path)) {
    failures.push(`missing required file: ${path}`)
    return ''
  }

  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    failures.push(`could not read ${path}: ${error.message}`)
    return ''
  }
}

function readObject(path) {
  try {
    const value = JSON.parse(readText(path))

    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      failures.push(`${path} must contain a JSON object`)
      return {}
    }

    return value
  } catch (error) {
    failures.push(`${path} must contain valid JSON: ${error.message}`)
    return {}
  }
}

const [major] = process.versions.node.split('.').map(Number)
require(major >= 22, 'Phase 1 release checks require Node >=22')

const packageJson = readObject('package.json')
const bom = readObject('sbom.json')
const ciWorkflow = readText('.github/workflows/ci.yml')
const readinessWorkflow = readText('.github/workflows/release-readiness.yml')
const governanceDocuments = Object.fromEntries(
  [
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
  ].map((path) => [path, readText(path)]),
)
const workflowNames = existsSync('.github/workflows')
  ? readdirSync('.github/workflows')
      .filter((name) => /\.ya?ml$/.test(name))
      .sort()
  : []
const components = Array.isArray(bom.components) ? bom.components : []
const metadataProperties = bom.metadata?.properties
const isReproducible =
  Array.isArray(metadataProperties) &&
  metadataProperties.some(({ name, value }) => name === 'cdx:reproducible' && value === 'true')

require(!existsSync('.github/workflows/release.yml'), 'release.yml must not exist before Phase 5')
require(JSON.stringify(workflowNames) ===
  JSON.stringify([
    'ci.yml',
    'release-readiness.yml',
  ]), 'pre-Phase-5 workflows must be exactly ci.yml and release-readiness.yml')
require(packageJson.scripts?.sbom ===
  'node scripts/generate-sbom.mjs', 'sbom script must use the checked-in npm SBOM adapter')
require(!(
  '@cyclonedx/cyclonedx-npm' in (packageJson.devDependencies ?? {})
), 'the native npm SBOM adapter must not retain the external CycloneDX wrapper')

for (const value of [
  'sbom',
  '--package-lock-only',
  '--omit=dev',
  '--omit=optional',
  '--omit=peer',
  '--sbom-format=cyclonedx',
  '--sbom-type=library',
]) {
  require(NPM_SBOM_ARGUMENTS.includes(value), `npm SBOM adapter must use ${value}`)
}

require(bom.bomFormat === 'CycloneDX', 'sbom.json bomFormat must be CycloneDX')
require(bom.specVersion === '1.5', 'sbom.json specVersion must be 1.5')
require(bom.metadata?.component?.name === 'spinlog', 'SBOM component name must be spinlog')
require(bom.metadata?.component?.type === 'library', 'SBOM component type must be library')
require(bom.metadata?.component?.version ===
  packageJson.version, 'SBOM component version must match package.json')
require(isReproducible, 'SBOM must declare reproducible output')
require(components.length === 0, `SBOM components must be empty, found ${components.length}`)

for (const [path, contents] of Object.entries(governanceDocuments)) {
  require(contents.trim().length > 0, `${path} must be present and non-empty`)
}
require(governanceDocuments['.github/CODEOWNERS'].includes(
  '* @YankeyBright',
), 'CODEOWNERS must assign a default owner')
for (const ecosystem of ['package-ecosystem: npm', 'package-ecosystem: github-actions']) {
  require(governanceDocuments['.github/dependabot.yml'].includes(
    ecosystem,
  ), `dependabot must configure ${ecosystem}`)
}
require(governanceDocuments['CONTRIBUTING.md'].includes(
  'npm run check:phases',
), 'contribution policy must require the aggregate phase gate')
require(governanceDocuments['.github/ISSUE_TEMPLATE/config.yml'].includes(
  '/security/advisories/new',
), 'issue configuration must route vulnerabilities to private advisories')

for (const value of [
  'EXPECTED_REPOSITORY: YankeyBright/spinlog',
  "node-version: ['22.13.0', '22.x', '24.0.0', '24.x']",
  'os: [windows-latest, macos-latest]',
  'timeout-minutes: 20',
  'cancel-in-progress: true',
  'npm ci --ignore-scripts',
  'npm run check:phases',
  'npm run test:consumer',
  'npm audit --audit-level=low',
]) {
  require(ciWorkflow.includes(value), `CI workflow must contain ${value}`)
}

for (const value of [
  'name: Release Readiness',
  'workflow_dispatch:',
  'permissions:',
  'contents: read',
  'timeout-minutes: 20',
  'EXPECTED_REPOSITORY: YankeyBright/spinlog',
  "node-version: '24.x'",
  'package-manager-cache: false',
  'persist-credentials: false',
  'npm ci --ignore-scripts',
  'npm run check:phases',
  'npm audit --audit-level=low',
  'npm pack --dry-run --json --ignore-scripts',
]) {
  require(readinessWorkflow.includes(value), `release readiness workflow must contain ${value}`)
}

for (const forbidden of [
  'push:',
  'tags:',
  'contents: write',
  'id-token: write',
  'environment: release',
  'registry-url:',
  'npm publish',
  'gh release create',
  'NPM_TOKEN',
  'NODE_AUTH_TOKEN',
  'GITHUB_TOKEN',
]) {
  require(!readinessWorkflow.includes(
    forbidden,
  ), `release readiness workflow must not contain ${forbidden}`)
}

const publicationPatterns = [
  [
    /^\s*(?:actions|attestations|checks|contents|deployments|discussions|id-token|issues|models|packages|pages|pull-requests|security-events|statuses):\s*write\s*$/m,
    'write permission',
  ],
  [/^\s*tags(?:-ignore)?:\s*$/m, 'tag trigger'],
  [/^\s*release:\s*$/m, 'release trigger'],
  [/\bnpm\s+(?:publish|unpublish|deprecate)\b/, 'npm publication command'],
  [/\bgh\s+release\b/, 'GitHub release command'],
  [/\bregistry-url\s*:/, 'registry authentication configuration'],
  [/\b(?:NPM_TOKEN|NODE_AUTH_TOKEN|GITHUB_TOKEN)\b/, 'publication credential'],
  [/\b(?:changesets\/action|action-gh-release|npm-publish)\b/i, 'publication action'],
]

for (const name of workflowNames) {
  const workflow = readText(`.github/workflows/${name}`)
  for (const [pattern, description] of publicationPatterns) {
    require(!pattern.test(workflow), `${name} must not contain ${description} before Phase 5`)
  }
}

const actionUseLines = `${ciWorkflow}\n${readinessWorkflow}`
  .split(/\r?\n/)
  .filter((line) => /\buses:\s/.test(line))
const pinnedAction = /^\s*uses:\s+\S+@[a-f0-9]{40}(?:\s+#.*)?\s*$/

require(actionUseLines.length > 0, 'workflows must use pinned GitHub Actions')
for (const line of actionUseLines) {
  require(pinnedAction.test(line), `workflow action must be pinned to a full SHA: ${line.trim()}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`phase1-release: ${failure}`)
  process.exit(1)
}

console.log('phase1-release=pass')
