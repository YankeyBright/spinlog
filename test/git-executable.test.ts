import { isAbsolute } from 'node:path'

import { describe, expect, it } from 'vitest'

import { gitExecutableCandidates } from '../scripts/git-executable.mjs'

describe('Git executable resolution', () => {
  it('rejects a PATH-resolved override', () => {
    expect(() => gitExecutableCandidates({ SPINLOG_GIT_EXECUTABLE: 'git' })).toThrow(
      'SPINLOG_GIT_EXECUTABLE must be an absolute executable path',
    )
  })

  it('accepts an explicit absolute override without adding PATH candidates', () => {
    const executable = process.platform === 'win32' ? 'C:\\Tools\\git.exe' : '/opt/tools/git'
    expect(gitExecutableCandidates({ SPINLOG_GIT_EXECUTABLE: executable })).toEqual([executable])
    expect(isAbsolute(executable)).toBe(true)
  })

  it.each([
    ['POSIX', {}, 'linux'],
    ['Windows', { ProgramFiles: 'C:\\Program Files' }, 'win32'],
  ])('returns a mutable candidate array for %s', (_name, environment, platform) => {
    const candidates = gitExecutableCandidates(environment, platform)

    expect(Array.isArray(candidates)).toBe(true)
    expect(candidates).not.toBe(gitExecutableCandidates(environment, platform))
  })
})
