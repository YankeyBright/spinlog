import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  validateEsbuildSecurityPolicy,
  validateTypeScriptConfig,
} from './phase1-toolchain-policy.mjs'

const failures = []

function require(condition, message) {
  if (!condition) {
    failures.push(message)
  }
}

function requirePath(path, type) {
  if (!existsSync(path)) {
    failures.push(`missing required ${type}: ${path}`)
    return
  }

  if (statSync(path).isDirectory() !== (type === 'directory')) {
    failures.push(`${path} must be a ${type}`)
  }
}

function readText(path) {
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

for (const [path, type] of [
  ['package.json', 'file'],
  ['package-lock.json', 'file'],
  ['tsconfig.json', 'file'],
  ['tsconfig.specs.json', 'file'],
  ['scripts/build-js.mjs', 'file'],
  ['vitest.config.ts', 'file'],
  ['biome.json', 'file'],
  ['.size-limit.json', 'file'],
  ['README.md', 'file'],
  ['SECURITY.md', 'file'],
  ['LICENSE', 'file'],
  ['src', 'directory'],
  ['test', 'directory'],
  ['dist', 'directory'],
  ['dist/index.js', 'file'],
  ['dist/index.js.map', 'file'],
  ['dist/index.d.ts', 'file'],
  ['dist/styles.js', 'file'],
  ['dist/styles.js.map', 'file'],
  ['dist/styles.d.ts', 'file'],
]) {
  requirePath(path, type)
}

const packageJson = readObject('package.json')
const packageLock = readObject('package-lock.json')
const tsconfig = readObject('tsconfig.json')
const biome = readObject('biome.json')
const sizeLimit = readJson('.size-limit.json')
const buildConfig = readText('scripts/build-js.mjs')
const vitestConfig = readText('vitest.config.ts')
const output = readText('dist/index.js')
const stylesOutput = readText('dist/styles.js')
const sourceMap = readObject('dist/index.js.map')
const stylesSourceMap = readObject('dist/styles.js.map')
const configuredEntryPoint = packageJson.exports?.['.']
const entryPoint =
  configuredEntryPoint !== null && typeof configuredEntryPoint === 'object'
    ? configuredEntryPoint
    : {}
const configuredStylesEntryPoint = packageJson.exports?.['./styles']
const stylesEntryPoint =
  configuredStylesEntryPoint !== null && typeof configuredStylesEntryPoint === 'object'
    ? configuredStylesEntryPoint
    : {}
const sizeLimitEntry = Array.isArray(sizeLimit) ? sizeLimit[0] : undefined
const distEntries = existsSync('dist') && statSync('dist').isDirectory() ? readdirSync('dist') : []

function sourceFiles(directory) {
  if (!existsSync(directory)) {
    return []
  }

  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`

    if (entry.isDirectory()) {
      files.push(...sourceFiles(path))
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(path)
    }
  }

  return files
}

require(packageJson.type === 'module', 'package.json type must be module')
require(packageJson.sideEffects === false, 'package.json sideEffects must be false')
require(packageJson.engines?.node ===
  '^22.13.0 || ^24.0.0', 'package.json engines.node must require stable styleText on Node 22 and support Node 24 LTS')
require(entryPoint.types === './dist/index.d.ts' &&
  entryPoint.import ===
    './dist/index.js', 'package.json exports must expose the ESM entrypoint and declarations')
require(!('require' in entryPoint), 'package.json exports must not expose CommonJS')
require(stylesEntryPoint.types === './dist/styles.d.ts' &&
  stylesEntryPoint.import ===
    './dist/styles.js', 'package.json exports must expose the ESM styles subpath and declarations')
require(!('require' in stylesEntryPoint), 'styles subpath must not expose CommonJS')
require(JSON.stringify(Object.keys(packageJson.exports ?? {}).sort()) ===
  JSON.stringify([
    '.',
    './styles',
  ]), 'package.json exports must contain exactly the root and styles entrypoints')
require(JSON.stringify(packageJson.files) ===
  JSON.stringify([
    'dist',
    'README.md',
    'LICENSE',
    'SECURITY.md',
    'sbom.json',
  ]), 'package.json files must match the publish allowlist')

failures.push(...validateTypeScriptConfig(tsconfig))
failures.push(...validateEsbuildSecurityPolicy(packageJson, packageLock))
require(packageJson.devDependencies?.typescript === '7.0.2', 'TypeScript must be pinned to 7.0.2')
require(packageJson.devDependencies?.['@types/node'] ===
  '22.20.1', '@types/node must be a direct exact-pinned development dependency')
require(packageJson.scripts?.build ===
  'npm run build:js && npm run build:types', 'build must compose JavaScript and declaration builds')
require(packageJson.scripts?.['build:js'] ===
  'node scripts/build-js.mjs', 'build:js must run the checked-in direct esbuild adapter')
require(packageJson.scripts?.['build:types'] ===
  'tsc --emitDeclarationOnly && node scripts/prune-declarations.mjs', 'build:types must use TypeScript declaration emit and prune internal declarations')
require(packageJson.scripts?.['check:phase-map'] ===
  'node scripts/check-phase-map.mjs', 'check:phase-map must run the phase-map validator')
require(packageJson.scripts?.['check:phase0'] ===
  'npm run check:phase-map && npm run typecheck:contracts && npm run test:phase0 && node scripts/check-phase0.mjs', 'check:phase0 must compile declarations before contract-policy tests')
require(packageJson.scripts?.['check:phase1']?.startsWith(
  'npm run check:phase-map && ',
), 'check:phase1 must run the phase-map validator first')

require(!existsSync(
  'tsup.config.ts',
), 'tsup.config.ts must be removed after direct esbuild migration')

for (const value of [
  "index: resolve(projectRoot, 'src/index.ts')",
  "styles: resolve(projectRoot, 'src/styles.ts')",
  'process.chdir(projectRoot)',
  'bundle: true',
  "format: 'esm'",
  'minify: true',
  "sourcemap: 'linked'",
  'sourcesContent: true',
  'treeShaking: true',
  "platform: 'node'",
  "target: 'node22.13'",
  'outdir: outputDirectory',
  "external: ['node:*']",
]) {
  require(buildConfig.includes(value), `scripts/build-js.mjs must contain ${value}`)
}

for (const value of [
  "environment: 'node'",
  "provider: 'v8'",
  "include: ['src/**/*.ts']",
  "reporter: ['text', ['json', { file: 'coverage-final.json' }]]",
  '...coverageConfigDefaults.exclude',
  'thresholds: {',
  'lines: 100',
  'functions: 100',
  'branches: 100',
  'statements: 100',
  'perFile: true',
  'autoUpdate: false',
  "include: ['test/**/*.test.ts']",
]) {
  require(vitestConfig.includes(value), `vitest.config.ts must contain ${value}`)
}

require(!/\ball\s*:/.test(vitestConfig), 'vitest.config.ts must not use removed coverage.all')

for (const path of sourceFiles('src')) {
  require(!/(?:\/\*|\/\/)\s*(?:c8|istanbul|v8)\s+ignore\b/i.test(
    readText(path),
  ), `${path} must not contain a coverage-suppression directive`)
}

require(biome.formatter?.enabled === true, 'Biome formatter must be enabled')
require(biome.linter?.enabled === true, 'Biome linter must be enabled')
require(Array.isArray(sizeLimit), '.size-limit.json must be an array')
require(sizeLimitEntry?.path === 'dist/index.js', '.size-limit.json must target dist/index.js')
require(sizeLimitEntry?.limit === '2560 B', '.size-limit.json must enforce the 2560 B limit')
require(sizeLimitEntry?.gzip === true, '.size-limit.json must measure gzip size')
require(JSON.stringify(sizeLimitEntry?.ignore) ===
  JSON.stringify([
    'node:util',
    'node:process',
  ]), '.size-limit.json must externalize only the exact node: built-in specifiers')

require(!output.includes('module.exports'), 'dist/index.js must not contain CommonJS output')
require(!stylesOutput.includes('module.exports'), 'dist/styles.js must not contain CommonJS output')
require(output.includes(
  'sourceMappingURL=index.js.map',
), 'dist/index.js must reference its external source map')
require(stylesOutput.includes(
  'sourceMappingURL=styles.js.map',
), 'dist/styles.js must reference its external source map')

function validateSourceMap(path, map, expectedSources) {
  require(map.version === 3, `${path} must use source map version 3`)
  require(Array.isArray(map.sources) &&
    JSON.stringify([...map.sources].sort()) ===
      JSON.stringify(
        [...expectedSources].sort(),
      ), `${path} must describe its complete source graph`)
  require(Array.isArray(map.sourcesContent) &&
    map.sourcesContent.length === map.sources?.length &&
    map.sourcesContent.every(
      (source) => typeof source === 'string',
    ), `${path} must embed every source for production diagnostics`)
  for (const source of map.sources ?? []) {
    require(typeof source === 'string' &&
      !isAbsolute(source) &&
      !/^(?:file:|[a-z]:[\\/])/i.test(source), `${path} path must be relative: ${String(source)}`)
  }
}

validateSourceMap('dist/index.js.map', sourceMap, [
  '../src/ansi.ts',
  '../src/env.ts',
  '../src/index.ts',
  '../src/spinner.ts',
  '../src/styles.ts',
])
validateSourceMap('dist/styles.js.map', stylesSourceMap, ['../src/env.ts', '../src/styles.ts'])
require(JSON.stringify([...distEntries].sort()) ===
  JSON.stringify([
    'index.d.ts',
    'index.js',
    'index.js.map',
    'styles.d.ts',
    'styles.js',
    'styles.js.map',
  ]), 'dist must contain only the two ESM entrypoints, declarations, and validated source maps')

try {
  await import(pathToFileURL(resolve('dist/index.js')).href)
  await import(pathToFileURL(resolve('dist/styles.js')).href)
} catch (error) {
  failures.push(`dist entrypoints must be importable as ESM: ${error.message}`)
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`phase1: ${failure}`)
  }
  process.exit(1)
}

console.log('phase1=pass')
