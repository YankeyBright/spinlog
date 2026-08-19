import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { inspectRuntimeDirectory, validateRuntimePolicy } from './runtime-policy.mjs'

const failures = []

function require(condition, message) {
  if (!condition) failures.push(message)
}

function readText(path) {
  if (!existsSync(path)) {
    failures.push(`missing required file: ${path}`)
    return ''
  }
  return readFileSync(path, 'utf8')
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

const contract = readObject('specs/v1-behavior.json')
const packageJson = readObject('package.json')
const coverage = readObject('coverage/coverage-final.json')
let runtimeFiles = []
try {
  const inspected = inspectRuntimeDirectory('src')
  runtimeFiles = inspected.files
  failures.push(...inspected.failures, ...validateRuntimePolicy(runtimeFiles))
} catch (error) {
  failures.push(`could not inspect runtime source: ${error.message}`)
}
for (const path of [
  'specs/v1-public-api.d.ts',
  'specs/v1-styles-api.d.ts',
  'dist/index.d.ts',
  'dist/styles.d.ts',
  'etc/spinlog.api.md',
  'etc/spinlog-styles.api.md',
]) {
  require(existsSync(path), `API Extractor contract evidence must exist: ${path}`)
}
require(packageJson.devDependencies?.['@microsoft/api-extractor'] ===
  '7.58.12', 'API Extractor must be an exact development-only pin')
require(packageJson.devDependencies?.yaml ===
  '2.9.0', 'yaml must be an exact development-only pin for structural workflow validation')

const expectedCoveragePaths = runtimeFiles.map(({ path }) => `/src/${path}`)
const coverageEntries = Object.entries(coverage)
require(coverageEntries.length ===
  runtimeFiles.length, `coverage must contain exactly ${runtimeFiles.length} source files`)

for (const suffix of expectedCoveragePaths) {
  const matches = coverageEntries.filter(([path]) => path.replaceAll('\\', '/').endsWith(suffix))
  require(matches.length === 1, `coverage must contain exactly one entry ending in ${suffix}`)
  const entry = matches[0]?.[1]
  if (!entry) continue

  for (const [metric, counters] of [
    ['statements', entry.s],
    ['functions', entry.f],
    ['branches', entry.b],
  ]) {
    const values = Object.values(counters ?? {}).flat()
    require(values.length > 0, `${suffix} must contain executable ${metric}`)
    require(values.every((value) => value > 0), `${suffix} must have complete ${metric} coverage`)
  }

  const executableLines = new Map()
  for (const [statementId, count] of Object.entries(entry.s ?? {})) {
    const line = entry.statementMap?.[statementId]?.start?.line
    require(Number.isInteger(line), `${suffix} statement ${statementId} must map to a source line`)
    if (Number.isInteger(line)) {
      executableLines.set(line, (executableLines.get(line) ?? 0) + count)
    }
  }
  require(executableLines.size > 0, `${suffix} must contain executable lines`)
  require([...executableLines.values()].every(
    (count) => count > 0,
  ), `${suffix} must have complete line coverage`)
}

try {
  const runtime = await import(
    `${pathToFileURL(resolve('dist/index.js')).href}?phase2=${Date.now()}`
  )
  const stylesRuntime = await import(
    `${pathToFileURL(resolve('dist/styles.js')).href}?phase2=${Date.now()}`
  )
  const expectedExports = ['default', ...(contract.publicApi?.styleExports ?? [])].sort()
  const expectedStyleExports = [...(contract.publicApi?.styleExports ?? [])].sort()
  require(JSON.stringify(Object.keys(runtime).sort()) ===
    JSON.stringify(
      expectedExports,
    ), 'runtime exports must match the frozen value export surface exactly')
  require(typeof runtime.default === 'function', 'default export must be callable')
  const expectedMethods = contract.publicApi?.callableMethods ?? []
  require(JSON.stringify(Object.keys(runtime.default).sort()) ===
    JSON.stringify(
      [...expectedMethods].sort(),
    ), 'default export properties must match the frozen callable methods')
  for (const method of expectedMethods) {
    require(typeof runtime.default?.[method] ===
      'function', `default export must expose ${method}()`)
  }
  require(JSON.stringify(Object.keys(stylesRuntime).sort()) ===
    JSON.stringify(
      expectedStyleExports,
    ), 'styles subpath exports must match the frozen style surface exactly')
} catch (error) {
  failures.push(`dist/index.js must expose the Phase 2 runtime: ${error.message}`)
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`phase2: ${failure}`)
  process.exit(1)
}

console.log('phase2=pass')
