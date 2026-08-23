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
    Object.defineProperty(stderr, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 20 })
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
})
