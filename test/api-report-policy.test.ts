import { describe, expect, it } from 'vitest'

import { semanticTokensFromReport } from '../scripts/api-report-policy.mjs'

function report(declaration: string) {
  return `# API report\n\n\`\`\`ts\n${declaration}\n\`\`\`\n`
}

describe('API report semantic token policy', () => {
  it('ignores documentation, whitespace, semicolons, quote style, and an optional leading union bar', () => {
    const documented = report(`
      /** Public color. */
      export type Color =
        | 'red'
        | 'blue';
    `)
    const compact = report('export type Color = "red" | "blue"')

    expect(semanticTokensFromReport(documented)).toEqual(semanticTokensFromReport(compact))
  })

  it('preserves identifiers, numbers, and punctuation as semantic evidence', () => {
    const baseline = semanticTokensFromReport(report('export interface Value { count: 10 }'))
    const drifted = semanticTokensFromReport(report('export interface Value { count: 11 }'))

    expect(drifted).not.toEqual(baseline)
    expect(baseline).toContain('number:10')
  })

  it('rejects malformed reports and unterminated lexical structures', () => {
    expect(() => semanticTokensFromReport('not a report', 'missing.md')).toThrow(
      'API report does not contain a TypeScript declaration block: missing.md',
    )
    expect(() => semanticTokensFromReport(report('/* unterminated'), 'comment.md')).toThrow(
      'Unterminated block comment in API report: comment.md',
    )
    expect(() =>
      semanticTokensFromReport(report("export type Value = 'unterminated"), 'string.md'),
    ).toThrow('Unterminated string in API report: string.md')
  })
})
