import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const extractor = resolve('node_modules/@microsoft/api-extractor/bin/api-extractor')
const workspaces: string[] = []
let reportWorkspace = ''
const baseline = `/** Spinner instance. */
export interface Spinner { text: string; start(): this }
export interface Spinlog { (text?: string): Spinner; promise<T>(input: PromiseLike<T>): Promise<T> }
declare const spinlog: Spinlog
export default spinlog
`

afterAll(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { force: true, recursive: true })
})

function runApiReport(entry: string, report: string, local = false) {
  const workspace = mkdtempSync(join(tmpdir(), 'spinlog-api-report-'))
  workspaces.push(workspace)
  const main = join(workspace, 'index.d.ts')
  const config = join(workspace, 'api-extractor.json')
  writeFileSync(main, entry)
  writeFileSync(
    join(workspace, 'package.json'),
    JSON.stringify({
      name: 'spinlog-api-fixture',
      private: true,
      types: './index.d.ts',
      version: '1.0.0',
    }),
  )
  writeFileSync(
    config,
    JSON.stringify({
      $schema:
        'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',
      projectFolder: workspace,
      mainEntryPointFilePath: main,
      compiler: { tsconfigFilePath: join(workspace, 'tsconfig.json') },
      apiReport: {
        enabled: true,
        reportFileName: 'fixture.api.md',
        reportFolder: report,
        reportTempFolder: join(workspace, 'temp'),
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      tsdocMetadata: { enabled: false },
      messages: { extractorMessageReporting: { 'ae-missing-release-tag': { logLevel: 'none' } } },
    }),
  )
  writeFileSync(
    join(workspace, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { skipLibCheck: false } }),
  )
  return spawnSync(
    process.execPath,
    [extractor, 'run', '--config', config, ...(local ? ['--local'] : [])],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  )
}

function reportFor(candidate: string) {
  return runApiReport(candidate, reportWorkspace)
}

describe('API Extractor semantic contract reports', () => {
  beforeAll(() => {
    reportWorkspace = mkdtempSync(join(tmpdir(), 'spinlog-api-report-baseline-'))
    workspaces.push(reportWorkspace)
    const result = runApiReport(baseline, reportWorkspace, true)
    expect(result.status, result.stderr || result.stdout || String(result.error)).toBe(0)
  }, 30_000)

  it('accepts documentation-only declaration changes', () => {
    const result = reportFor(
      baseline.replace('Spinner instance.', 'Updated spinner documentation.'),
    )

    expect(result.status, result.stderr || result.stdout || String(result.error)).toBe(0)
  }, 30_000)

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
  ])(
    'rejects %s drift',
    (_kind, candidate) => {
      const result = reportFor(candidate)

      expect(result.status).not.toBe(0)
    },
    30_000,
  )

  it('tracks the checked-in reports rather than generated declaration prose', () => {
    const rootReport = readFileSync('api-extractor.root.contract.json', 'utf8')
    const stylesReport = readFileSync('api-extractor.styles.contract.json', 'utf8')

    expect(rootReport).toContain('spinlog.api.md')
    expect(stylesReport).toContain('spinlog-styles.api.md')
  })
})
