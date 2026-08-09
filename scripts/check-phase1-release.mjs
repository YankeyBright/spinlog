import { existsSync, readFileSync } from 'node:fs'

import { NPM_SBOM_ARGUMENTS } from './generate-sbom.mjs'

const failures = []

function require(condition, message) {
  if (!condition) {
    failures.push(message)
  }
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

function readJson(path) {
  try {
    return JSON.parse(readText(path))
  } catch (error) {
    failures.push(`${path} must contain valid JSON: ${error.message}`)
    return {}
  }
}

function readObject(path) {
  const value = readJson(path)

  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    failures.push(`${path} must contain a JSON object`)
    return {}
  }

  return value
}

const [major] = process.versions.node.split('.').map(Number)
require(major >= 22, 'Phase 1 release checks require Node >=22')

const packageJson = readObject('package.json')
const bom = readObject('sbom.json')
const ciWorkflow = readText('.github/workflows/ci.yml')
const releaseWorkflow = readText('.github/workflows/release.yml')
const repositoryPrivateContext = `REPOSITORY_PRIVATE: ${'$'}{{ github.event.repository.private }}`
const sbomCommand = packageJson.scripts?.sbom
const components = Array.isArray(bom.components) ? bom.components : []
const metadataProperties = bom.metadata?.properties
const isReproducible =
  Array.isArray(metadataProperties) &&
  metadataProperties.some(({ name, value }) => name === 'cdx:reproducible' && value === 'true')

require(sbomCommand ===
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

for (const value of [
  'EXPECTED_REPOSITORY: YankeyBright/spinlog',
  repositoryPrivateContext,
  "node-version: ['22.x', '24.x']",
  'npm ci --ignore-scripts',
  'npm run check:phases',
  'npm audit --audit-level=low',
]) {
  require(ciWorkflow.includes(value), `CI workflow must contain ${value}`)
}

for (const value of [
  'EXPECTED_REPOSITORY: YankeyBright/spinlog',
  repositoryPrivateContext,
  'id-token: write',
  'environment: release',
  "node-version: '24.x'",
  'npm ci --ignore-scripts',
  'npm run check:phases',
  'npm audit --audit-level=low',
  'package-manager-cache: false',
  'npm publish --provenance --access public',
  'gh release create "$GITHUB_REF_NAME" sbom.json',
]) {
  require(releaseWorkflow.includes(value), `release workflow must contain ${value}`)
}

require(!releaseWorkflow.includes('NPM_TOKEN') &&
  !releaseWorkflow.includes(
    'NODE_AUTH_TOKEN',
  ), 'release workflow must not use long-lived npm tokens')

const actionUseLines = `${ciWorkflow}\n${releaseWorkflow}`
  .split(/\r?\n/)
  .filter((line) => /\buses:\s/.test(line))
const pinnedAction = /^\s*uses:\s+\S+@[a-f0-9]{40}(?:\s+#.*)?\s*$/

require(actionUseLines.length > 0, 'workflows must use pinned GitHub Actions')
for (const line of actionUseLines) {
  require(pinnedAction.test(line), `workflow action must be pinned to a full SHA: ${line.trim()}`)
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`phase1-release: ${failure}`)
  }
  process.exit(1)
}

console.log('phase1-release=pass')
