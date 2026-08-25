import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semanticTokensFromReport } from '../scripts/api-report-policy.mjs'

const baseline = `/** Spinner instance. */
export interface Spinner { text: string; start(): this }
export interface Spinlog { (text?: string): Spinner; promise<T>(input: PromiseLike<T>): Promise<T> }
declare const spinlog: Spinlog
export default spinlog
`

function reportFor(declaration: string): string {
  return `## API Report\n\n\`\`\`ts\n${declaration}\`\`\`\n`
}

function tokensFor(declaration: string): string[] {
  return semanticTokensFromReport(reportFor(declaration))
}

describe('API Extractor semantic contract reports', () => {
  it('ignores documentation-only declaration changes', () => {
    expect(
      tokensFor(baseline.replace('Spinner instance.', 'Updated spinner documentation.')),
    ).toEqual(tokensFor(baseline))
  })

  it('ignores semantically empty trailing declaration commas', () => {
    expect(
      tokensFor(
        baseline.replace(
          'promise<T>(input: PromiseLike<T>): Promise<T>',
          'promise<T>(input: PromiseLike<T>,): Promise<T>',
        ),
      ),
    ).toEqual(tokensFor(baseline))
  })

  it.each([
    ['signature', baseline.replace('text?: string', 'text: number')],
    [
      'overload',
      baseline.replace(
        'promise<T>(input: PromiseLike<T>): Promise<T>',
        'promise<T>(input: PromiseLike<T>): Promise<T>; promise<T>(input: T): T',
      ),
    ],
    ['property', baseline.replace('text: string', 'text: number')],
    ['return type', baseline.replace('start(): this', 'start(): void')],
    ['extra export', `${baseline}export declare const unexpected: true\n`],
  ])('detects %s drift', (_kind, candidate) => {
    expect(tokensFor(candidate)).not.toEqual(tokensFor(baseline))
  })

  it('parses the tracked API Extractor reports', () => {
    for (const path of ['etc/spinlog.api.md', 'etc/spinlog-styles.api.md']) {
      expect(semanticTokensFromReport(readFileSync(path, 'utf8'), path).length).toBeGreaterThan(0)
    }
  })
})
