import { describe, expect, it } from 'vitest'

import { requireGitHubCommit } from '../scripts/candidate-manifest.mjs'

describe('candidate manifest provenance', () => {
  it('accepts only a complete GitHub Actions commit identity', () => {
    const commit = 'a'.repeat(40)

    expect(requireGitHubCommit({ GITHUB_ACTIONS: 'true', GITHUB_SHA: commit })).toBe(commit)
  })

  it.each([
    [{ GITHUB_ACTIONS: 'false', GITHUB_SHA: 'a'.repeat(40) }],
    [{ GITHUB_ACTIONS: 'true', GITHUB_SHA: 'short' }],
    [{}],
  ])('rejects missing or untrusted provenance: %o', (environment) => {
    expect(() => requireGitHubCommit(environment)).toThrow(
      'candidate evidence requires a GitHub Actions commit identity',
    )
  })
})
