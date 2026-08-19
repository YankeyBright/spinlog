import { isDeepStrictEqual } from 'node:util'

import { sortCanonicalText } from './canonical-order.mjs'

export const APPROVED_SCRIPTS = Object.freeze({
  'api:check': 'node scripts/check-api-contract.mjs',
  'api:update': 'node scripts/check-api-contract.mjs --update',
  benchmark: 'node bench/run.mjs',
  'benchmark:baseline': 'node bench/aggregate-baseline.mjs',
  'benchmark:check': 'node bench/check.mjs',
  'benchmark:smoke': 'node bench/run.mjs --smoke',
  build: 'npm run build:js && npm run build:types',
  'build:js': 'node scripts/build-js.mjs',
  'build:types': 'tsc --emitDeclarationOnly && node scripts/prune-declarations.mjs',
  'check:phase-map': 'node scripts/check-phase-map.mjs',
  'check:phase0':
    'npm run check:phase-map && npm run typecheck:contracts && npm run test:phase0 && node scripts/check-phase0.mjs',
  'check:phase1':
    'npm run check:phase-map && npm run policy:check && npm run typecheck && npm run format:check && npm run lint && npm run test:coverage && npm run build && node scripts/check-phase1.mjs && npm run package:lint && npm run size && npm run size:limit && npm run pack:check',
  'check:phase1:release':
    'npm run sbom && npm run sbom:check && node scripts/check-phase1-release.mjs',
  'check:phase2':
    'npm run typecheck && npm run typecheck:contracts && npm run format:check && npm run lint && npm run test:coverage && npm run build && npm run typecheck:public && npm run api:check && npm run runtime:check && node scripts/check-phase2.mjs && npm run package:lint && npm run check:tree-shaking && npm run test:consumer && npm run size && npm run size:limit && npm run pack:check',
  'check:phase3':
    'npm run policy:check && npm run build && npm run benchmark:smoke && npm run sbom && npm run sbom:check && npm run sbom:build && npm run sbom:build:check && npm run size && npm run size:limit && npm run package:lint && npm run pack:check && npm run reproducibility:check && node scripts/check-phase3.mjs',
  'check:phases': 'node scripts/check-phases.mjs',
  'check:tree-shaking': 'node scripts/check-tree-shaking.mjs',
  'candidate:manifest': 'node scripts/candidate-manifest.mjs',
  format: 'biome format . --write',
  'format:check': 'biome format .',
  lint: 'biome lint . --error-on-warnings',
  'pack:check': 'node scripts/check-pack.mjs',
  'package:lint': 'node scripts/check-package-lint.mjs',
  'policy:check': 'node scripts/check-package-policy.mjs',
  'runtime:check': 'node scripts/check-runtime-policy.mjs',
  'reproducibility:check': 'node scripts/reproducibility.mjs',
  sbom: 'node scripts/generate-sbom.mjs',
  'sbom:build': 'node scripts/generate-build-sbom.mjs',
  'sbom:build:check': 'node scripts/check-build-sbom.mjs',
  'sbom:check': 'node scripts/check-sbom.mjs',
  size: 'node scripts/check-size.mjs',
  'size:limit': 'size-limit',
  test: 'vitest run',
  'test:consumer': 'node scripts/check-consumer.mjs',
  'test:coverage': 'vitest run --coverage',
  'test:phase0': 'vitest run test/phase0-contract-policy.test.ts',
  typecheck: 'tsc --noEmit',
  'typecheck:contracts': 'tsc -p tsconfig.specs.json',
  'typecheck:public': 'tsc -p tsconfig.contract.json',
  verify:
    'npm run policy:check && npm run typecheck && npm run typecheck:contracts && npm run format:check && npm run lint && npm run test:coverage && npm run build && npm run typecheck:public && npm run api:check && npm run runtime:check && node scripts/check-phase2.mjs && npm run package:lint && npm run check:tree-shaking && npm run test:consumer && npm run size && npm run size:limit && npm run pack:check',
  'verify:release': 'npm run verify && npm run sbom && npm run sbom:check',
  'verify:candidate': 'node scripts/verify-candidate.mjs',
})

const APPROVED_FILES = Object.freeze(['dist', 'README.md', 'LICENSE', 'SECURITY.md', 'sbom.json'])
const FORBIDDEN_LIFECYCLE =
  /^(?:pre|post)?(?:install|prepare|pack|publish|version|uninstall|restart|start|stop|dependencies)$/

export function validatePackagePolicy(packageJson, rootEntries = []) {
  const failures = []
  const scripts = packageJson?.scripts ?? {}

  validateRuntimeDependencies(packageJson, failures)
  validatePackageIdentity(packageJson, failures)
  validateExports(packageJson?.exports, failures)
  validateScripts(scripts, failures)
  validateNativeMetadata(packageJson, rootEntries, failures)
  validateDevelopmentPins(packageJson?.devDependencies, failures)
  return [...new Set(failures)]
}

function validateRuntimeDependencies(packageJson, failures) {
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (Object.keys(packageJson?.[field] ?? {}).length > 0) failures.push(`${field} must be empty`)
  }
}

function validatePackageIdentity(packageJson, failures) {
  if (packageJson?.type !== 'module') failures.push('type must be module')
  if (packageJson?.sideEffects !== false) failures.push('sideEffects must be false')
  if (packageJson?.engines?.node !== '^22.13.0 || ^24.0.0') {
    failures.push('engines.node must require stable Node 22 APIs and support Node 24 LTS')
  }
  if (packageJson?.name !== 'spinlog' || packageJson?.license !== 'MIT') {
    failures.push('package identity must remain spinlog under the MIT license')
  }
  if (packageJson?.repository?.url !== 'git+https://github.com/YankeyBright/spinlog.git') {
    failures.push('repository.url must match the trusted publishing repository')
  }
  if (!isDeepStrictEqual(packageJson?.files, APPROVED_FILES)) {
    failures.push('files must contain the approved publish allowlist')
  }
}

function validateExports(exports, failures) {
  const entry = exports?.['.']
  const styles = exports?.['./styles']
  if (
    entry?.types !== './dist/index.d.ts' ||
    entry?.import !== './dist/index.js' ||
    'require' in (entry ?? {}) ||
    styles?.types !== './dist/styles.d.ts' ||
    styles?.import !== './dist/styles.js' ||
    'require' in (styles ?? {}) ||
    !isDeepStrictEqual(sortCanonicalText(Object.keys(exports ?? {})), ['.', './styles'])
  ) {
    failures.push('exports must expose exactly the two ESM entrypoints and declarations')
  }
}

function validateScripts(scripts, failures) {
  if (!isDeepStrictEqual(scripts, APPROVED_SCRIPTS)) {
    failures.push('scripts must exactly match the approved command map')
  }
  for (const name of Object.keys(scripts)) {
    if (FORBIDDEN_LIFECYCLE.test(name)) failures.push(`lifecycle script is forbidden: ${name}`)
    if (/^(?:pre|post)/.test(name) && !(name in APPROVED_SCRIPTS)) {
      failures.push(`arbitrary npm hook is forbidden: ${name}`)
    }
  }
}

function validateNativeMetadata(packageJson, rootEntries, failures) {
  for (const name of ['gypfile', 'binary', 'os', 'cpu', 'libc']) {
    if (name in (packageJson ?? {})) failures.push(`native-install metadata is forbidden: ${name}`)
  }
  if (rootEntries.includes('binding.gyp')) failures.push('binding.gyp is forbidden')
}

function validateDevelopmentPins(devDependencies, failures) {
  for (const [name, version] of Object.entries(devDependencies ?? {})) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      failures.push(`dev dependency must be exact-pinned: ${name}`)
    }
  }
}
