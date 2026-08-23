import { stderr } from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import spinlog, { type Spinner } from '../src/index.js'

describe('static policies and coordinated logging', () => {
  let write: ReturnType<typeof vi.spyOn>
  let ttyDescriptor: PropertyDescriptor | undefined
  let columnsDescriptor: PropertyDescriptor | undefined

  function output(): string[] {
    return write.mock.calls.map(([value]) => String(value))
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('CI', '')
    vi.stubEnv('FORCE_COLOR', '0')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NO_COLOR', '')
    vi.stubEnv('NODE_DISABLE_COLORS', '')
    vi.stubEnv('TERM', 'xterm-256color')
    vi.stubEnv('WT_SESSION', 'test-session')
    ttyDescriptor = Object.getOwnPropertyDescriptor(stderr, 'isTTY')
    columnsDescriptor = Object.getOwnPropertyDescriptor(stderr, 'columns')
    Object.defineProperty(stderr, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 80 })
    write = vi.spyOn(stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    if (ttyDescriptor) Object.defineProperty(stderr, 'isTTY', ttyDescriptor)
    else delete (stderr as { isTTY?: boolean }).isTTY
    if (columnsDescriptor) Object.defineProperty(stderr, 'columns', columnsDescriptor)
    else delete (stderr as { columns?: number }).columns
  })

  it('preserves symbolic output and provides text and silent static policies', () => {
    spinlog('symbol', { spinner: 'line', terminal: 'static' }).start().succeed()
    expect(output()).toEqual(['- symbol\n', '✔ symbol\n'])

    write.mockClear()
    spinlog('text', {
      prefix: 'build',
      suffix: 'now',
      static: 'text',
      terminal: 'static',
    })
      .start()
      .succeed()
    expect(output()).toEqual(['build text now\n', 'build text now\n'])

    write.mockClear()
    const silent = spinlog('silent', { static: 'silent', terminal: 'static' }).start().succeed()
    expect(output()).toEqual([])
    expect(silent.log('visible')).toBe(silent)
    expect(output()).toEqual(['visible\n'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies configured static output after lease contention and width demotion', () => {
    const primary = spinlog('primary', { static: 'text', spinner: 'line' }).start()
    spinlog('secondary', { static: 'text', spinner: 'line' }).start().succeed()
    expect(output().at(-1)).toBe('\x1b[2K\rsecondary\n- primary')

    primary.text = 'a message that cannot fit'
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 10 })
    vi.advanceTimersByTime(80)
    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[?25ha message that cannot fit\n')
    primary.succeed()
    expect(output().at(-1)).toBe('a message that cannot fit\n')
  })

  it('restores an interactive silent spinner when width demotion suppresses fallback output', () => {
    const spinner = spinlog('a message that cannot fit', {
      static: 'silent',
      spinner: 'line',
    }).start()
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 10 })

    vi.advanceTimersByTime(80)

    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[?25h')
    expect(vi.getTimerCount()).toBe(0)
    spinner.succeed()
    expect(output().at(-1)).toBe('\x1b[2K\r\x1b[?25h')
  })

  it('allows an explicit interactive override only for a non-dumb TTY', () => {
    vi.stubEnv('TERM', 'unknown')
    vi.stubEnv('CI', '1')
    const spinner = spinlog('forced', { spinner: 'line', terminal: 'interactive' }).start()

    expect(output()).toEqual(['\x1b[?25l- forced'])
    expect(vi.getTimerCount()).toBe(1)
    spinner.stop()

    write.mockClear()
    vi.stubEnv('TERM', 'dumb')
    spinlog('dumb', { spinner: 'line', terminal: 'interactive' }).start()
    expect(output()).toEqual(['- dumb\n'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('writes sanitized permanent lines from every lifecycle state without mutating state', () => {
    const transitions: Array<[string, (spinner: Spinner) => void]> = [
      ['idle', () => {}],
      [
        'spinning',
        (spinner) => {
          spinner.start()
        },
      ],
      [
        'stopped',
        (spinner) => {
          spinner.stop()
        },
      ],
      [
        'succeeded',
        (spinner) => {
          spinner.succeed()
        },
      ],
      [
        'failed',
        (spinner) => {
          spinner.fail()
        },
      ],
      [
        'warned',
        (spinner) => {
          spinner.warn()
        },
      ],
      [
        'informed',
        (spinner) => {
          spinner.info()
        },
      ],
    ]

    for (const [state, transition] of transitions) {
      const spinner = spinlog('work', { static: 'silent', terminal: 'static' })
      transition(spinner)
      expect(spinner.log(`\x1b[31m${state}\x1b[0m\r\nline`)).toBe(spinner)
    }

    expect(output()).toEqual([
      'idle line\n',
      'spinning line\n',
      'stopped line\n',
      'succeeded line\n',
      'failed line\n',
      'warned line\n',
      'informed line\n',
    ])
  })

  it('coordinates active logs and contains validation, backpressure, and write failures', () => {
    const spinner = spinlog('work', { spinner: 'line' }).start()
    expect(spinner.log('before\r\nafter')).toBe(spinner)
    expect(output().at(-1)).toBe('\x1b[2K\rbefore after\n- work')
    expect(vi.getTimerCount()).toBe(1)

    write.mockClear()
    expect(() => spinner.log(null as unknown as string)).toThrow('message must be a string')
    expect(output()).toEqual([])

    write.mockImplementationOnce(() => false)
    expect(() => spinner.log('backpressure')).not.toThrow()
    expect(vi.getTimerCount()).toBe(1)

    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    expect(() => spinner.log('failure')).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
    expect(spinner.start()).toBe(spinner)
    expect(vi.getTimerCount()).toBe(1)
    spinner.stop()
  })
})
