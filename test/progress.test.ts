import { stderr, stdout } from 'node:process'
import { PassThrough } from 'node:stream'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import spinlog from '../src/index.js'
import { acceptWrite } from './write-callback.js'

describe('progress indicators', () => {
  let write: ReturnType<typeof vi.spyOn>
  let stdoutWrite: ReturnType<typeof vi.spyOn>
  let ttyDescriptor: PropertyDescriptor | undefined
  let columnsDescriptor: PropertyDescriptor | undefined

  function output(): string[] {
    return write.mock.calls.map(([value]) => String(value))
  }

  function createTTYTarget(columns = 80): PassThrough {
    const target = new PassThrough()
    Object.defineProperty(target, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(target, 'columns', { configurable: true, value: columns })
    return target
  }

  beforeEach(() => {
    vi.stubEnv('CI', '')
    vi.stubEnv('FORCE_COLOR', '0')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TERM', 'xterm-256color')
    vi.stubEnv('WT_SESSION', 'test-session')
    ttyDescriptor = Object.getOwnPropertyDescriptor(stderr, 'isTTY')
    columnsDescriptor = Object.getOwnPropertyDescriptor(stderr, 'columns')
    Object.defineProperty(stderr, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 80 })
    write = vi.spyOn(stderr, 'write')
    write.mockImplementation(acceptWrite(write) as never)
    stdoutWrite = vi.spyOn(stdout, 'write')
    stdoutWrite.mockImplementation(acceptWrite(stdoutWrite) as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    if (ttyDescriptor) Object.defineProperty(stderr, 'isTTY', ttyDescriptor)
    else delete (stderr as { isTTY?: boolean }).isTTY
    if (columnsDescriptor) Object.defineProperty(stderr, 'columns', columnsDescriptor)
    else delete (stderr as { columns?: number }).columns
  })

  it('renders, updates, logs, and settles a determinate interactive line', () => {
    const progress = spinlog.progress('upload', { total: 4 }).start()
    progress.increment(2).update(3).log('checkpoint').succeed()

    expect(progress.value).toBe(4)

    expect(output()).toEqual([
      '\x1b[?25l[░░░░░░░░░░░░░░░░░░░░] 0% upload',
      '\x1b[2K\r[██████████░░░░░░░░░░] 50% upload',
      '\x1b[2K\r[███████████████░░░░░] 75% upload',
      '\x1b[2K\rcheckpoint\n[███████████████░░░░░] 75% upload',
      '\x1b[2K\r✔ 100% upload\n\x1b[?25h',
    ])
    expect(stdoutWrite).not.toHaveBeenCalled()
  })

  it('uses deterministic static text and silent policies without timers', () => {
    spinlog
      .progress('copy', { total: 2, value: 1, terminal: 'static', static: 'text' })
      .start()
      .increment()
      .succeed()
    expect(output()).toEqual(['50% copy\n', '100% copy\n'])

    write.mockClear()
    const silent = spinlog.progress('quiet', { total: 1, terminal: 'static', static: 'silent' })
    silent.start().succeed()
    expect(output()).toEqual([])
    silent.log('visible')
    expect(output()).toEqual(['visible\n'])
  })

  it('exposes a resolved flush boundary for progress output', async () => {
    const progress = spinlog.progress('copy', { total: 1 }).start().succeed()
    await expect(progress.flush()).resolves.toBeUndefined()
  })

  it('validates total, values, updates, increments, and terminal overrides before effects', () => {
    expect(() => spinlog.progress('bad', { total: 0 })).toThrow(
      'total must be a positive safe integer',
    )
    expect(() => spinlog.progress('bad', { total: 1, value: 2 })).toThrow(
      'value must be an integer',
    )

    const progress = spinlog.progress('work', { total: 2, terminal: 'static' })
    expect(() => progress.update(-1)).toThrow('value must be an integer')
    expect(() => progress.increment(1.5)).toThrow('amount must be a positive safe integer')
    expect(() => progress.increment(0)).toThrow('amount must be a positive safe integer')
    expect(() => progress.increment(-1)).toThrow('amount must be a positive safe integer')
    progress.succeed()
    expect(() => progress.fail(42 as unknown as string)).toThrow('text must be a string')
    expect(output()).toEqual(['✔ 100% work\n'])
  })

  it('keeps total immutable and floors each determinate bar fill', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('WT_SESSION', '')

    const progress = spinlog.progress('one', { total: 100, value: 1, terminal: 'static' })
    expect(Reflect.set(progress, 'total', 99)).toBe(false)
    expect(progress.total).toBe(100)
    progress.start()
    expect(output()).toEqual(['[--------------------] 1% one\n'])

    write.mockClear()
    spinlog.progress('five', { total: 100, value: 5, terminal: 'static' }).start()
    expect(output()).toEqual(['[#-------------------] 5% five\n'])

    write.mockClear()
    spinlog.progress('ninety-nine', { total: 100, value: 99, terminal: 'static' }).start()
    expect(output()).toEqual(['[###################-] 99% ninety-nine\n'])

    write.mockClear()
    spinlog.progress('complete', { total: 100, value: 100, terminal: 'static' }).start()
    expect(output()).toEqual(['[####################] 100% complete\n'])
  })

  it('validates and applies custom bar width and ASCII style', () => {
    const options = { total: 10, value: 5, terminal: 'static', width: 5, style: 'ascii' } as const
    spinlog.progress('custom', options).start()
    expect(output()).toEqual(['[##---] 50% custom\n'])

    expect(() => spinlog.progress('narrow', { total: 1, width: 4 })).toThrow(
      'width must be an integer between 5 and 40',
    )
    expect(() => spinlog.progress('wide', { total: 1, width: 41 })).toThrow(
      'width must be an integer between 5 and 40',
    )
    expect(() => spinlog.progress('style', { total: 1, style: 'dots' as never })).toThrow(
      "style must be 'blocks' or 'ascii'",
    )
  })

  it('keeps progress target-local and honors color, Unicode, cursor, and indent overrides', () => {
    vi.stubEnv('FORCE_COLOR', '1')
    const target = createTTYTarget()
    const targetWrite = vi.spyOn(target, 'write')
    targetWrite.mockImplementation(acceptWrite(targetWrite) as never)
    const progress = spinlog
      .progress('custom', {
        total: 4,
        stream: target,
        color: false,
        unicode: false,
        hideCursor: false,
        indent: 2,
        terminal: 'interactive',
      })
      .start()

    expect(output()).toEqual([])
    expect(targetWrite).toHaveBeenLastCalledWith('  [--------------------] 0% custom')

    progress.increment().succeed()
    const targetOutput = targetWrite.mock.calls.map(([value]) => String(value))
    expect(targetOutput).toEqual([
      '  [--------------------] 0% custom',
      '\x1b[2K\r  [#####---------------] 25% custom',
      '\x1b[2K\r  + 100% custom\n',
    ])
    expect(targetOutput.join('')).not.toContain('\x1b[36m')
    expect(targetOutput.join('')).not.toContain('\x1b[32m')
  })

  it('allows independent interactive progress surfaces and logs per writable stream', () => {
    const firstTarget = createTTYTarget()
    const secondTarget = createTTYTarget()
    const firstWrite = vi.spyOn(firstTarget, 'write')
    firstWrite.mockImplementation(acceptWrite(firstWrite) as never)
    const secondWrite = vi.spyOn(secondTarget, 'write')
    secondWrite.mockImplementation(acceptWrite(secondWrite) as never)

    const first = spinlog
      .progress('first', { total: 1, stream: firstTarget, terminal: 'interactive' })
      .start()
    const second = spinlog
      .progress('second', { total: 1, stream: secondTarget, terminal: 'interactive' })
      .start()

    expect(firstWrite).toHaveBeenCalledWith('\x1b[?25l[░░░░░░░░░░░░░░░░░░░░] 0% first')
    expect(secondWrite).toHaveBeenCalledWith('\x1b[?25l[░░░░░░░░░░░░░░░░░░░░] 0% second')
    first.log('first-only')
    expect(secondWrite).toHaveBeenCalledTimes(1)
    expect(firstWrite.mock.calls.map(([value]) => String(value)).at(-1)).toBe(
      '\x1b[2K\rfirst-only\n[░░░░░░░░░░░░░░░░░░░░] 0% first',
    )

    first.stop()
    second.stop()
  })

  it('includes indentation in the interactive width budget', () => {
    const target = createTTYTarget(37)
    const targetWrite = vi.spyOn(target, 'write')
    targetWrite.mockImplementation(acceptWrite(targetWrite) as never)

    spinlog
      .progress('width', { total: 1, stream: target, indent: 5, terminal: 'interactive' })
      .start()

    expect(targetWrite).toHaveBeenCalledWith('     [░░░░░░░░░░░░░░░░░░░░] 0% width\n')
  })

  it('demotes on width loss and contains synchronous write failures', () => {
    const progress = spinlog.progress('wide', { total: 2 }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 8 })
    progress.update(1)
    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[?25h[██████████░░░░░░░░░░] 50% wide\n')

    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    expect(() => progress.log('failure')).not.toThrow()
    expect(progress.start()).toBe(progress)
    progress[Symbol.dispose]()
  })

  it('preflights a resized target before a coordinated log redraws active progress', () => {
    const progress = spinlog.progress('work', { total: 2, width: 5, style: 'ascii' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 8 })

    progress.log('checkpoint')

    expect(output()).toEqual([
      '\x1b[?25l[-----] 0% work',
      '\x1b[2K\r\x1b[?25h[-----] 0% work\n',
      'checkpoint\n',
    ])
    progress.succeed()
    expect(output().at(-1)).toBe('✔ 100% work\n')
  })

  it('shares the interactive lease with spinners and preserves caller-owned fields', () => {
    const primary = spinlog('work', { spinner: 'line' }).start()
    const progress = spinlog.progress('copy', { total: 1 }).start()
    expect(output().at(-1)).toBe('\x1b[2K\r[░░░░░░░░░░░░░░░░░░░░] 0% copy\n- work')
    progress.text = '\x1b[31mcopy\x1b[0m'
    expect(progress.text).toContain('\x1b[31m')
    primary.stop()
  })

  it('supports every mutable field, stop cycle, terminal action, and ASCII fallback', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('WT_SESSION', '')
    const progress = spinlog.progress('copy', { total: 2, terminal: 'static' })
    expect(progress.total).toBe(2)
    expect(progress.value).toBe(0)
    progress.value = 1
    progress.text = 'changed'
    progress.color = 'red'
    progress.prefix = 'before'
    progress.suffix = 'after'
    expect([progress.color, progress.prefix, progress.suffix]).toEqual(['red', 'before', 'after'])
    progress.start().start().stop().stop().start().warn('done').info()

    expect(output()).toEqual([
      'before [##########----------] 50% changed after\n',
      'before [##########----------] 50% changed after\n',
      'before ! 50% done after\n',
    ])
  })

  it('uses color only for the bar and contains start, redraw, and final write failures', () => {
    vi.stubEnv('FORCE_COLOR', '1')
    const colored = spinlog.progress('color', { total: 1 }).start()
    expect(output()[0]).toContain('\x1b[36m')
    colored.stop()

    write.mockClear()
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    const retry = spinlog.progress('retry', { total: 1 }).start()
    expect(retry.start()).toBe(retry)
    retry.start().stop()

    write.mockClear()
    const redraw = spinlog.progress('redraw', { total: 2 }).start()
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    redraw.update(1)
    expect(redraw.start()).toBe(redraw)

    write.mockClear()
    const terminal = spinlog.progress('terminal', { total: 1 }).start()
    write
      .mockImplementationOnce(() => {
        throw new Error('stderr unavailable')
      })
      .mockImplementationOnce(() => {
        throw new Error('stderr unavailable')
      })
    expect(() => terminal.fail()).not.toThrow()

    write.mockClear()
    const staticFailure = spinlog.progress('static', { total: 1, terminal: 'static' })
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    staticFailure.start()
    expect(staticFailure.start()).toBe(staticFailure)

    write.mockClear()
    const demotionFailure = spinlog.progress('wide', { total: 1 }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 8 })
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    demotionFailure.update(1)
    expect(demotionFailure.start()).toBe(demotionFailure)
  })

  it('suppresses terminal restoration failures and silent width-demotion output', () => {
    const terminal = spinlog.progress('terminal', { total: 1 }).start()
    write.mockImplementation(() => {
      throw new Error('stderr unavailable')
    })
    expect(() => terminal.fail()).not.toThrow()

    vi.restoreAllMocks()
    write = vi.spyOn(stderr, 'write')
    write.mockImplementation(acceptWrite(write) as never)
    const silent = spinlog.progress('wide', { total: 1, static: 'silent' }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 8 })
    silent.update(1)
    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[?25h')
  })
})
