import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const failures = []
const EXPECTED_SOURCE_FILES = ['ansi.ts', 'env.ts', 'index.ts', 'spinner.ts', 'styles.ts']

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

function declarationShape(path, text) {
  try {
    const formatted = execFileSync(
      process.execPath,
      [resolve('node_modules/@biomejs/biome/bin/biome'), 'format', '--stdin-file-path=contract.d.ts'],
      { encoding: 'utf8', input: text },
    )
    return formatted.replace(/\n\s*\n/g, '\n').trim()
  } catch (error) {
    failures.push(`${path} must parse as declarations: ${error.message}`)
    return ''
  }
}

const contract = readObject('specs/v1-behavior.json')
const expectedDeclaration = readText('specs/v1-public-api.d.ts')
const emittedDeclaration = readText('dist/index.d.ts')
const expectedStylesDeclaration = readText('specs/v1-styles-api.d.ts')
const emittedStylesDeclaration = readText('dist/styles.d.ts')
const coverage = readObject('coverage/coverage-final.json')
const sourceFiles = existsSync('src')
  ? readdirSync('src')
      .filter((entry) => entry.endsWith('.ts'))
      .sort()
  : []

require(JSON.stringify(sourceFiles) ===
  JSON.stringify(
    EXPECTED_SOURCE_FILES,
  ), `src must contain exactly: ${EXPECTED_SOURCE_FILES.join(', ')}`)
require(declarationShape('specs/v1-public-api.d.ts', expectedDeclaration) ===
  declarationShape(
    'dist/index.d.ts',
    emittedDeclaration,
  ), 'emitted declarations must match the frozen public API contract')
require(declarationShape('specs/v1-styles-api.d.ts', expectedStylesDeclaration) ===
  declarationShape(
    'dist/styles.d.ts',
    emittedStylesDeclaration,
  ), 'emitted styles declarations must match the frozen styles subpath contract')

const expectedCoveragePaths = EXPECTED_SOURCE_FILES.map((file) => `/src/${file}`)
const coverageEntries = Object.entries(coverage)
require(coverageEntries.length ===
  EXPECTED_SOURCE_FILES.length, `coverage must contain exactly ${EXPECTED_SOURCE_FILES.length} source files`)

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

const runtimeSource = EXPECTED_SOURCE_FILES.map((file) => readText(`src/${file}`)).join('\n')
for (const [pattern, description] of [
  [/\bprocess\.(?:on|once)\s*\(/, 'process lifecycle listener'],
  [/\bprocess\.(?:exit|kill)\s*\(/, 'host termination call'],
  [/\b(?:stderr|process\.stderr)\.(?:on|once)\s*\(/, 'global stderr error listener'],
  [/\b(?:stdout|process\.stdout)\.write\s*\(/, 'stdout write'],
  [/SIGINT|SIGTERM/, 'signal ownership'],
]) {
  require(!pattern.test(runtimeSource), `runtime source must not contain ${description}`)
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
  require(typeof runtime.default?.promise === 'function', 'default export must expose promise()')
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
