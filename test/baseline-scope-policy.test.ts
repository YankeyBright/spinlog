import { describe, expect, it } from 'vitest'

import { validateBaselineScope } from '../scripts/check-baseline-scope.mjs'

const commit = 'a'.repeat(40)
const packageJson = { name: 'spinlog', version: '0.1.0' }
const packageLock = { lockfileVersion: 3, name: 'spinlog' }

function scope(overrides = {}) {
  return {
    baselineCommit: commit,
    baselineLock: packageLock,
    baselinePackage: packageJson,
    changedPaths: ['bench/baseline.json'],
    currentLock: packageLock,
    currentPackage: packageJson,
    ...overrides,
  }
}

describe('benchmark baseline scope', () => {
  it('accepts the baseline evidence file without unrelated changes', () => {
    expect(validateBaselineScope(scope())).toEqual([])
  })

  it('rejects changed source, build-policy, and untracked runtime inputs', () => {
    expect(
      validateBaselineScope(
        scope({
          changedPaths: ['README.md', 'src/renderer.ts', 'scripts/build-js.mjs', 'src/new.ts'],
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        'protected input changed after reviewed baseline: src/renderer.ts',
        'protected input changed after reviewed baseline: scripts/build-js.mjs',
        'protected input changed after reviewed baseline: src/new.ts',
      ]),
    )
  })

  it('rejects package and lockfile drift even without a changed-path report', () => {
    expect(
      validateBaselineScope(
        scope({
          currentLock: { ...packageLock, version: 2 },
          currentPackage: { ...packageJson, description: 'changed payload' },
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        'package.json changed after the reviewed baseline',
        'package-lock.json changed after the reviewed baseline',
      ]),
    )
  })

  it('rejects abbreviated baseline commits', () => {
    expect(validateBaselineScope(scope({ baselineCommit: 'abc123' }))).toEqual([
      'benchmark baseline must identify a full immutable Git commit',
    ])
  })
})
