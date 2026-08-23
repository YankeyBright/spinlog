import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { sortCanonicalText } from './canonical-order.mjs'
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
require(contract.schemaVersion === 9, 'Phase 2 requires behavior schema version 9')
require(JSON.stringify(contract.environment?.capabilityShape) ===
  JSON.stringify([
    'sgr',
    'cursor',
    'color',
    'emphasis',
    'animation',
    'unicode',
  ]), 'Phase 2 requires named terminal capabilities')
require(contract.environment?.noColor === 'non-empty-disables-colors-only' &&
  contract.environment?.nodeDisableColors === 'non-empty-disables-colors-only' &&
  contract.environment?.interactiveEmphasisWhenColorDisabled ===
    true, 'Phase 2 requires the color-only disable and interactive emphasis policy')
require(contract.rendering?.renderCache?.sanitization === 'lazy-render-boundary' &&
  contract.rendering?.renderCache?.colorMutation === 'reuse-text-snapshot' &&
  contract.rendering?.renderCache?.width ===
    'cached-conservative', 'Phase 2 requires the frozen render-cache policy')
require(contract.styles?.metadata?.singleSourceOfTruth === true &&
  contract.styles?.metadata?.spinnerColorValidation === 'foreground-only' &&
  contract.styles?.metadata?.nestedRestore ===
    'metadata-driven', 'Phase 2 requires metadata-driven ANSI behavior')
require(JSON.stringify(contract.defaults) ===
  JSON.stringify({
    text: '',
    color: 'cyan',
    prefix: '',
    suffix: '',
    spinner: 'dots',
    static: 'symbol',
    terminal: 'auto',
    intervalMs: 80,
  }), 'Phase 2 requires the frozen static and terminal defaults')
require(JSON.stringify(contract.publicApi?.spinnerMethods) ===
  JSON.stringify([
    'start',
    'stop',
    'log',
    'Symbol.dispose',
    'succeed',
    'fail',
    'warn',
    'info',
  ]), 'Phase 2 requires the exact spinner method surface, including log()')
require(contract.rendering?.staticModes?.default === 'symbol' &&
  JSON.stringify(contract.rendering?.staticModes?.options) ===
    JSON.stringify(['symbol', 'text', 'silent']) &&
  contract.rendering?.log?.activeFrameCoordination ===
    'clear-write-redraw', 'Phase 2 requires the frozen static-mode and coordinated-log policy')
require(JSON.stringify(contract.environment?.terminalModes) ===
  JSON.stringify(['auto', 'static', 'interactive']) &&
  contract.environment?.unknownTerminalProfile ===
    'auto-static-and-no-default-sgr', 'Phase 2 requires the conservative terminal-profile policy')
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
require(readText('specs/v1-public-api.d.ts').startsWith(
  '/// <reference lib="esnext.disposable" />\n\n',
), 'frozen declarations must reference esnext.disposable for Symbol.dispose')
require(readText('dist/index.d.ts').startsWith(
  '/// <reference lib="esnext.disposable" />\n\n',
), 'emitted declarations must reference esnext.disposable for Symbol.dispose')
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
  const expectedExports = sortCanonicalText([
    'default',
    ...(contract.publicApi?.styleExports ?? []),
  ])
  const expectedStyleExports = sortCanonicalText(contract.publicApi?.styleExports ?? [])
  require(JSON.stringify(sortCanonicalText(Object.keys(runtime))) ===
    JSON.stringify(
      expectedExports,
    ), 'runtime exports must match the frozen value export surface exactly')
  require(typeof runtime.default === 'function', 'default export must be callable')
  const expectedMethods = contract.publicApi?.callableMethods ?? []
  require(JSON.stringify(sortCanonicalText(Object.keys(runtime.default))) ===
    JSON.stringify(
      sortCanonicalText(expectedMethods),
    ), 'default export properties must match the frozen callable methods')
  for (const method of expectedMethods) {
    require(typeof runtime.default?.[method] ===
      'function', `default export must expose ${method}()`)
  }
  const spinner = runtime.default()
  require(typeof spinner.log === 'function', 'spinner instances must expose log()')
  require(spinner.log('phase2') === spinner, 'spinner.log() must return its instance')
  require(JSON.stringify(sortCanonicalText(Object.keys(stylesRuntime))) ===
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
