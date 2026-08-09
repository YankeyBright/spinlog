import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
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
  ['tsup.config.ts', 'file'],
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
  ['dist/index.d.ts', 'file'],
]) {
  requirePath(path, type)
}

const packageJson = readObject('package.json')
const packageLock = readObject('package-lock.json')
const tsconfig = readObject('tsconfig.json')
const biome = readObject('biome.json')
const sizeLimit = readJson('.size-limit.json')
const tsupConfig = readText('tsup.config.ts')
const vitestConfig = readText('vitest.config.ts')
const output = readText('dist/index.js')
const configuredEntryPoint = packageJson.exports?.['.']
const entryPoint =
  configuredEntryPoint !== null && typeof configuredEntryPoint === 'object'
    ? configuredEntryPoint
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
  '^22.0.0 || ^24.0.0', 'package.json engines.node must name Node 22 and 24 LTS')
require(entryPoint.types === './dist/index.d.ts' &&
  entryPoint.import ===
    './dist/index.js', 'package.json exports must expose the ESM entrypoint and declarations')
require(!('require' in entryPoint), 'package.json exports must not expose CommonJS')
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
require(packageJson.scripts?.['build:js'] === 'tsup', 'build:js must run tsup')
require(packageJson.scripts?.['build:types'] ===
  'tsc --emitDeclarationOnly', 'build:types must use TypeScript declaration emit')
require(packageJson.scripts?.['check:phase-map'] ===
  'node scripts/check-phase-map.mjs', 'check:phase-map must run the phase-map validator')
require(packageJson.scripts?.['check:phase0'] ===
  'npm run check:phase-map && npm run test:phase0 && node scripts/check-phase0.mjs', 'check:phase0 must run phase-map and contract-policy tests first')
require(packageJson.scripts?.['check:phase1']?.startsWith(
  'npm run check:phase-map && ',
), 'check:phase1 must run the phase-map validator first')

for (const value of [
  "entry: ['src/index.ts']",
  "format: ['esm']",
  'minify: true',
  'sourcemap: false',
  'dts: false',
  'treeshake: true',
  "platform: 'node'",
  "target: 'node22'",
]) {
  require(tsupConfig.includes(value), `tsup.config.ts must contain ${value}`)
}

for (const value of [
  "environment: 'node'",
  "provider: 'v8'",
  "include: ['src/**/*.ts']",
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
require(sizeLimitEntry?.limit === '1228 B', '.size-limit.json must enforce the 1228 B limit')

require(!output.includes('module.exports'), 'dist/index.js must not contain CommonJS output')
require(!output.includes('sourceMappingURL'), 'dist/index.js must not reference a source map')
require(!distEntries.some((entry) => entry.endsWith('.map')), 'dist must not contain source maps')
require(JSON.stringify([...distEntries].sort()) ===
  JSON.stringify([
    'index.d.ts',
    'index.js',
  ]), 'dist must contain only ESM JavaScript and declarations')

try {
  await import(pathToFileURL(resolve('dist/index.js')).href)
} catch (error) {
  failures.push(`dist/index.js must be importable as ESM: ${error.message}`)
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`phase1: ${failure}`)
  }
  process.exit(1)
}

console.log('phase1=pass')
