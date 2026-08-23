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
})
