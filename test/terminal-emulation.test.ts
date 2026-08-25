import { stderr } from 'node:process'

import { Terminal } from '@xterm/headless'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import spinlog from '../src/index.js'

function replay(terminal: Terminal, transcript: string): Promise<void> {
  return new Promise((resolve) => terminal.write(transcript, resolve))
}

function visibleLines(terminal: Terminal): string[] {
  return Array.from(
    { length: terminal.rows },
    (_, index) => terminal.buffer.active.getLine(index)?.translateToString(true) ?? '',
  ).filter(Boolean)
}

describe('terminal screen replay', () => {
  let ttyDescriptor: PropertyDescriptor | undefined
  let columnsDescriptor: PropertyDescriptor | undefined
  let rowsDescriptor: PropertyDescriptor | undefined
  let transcript = ''

  beforeEach(() => {
    transcript = ''
    vi.stubEnv('CI', '')
    vi.stubEnv('FORCE_COLOR', '0')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TERM', 'xterm-256color')
    vi.stubEnv('WT_SESSION', 'test-session')
    ttyDescriptor = Object.getOwnPropertyDescriptor(stderr, 'isTTY')
    columnsDescriptor = Object.getOwnPropertyDescriptor(stderr, 'columns')
    rowsDescriptor = Object.getOwnPropertyDescriptor(stderr, 'rows')
    Object.defineProperty(stderr, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 20 })
    Object.defineProperty(stderr, 'rows', { configurable: true, value: 8 })
    vi.spyOn(stderr, 'write').mockImplementation((value) => {
      transcript += String(value)
      return true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    if (ttyDescriptor) Object.defineProperty(stderr, 'isTTY', ttyDescriptor)
    else delete (stderr as { isTTY?: boolean }).isTTY
    if (columnsDescriptor) Object.defineProperty(stderr, 'columns', columnsDescriptor)
    else delete (stderr as { columns?: number }).columns
    if (rowsDescriptor) Object.defineProperty(stderr, 'rows', rowsDescriptor)
    else delete (stderr as { rows?: number }).rows
  })

  it('preserves flow and terminal lines when replayed through an ANSI terminal', async () => {
    const spinner = spinlog('work', { spinner: 'line' }).start()
    spinlog.intro('Build')
    spinlog.outro('Done')
    spinner.succeed()

    const terminal = new Terminal({ allowProposedApi: true, cols: 20, convertEol: true, rows: 5 })
    await replay(terminal, transcript)

    expect(visibleLines(terminal)).toEqual(['┌  Build', '└  Done', '✔ work'])
    terminal.dispose()
  })

  it('keeps a leased interactive frame intact around a secondary static spinner', async () => {
    const primary = spinlog('primary', { spinner: 'line' }).start()
    const secondary = spinlog('secondary', { spinner: 'line' }).start()
    secondary.succeed()
    primary.succeed()

    const terminal = new Terminal({ allowProposedApi: true, cols: 20, convertEol: true, rows: 5 })
    await replay(terminal, transcript)

    expect(visibleLines(terminal)).toEqual(['- secondary', '\u2714 secondary', '\u2714 primary'])
    terminal.dispose()
  })

  it('replays coordinated logs and every static mode without corrupting the active frame', async () => {
    const primary = spinlog('primary', { spinner: 'line' }).start()
    primary.log('checkpoint one').log('checkpoint two')
    spinlog('text', { static: 'text', terminal: 'static' }).start().succeed()
    spinlog('hidden', { static: 'silent', terminal: 'static' }).start().succeed()
    primary.succeed()

    const terminal = new Terminal({ allowProposedApi: true, cols: 20, convertEol: true, rows: 7 })
    await replay(terminal, transcript)

    expect(visibleLines(terminal)).toEqual([
      'checkpoint one',
      'checkpoint two',
      'text',
      'text',
      '\u2714 primary',
    ])
    terminal.dispose()
  })

  it('demotes a narrow interactive frame to static output without cursor controls', async () => {
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 6 })
    const spinner = spinlog('wide', { spinner: 'line' }).start()
    spinner.succeed()

    expect(transcript).not.toContain('\x1b[?25l')

    const terminal = new Terminal({ allowProposedApi: true, cols: 20, convertEol: true, rows: 5 })
    await replay(terminal, transcript)

    expect(visibleLines(terminal)).toEqual(['- wide', '\u2714 wide'])
    terminal.dispose()
  })

  it('replays group rows, coordinated group logs, and completed group rows faithfully', async () => {
    const group = spinlog.group()
    const install = group.add('install', { spinner: 'line' }).start()
    const build = group.add('build', { spinner: 'line' }).start()
    install.log('downloaded manifest')
    install.succeed()
    build.succeed()

    const terminal = new Terminal({ allowProposedApi: true, cols: 20, convertEol: true, rows: 6 })
    await replay(terminal, transcript)

    expect(visibleLines(terminal)).toEqual([
      'downloaded manifest',
      '\u2714 install',
      '\u2714 build',
    ])
    terminal.dispose()
  })

  it('replays progress contention and group height fallback without corrupting permanent output', async () => {
    const primary = spinlog('root', { spinner: 'line' }).start()
    const progress = spinlog.progress('copy', { total: 4, width: 5, style: 'ascii' }).start()
    progress.update(1).succeed()
    primary.succeed()

    Object.defineProperty(stderr, 'rows', { configurable: true, value: 1 })
    const staticGroup = spinlog.group()
    staticGroup.add('height safe', { spinner: 'line' }).start().succeed()

    const terminal = new Terminal({ allowProposedApi: true, cols: 20, convertEol: true, rows: 7 })
    await replay(terminal, transcript)

    expect(visibleLines(terminal)).toEqual([
      '[-----] 0% copy',
      '\u2714 100% copy',
      '\u2714 root',
      '- height safe',
      '\u2714 height safe',
    ])
    terminal.dispose()
  })

  it('atomically replays a group resize fallback as static output', async () => {
    const group = spinlog.group()
    const child = group.add('short', { spinner: 'line' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 5 })
    child.text = 'wide'

    expect(transcript).toContain('\x1b[?25h')
    const terminal = new Terminal({ allowProposedApi: true, cols: 20, convertEol: true, rows: 4 })
    await replay(terminal, transcript)

    expect(visibleLines(terminal)).toEqual(['- wide'])
    terminal.dispose()
  })
})
