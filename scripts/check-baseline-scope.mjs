import { readFileSync } from 'node:fs'
import { isDeepStrictEqual } from 'node:util'

import { runGit } from './git-executable.mjs'

const COMMIT = /^[0-9a-f]{40}$/u
const PROTECTED_PREFIXES = Object.freeze([
  'package-lock.json',
  'package.json',
  'src/',
  'bench/',
  'scripts/',
  'tsconfig',
  'vitest.config.ts',
  'biome.json',
  '.size-limit.json',
  'api-extractor.',
  'specs/v1-',
  'sbom.json',
])

function protectedInput(path) {
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))
}

/** Reject evidence that was produced before any release-relevant input changed. */
export function validateBaselineScope({
  baselineCommit,
  baselineLock,
  baselinePackage,
  changedPaths,
  currentLock,
  currentPackage,
}) {
  const failures = []
  if (!COMMIT.test(baselineCommit ?? '')) {
    return ['benchmark baseline must identify a full immutable Git commit']
  }
  for (const path of changedPaths) {
    if (path !== 'bench/baseline.json' && protectedInput(path)) {
      failures.push(`protected input changed after reviewed baseline: ${path}`)
    }
  }
  if (!isDeepStrictEqual(baselinePackage, currentPackage)) {
    failures.push('package.json changed after the reviewed baseline')
  }
  if (!isDeepStrictEqual(baselineLock, currentLock)) {
    failures.push('package-lock.json changed after the reviewed baseline')
  }
  return [...new Set(failures)]
}

function gitText(arguments_) {
  return runGit(arguments_, { encoding: 'utf8', windowsHide: true })
}

function lines(value) {
  return value.split(/\r?\n/u).filter(Boolean)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

try {
  const baseline = readJson('bench/baseline.json')
  const baselineCommit = baseline?.provenance?.commit
  if (!COMMIT.test(baselineCommit ?? '')) throw new Error('invalid baseline commit')

  gitText(['cat-file', '-e', `${baselineCommit}^{commit}`])
  const changedPaths = [
    ...lines(gitText(['diff', '--name-only', baselineCommit])),
    ...lines(gitText(['ls-files', '--others', '--exclude-standard'])),
  ]
  const failures = validateBaselineScope({
    baselineCommit,
    baselineLock: JSON.parse(gitText(['show', `${baselineCommit}:package-lock.json`])),
    baselinePackage: JSON.parse(gitText(['show', `${baselineCommit}:package.json`])),
    changedPaths,
    currentLock: readJson('package-lock.json'),
    currentPackage: readJson('package.json'),
  })

  if (failures.length > 0) {
    for (const failure of failures) console.error(`baseline-scope: ${failure}`)
    process.exitCode = 1
  } else {
    console.log('baseline-scope=pass')
  }
} catch {
  console.error(
    'baseline-scope: reviewed baseline commit is unavailable or invalid in this checkout',
  )
  process.exitCode = 1
}
