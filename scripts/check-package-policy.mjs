import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const allowedFiles = ['dist', 'README.md', 'LICENSE', 'SECURITY.md', 'sbom.json']
const entryPoint = packageJson.exports?.['.']
const stylesEntryPoint = packageJson.exports?.['./styles']
const hasEsmEntryPoint =
  typeof entryPoint === 'object' &&
  entryPoint !== null &&
  entryPoint.types === './dist/index.d.ts' &&
  entryPoint.import === './dist/index.js' &&
  !('require' in entryPoint)
const hasEsmStylesEntryPoint =
  typeof stylesEntryPoint === 'object' &&
  stylesEntryPoint !== null &&
  stylesEntryPoint.types === './dist/styles.d.ts' &&
  stylesEntryPoint.import === './dist/styles.js' &&
  !('require' in stylesEntryPoint)
const lifecycleScripts = [
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepublish',
  'prepublishOnly',
  'prepack',
  'postpack',
]
const failures = []

for (const dependencyType of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  if (Object.keys(packageJson[dependencyType] ?? {}).length > 0) {
    failures.push(`${dependencyType} must be empty`)
  }
}

if (packageJson.type !== 'module') {
  failures.push('type must be module')
}

if (!hasEsmEntryPoint) {
  failures.push('exports must expose only the ESM entrypoint and its declarations')
}

if (!hasEsmStylesEntryPoint) {
  failures.push('exports must expose the ESM-only styles subpath and its declarations')
}

if (
  JSON.stringify(Object.keys(packageJson.exports ?? {}).sort()) !==
  JSON.stringify(['.', './styles'])
) {
  failures.push('exports must contain exactly the root and styles entrypoints')
}

if (packageJson.sideEffects !== false) {
  failures.push('sideEffects must be false')
}

if (packageJson.engines?.node !== '^22.13.0 || ^24.0.0') {
  failures.push('engines.node must require stable Node 22 APIs and support Node 24 LTS')
}

if (packageJson.name !== 'spinlog' || packageJson.license !== 'MIT') {
  failures.push('package identity must remain spinlog under the MIT license')
}

if (packageJson.repository?.url !== 'git+https://github.com/YankeyBright/spinlog.git') {
  failures.push('repository.url must match the trusted publishing repository')
}

if (JSON.stringify(packageJson.files) !== JSON.stringify(allowedFiles)) {
  failures.push('files must contain the approved publish allowlist')
}

for (const [name, version] of Object.entries(packageJson.devDependencies ?? {})) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    failures.push(`dev dependency must be exact-pinned: ${name}`)
  }
}

for (const name of lifecycleScripts) {
  if (name in (packageJson.scripts ?? {})) {
    failures.push(`lifecycle script is forbidden: ${name}`)
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure)
  }
  process.exit(1)
}

console.log('package-policy=valid')
