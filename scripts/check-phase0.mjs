import { existsSync, readFileSync } from 'node:fs'

const failures = []

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

function requireText(path, text, requiredText) {
  for (const value of requiredText) {
    if (!text.includes(value)) {
      failures.push(`${path} must document: ${value}`)
    }
  }
}

function require(condition, message) {
  if (!condition) {
    failures.push(message)
  }
}

const mvpContract = readText('docs/mvp-contract.md')
const postMvp = readText('docs/post-mvp.md')
const streamPolicy = readText('docs/stream-policy.md')
const packageIdentity = readText('docs/package-identity.md')
const coreApi = readText('specs/06_CORE_API_SPEC.md')

requireText('docs/mvp-contract.md', mvpContract, [
  '**colors**',
  '**spinner**',
  '**spinner state transitions**',
  '**live mutation**',
  '**promise wrapper**',
  '**stderr-first terminal output**',
  '**zero runtime dependencies**',
  '**ESM-only**',
  '**Node >=18 runtime support**',
])
requireText('docs/mvp-contract.md', mvpContract, [
  '**task groups**: Not implemented in v1.',
  '**progress bars**: Not implemented in v1.',
  '**prompts**: Not implemented in v1.',
  '**intro/outro helpers**: Not implemented in v1.',
  '**structured JSON logging**: Not implemented in v1.',
])
requireText('docs/post-mvp.md', postMvp, [
  '`spinlog.group()`',
  '`spinlog.progress()`',
  '`spinlog.confirm()` and `spinlog.text()`',
  '`spinlog.intro()` and `spinlog.outro()`',
  '`structured: true` mode',
])
requireText('docs/stream-policy.md', streamPolicy, [
  '**Spinner animation**: Writes only to `stderr`.',
  '**Colorized cosmetic output**: Writes only to `stderr`.',
  '**Standard output (`stdout`)**: Is never touched in v1.',
])
requireText('specs/06_CORE_API_SPEC.md', coreApi, [
  '## Explicitly Excluded From v1',
  '`spinlog.group`',
  '`spinlog.progress`',
  '`spinlog.confirm`',
  '`spinlog.text`',
  '`spinlog.intro`',
  '`spinlog.outro`',
  '`structured: true`',
])
requireText('docs/package-identity.md', packageIdentity, [
  '**Package name**: `spinlog`',
  '**Runtime**: Node >=18',
  '**Module format**: ESM only',
  '**License**: MIT',
  '**Author**: spinlog contributors',
  '**Repository URL**: https://github.com/spinlog/spinlog',
])

let packageJson = {}
try {
  packageJson = JSON.parse(readText('package.json'))
} catch (error) {
  failures.push(`package.json must contain valid JSON: ${error.message}`)
}

const expectedKeywords = [
  'cli',
  'spinner',
  'terminal',
  'ansi',
  'colors',
  'esm',
  'zero-dependency',
  'supply-chain',
  'sbom',
]

require(packageJson.name === 'spinlog', 'package name must be spinlog')
require(packageJson.author ===
  'spinlog contributors', 'package author must match the frozen identity')
require(packageJson.license === 'MIT', 'package license must be MIT')
require(packageJson.engines?.node === '>=18', 'package runtime must be Node >=18')
require(packageJson.type === 'module', 'package must remain ESM-only')
require(packageJson.repository?.url ===
  'https://github.com/spinlog/spinlog.git', 'package repository URL must match the frozen identity')
require(Array.isArray(packageJson.keywords) &&
  packageJson.keywords.length === expectedKeywords.length &&
  expectedKeywords.every((keyword) =>
    packageJson.keywords.includes(keyword),
  ), 'package keywords must match the frozen identity')

for (const dependencyType of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  require(Object.keys(packageJson[dependencyType] ?? {}).length ===
    0, `${dependencyType} must remain empty`)
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`phase0: ${failure}`)
  }
  process.exit(1)
}

console.log('phase0=pass')
