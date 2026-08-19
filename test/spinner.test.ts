import { stderr } from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import spinlog from '../src/index.js'
import { sanitizeSegment, selectFrame, selectStatus } from '../src/spinner.js'

const ENV_KEYS = [
  'CI',
  'FORCE_COLOR',
  'NO_COLOR',
  'NODE_DISABLE_COLORS',
  'NODE_ENV',
  'TERM',
  'WT_SESSION',
] as const

describe('spinner lifecycle and rendering', () => {
  let environment: Record<string, string | undefined>
  let ttyDescriptor: PropertyDescriptor | undefined
  let write: ReturnType<typeof vi.spyOn>

  function setTTY(value: boolean) {
    Object.defineProperty(stderr, 'isTTY', { configurable: true, value })
  }

  function output() {
    return write.mock.calls.map(([value]) => String(value))
  }

  beforeEach(() => {
    vi.useFakeTimers()
    environment = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
    for (const key of ENV_KEYS) delete process.env[key]
    process.env.NODE_ENV = 'production'
    process.env.FORCE_COLOR = '0'
    process.env.WT_SESSION = 'test-session'
    ttyDescriptor = Object.getOwnPropertyDescriptor(stderr, 'isTTY')
    setTTY(true)
    write = vi.spyOn(stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    for (const key of ENV_KEYS) {
      const value = environment[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    if (ttyDescriptor) Object.defineProperty(stderr, 'isTTY', ttyDescriptor)
    else delete (stderr as { isTTY?: boolean }).isTTY
  })

  it('selects every frozen frame and Unicode fallback', () => {
    expect(Array.from({ length: 10 }, (_, index) => selectFrame('dots', true, index))).toEqual([
      '⠋',
      '⠙',
      '⠹',
      '⠸',
      '⠼',
      '⠴',
      '⠦',
      '⠧',
      '⠇',
      '⠏',
    ])
    expect(selectFrame('dots', true, 10)).toBe('⠋')
    expect(selectFrame('dots', false, 1)).toBe('\\')
    expect(selectFrame('line', true, 2)).toBe('|')
    expect(selectStatus(0, true)).toEqual(['✔', 'green'])
    expect(selectStatus(1, false)).toEqual(['x', 'red'])
  })

  it('sanitizes VT, OSC, line, C0, C1, Unicode line, and bidi controls', () => {
    expect(sanitizeSegment('\x1b[31mred\x1b[0m')).toBe('red')
    expect(sanitizeSegment('a\r\nb')).toBe('a b')
    expect(sanitizeSegment('\x1b]0;title\x07body')).toBe('body')
    expect(sanitizeSegment('\x00a\tb\x7f\x85c\u2028d\u2029')).toBe('a b c d')
    expect(
      sanitizeSegment(
        'safe\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069text',
      ),
    ).toBe('safe text')
  })

  it('validates JavaScript inputs and every mutable field', () => {
    expect(() => spinlog(null as unknown as string)).toThrow('text must be a string')
    expect(() => spinlog('', null as unknown as never)).toThrow('options must be an object')
    expect(() => spinlog('', { color: 'orange' as never })).toThrow(
      'color must be a built-in spinner color',
    )
    expect(() => spinlog('', { spinner: 'custom' as never })).toThrow(
      "spinner must be 'dots' or 'line'",
    )

    const spinner = spinlog()
    for (const field of ['text', 'prefix', 'suffix'] as const) {
      const previous = spinner[field]
      expect(() => Reflect.set(spinner, field, null), field).toThrow(`${field} must be a string`)
      expect(spinner[field]).toBe(previous)
    }
    const previousColor = spinner.color
    expect(() => Reflect.set(spinner, 'color', 'orange')).toThrow(
      'color must be a built-in spinner color',
    )
    expect(spinner.color).toBe(previousColor)
  })

  it('renders immediately, advances every 80ms, applies mutation, and stops idempotently', () => {
    const interval = vi.spyOn(globalThis, 'setInterval')
    const spinner = spinlog('work', {
      color: 'cyan',
      prefix: 'p',
      suffix: 's',
      spinner: 'line',
    })

    expect(spinner.start()).toBe(spinner)
    expect(output()).toEqual(['\x1b[?25l', 'p - work s'])
    expect(vi.getTimerCount()).toBe(1)
    expect(interval.mock.results[0]?.value.hasRef()).toBe(false)

    spinner.start()
    expect(output()).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(80)
    expect(output().slice(-2)).toEqual(['\x1b[2K\r', 'p \\ work s'])

    spinner.prefix = '\x1b[35mP\x1b[0m\n'
    spinner.text = 'a\r\nb'
    spinner.suffix = '\x1b]0;title\x07S'
    spinner.color = 'yellow'
    vi.advanceTimersByTime(80)
    expect(output().slice(-2)).toEqual(['\x1b[2K\r', 'P | a b S'])

    expect(spinner.stop()).toBe(spinner)
    expect(output().slice(-2)).toEqual(['\x1b[2K\r', '\x1b[?25h'])
    expect(vi.getTimerCount()).toBe(0)
    const writes = output().length
    spinner.stop()
    expect(output()).toHaveLength(writes)
  })

  it('colors only frames and fixed status symbols', () => {
    process.env.FORCE_COLOR = '1'
    const spinner = spinlog('work', {
      color: 'magenta',
      prefix: '\x1b[33mprefix\x1b[39m',
      spinner: 'line',
    })

    spinner.start()
    expect(output()[1]).toBe('prefix \x1b[35m-\x1b[39m work')
    spinner.succeed()
    expect(output().at(-2)).toBe('prefix \x1b[32m✔\x1b[39m work\n')

    const bright = spinlog('bright', { color: 'blackBright', spinner: 'line' }).start()
    expect(output().at(-1)).toBe('\x1b[90m-\x1b[39m bright')
    bright.stop()
  })

  it('keeps frames and statuses plain when NO_COLOR conflicts with FORCE_COLOR', () => {
    process.env.FORCE_COLOR = '1'
    process.env.NO_COLOR = '1'
    const spinner = spinlog('work', { color: 'magenta', spinner: 'line' })

    spinner.start()
    expect(output()[1]).toBe('- work')
    spinner.succeed()
    expect(output().at(-2)).toBe('✔ work\n')
  })

  it('degrades deterministically without timers or cursor control', () => {
    setTTY(false)
    const spinner = spinlog('static')

    spinner.start()
    expect(output()).toEqual(['⠋ static\n'])
    expect(vi.getTimerCount()).toBe(0)
    spinner.stop()
    expect(output()).toEqual(['⠋ static\n'])
  })

  it.each([
    ['succeed', '✔', 'succeeded'],
    ['fail', '✖', 'failed'],
    ['warn', '⚠', 'warned'],
    ['info', 'ℹ', 'informed'],
  ] as const)('persists %s once from idle and permits a new cycle', (method, symbol) => {
    setTTY(false)
    const spinner = spinlog('initial')
    const raw = '\x1b[31mdone\x1b[0m\nnow'

    expect(spinner[method](raw)).toBe(spinner)
    expect(spinner.text).toBe(raw)
    expect(output()).toEqual([`${symbol} done now\n`])

    spinner.fail('ignored')
    spinner.stop()
    expect(spinner.text).toBe(raw)
    expect(output()).toHaveLength(1)

    spinner.start()
    expect(output().at(-1)).toBe('⠋ done now\n')
  })

  it('supports stopped-to-terminal and idle-to-stopped transitions without output', () => {
    setTTY(false)
    const spinner = spinlog('work')

    spinner.stop().stop()
    expect(output()).toEqual([])
    spinner.warn()
    expect(output()).toEqual(['⚠ work\n'])
  })

  it('implements start from every frozen source state', () => {
    setTTY(false)
    const sources = ['idle', 'spinning', 'stopped', 'succeeded', 'failed', 'warned', 'informed']

    for (const source of sources) {
      const spinner = spinlog('work')
      if (source === 'spinning') spinner.start()
      else if (source === 'stopped') spinner.stop()
      else if (source === 'succeeded') spinner.succeed()
      else if (source === 'failed') spinner.fail()
      else if (source === 'warned') spinner.warn()
      else if (source === 'informed') spinner.info()
      write.mockClear()

      spinner.start()
      expect(output(), source).toEqual(source === 'spinning' ? [] : ['⠋ work\n'])
    }
  })

  it('implements stop from every frozen source state without static output', () => {
    setTTY(false)
    const sources = ['idle', 'spinning', 'stopped', 'succeeded', 'failed', 'warned', 'informed']

    for (const source of sources) {
      const spinner = spinlog('work')
      if (source === 'spinning') spinner.start()
      else if (source === 'stopped') spinner.stop()
      else if (source === 'succeeded') spinner.succeed()
      else if (source === 'failed') spinner.fail()
      else if (source === 'warned') spinner.warn()
      else if (source === 'informed') spinner.info()
      write.mockClear()

      spinner.stop()
      expect(output(), source).toEqual([])
    }
  })

  it('implements every terminal action from every frozen source state', () => {
    setTTY(false)
    const sources = ['idle', 'spinning', 'stopped', 'succeeded', 'failed', 'warned', 'informed']
    const actions = {
      succeed: '✔',
      fail: '✖',
      warn: '⚠',
      info: 'ℹ',
    } as const

    for (const source of sources) {
      for (const [action, symbol] of Object.entries(actions)) {
        const spinner = spinlog('work')
        if (source === 'spinning') spinner.start()
        else if (source === 'stopped') spinner.stop()
        else if (source === 'succeeded') spinner.succeed()
        else if (source === 'failed') spinner.fail()
        else if (source === 'warned') spinner.warn()
        else if (source === 'informed') spinner.info()
        write.mockClear()

        spinner[action as keyof typeof actions]('next')
        const terminalSource = ['succeeded', 'failed', 'warned', 'informed'].includes(source)
        expect(output(), `${source}.${action}`).toEqual(terminalSource ? [] : [`${symbol} next\n`])
      }
    }
  })

  it.each(['succeed', 'fail', 'warn', 'info'] as const)(
    'validates an invalid %s override before terminal idempotency',
    (method) => {
      setTTY(false)
      const spinner = spinlog('first')
      spinner.succeed('settled')
      const timerCount = vi.getTimerCount()
      const writes = output()

      expect(() => spinner[method](123 as never)).toThrow('text must be a string')
      expect(spinner.text).toBe('settled')
      expect(vi.getTimerCount()).toBe(timerCount)
      expect(output()).toEqual(writes)
    },
  )

  it.each(['idle', 'spinning', 'stopped'] as const)(
    'rejects invalid terminal overrides from the %s state without side effects',
    (source) => {
      const spinner = spinlog('first', { spinner: 'line' })
      if (source === 'spinning') spinner.start()
      if (source === 'stopped') spinner.stop()
      const timerCount = vi.getTimerCount()
      const writes = output()

      expect(() => spinner.fail(null as never)).toThrow('text must be a string')
      expect(spinner.text).toBe('first')
      expect(vi.getTimerCount()).toBe(timerCount)
      expect(output()).toEqual(writes)
    },
  )

  it.each(['idle', 'spinning', 'stopped', 'succeeded', 'failed', 'warned', 'informed'] as const)(
    'rejects invalid overrides for every terminal method from %s',
    (source) => {
      setTTY(false)
      const spinner = spinlog('first', { spinner: 'line' })
      if (source === 'spinning') spinner.start()
      if (source === 'stopped') spinner.stop()
      if (source === 'succeeded') spinner.succeed()
      if (source === 'failed') spinner.fail()
      if (source === 'warned') spinner.warn()
      if (source === 'informed') spinner.info()
      const timerCount = vi.getTimerCount()
      const writes = output()

      for (const method of ['succeed', 'fail', 'warn', 'info'] as const) {
        expect(() => spinner[method](Symbol('invalid') as never), `${source}.${method}`).toThrow(
          'text must be a string',
        )
      }
      expect(spinner.text).toBe('first')
      expect(vi.getTimerCount()).toBe(timerCount)
      expect(output()).toEqual(writes)
    },
  )

  it('treats a false stream backpressure result as a successful cosmetic write', () => {
    write.mockImplementation(() => false)
    const spinner = spinlog('work', { spinner: 'line' }).start()

    expect(vi.getTimerCount()).toBe(1)
    spinner.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([1, 2])(
    'stops and retries after initial interactive write failure at step %s',
    (step) => {
      let call = 0
      write.mockImplementation(() => {
        call += 1
        if (call === step) throw new Error('write failed')
        return true
      })
      const spinner = spinlog('work', { spinner: 'line' })

      spinner.start()
      expect(vi.getTimerCount()).toBe(0)
      expect(output().at(-1)).toBe('\x1b[?25h')

      write.mockImplementation(() => true)
      write.mockClear()
      spinner.start()
      expect(output()).toEqual(['\x1b[?25l', '- work'])
      expect(vi.getTimerCount()).toBe(1)
    },
  )

  it.each(['clear', 'frame'] as const)('stops after an interval %s write failure', (failure) => {
    spinlog('work', { spinner: 'line' }).start()
    write.mockImplementationOnce(() => {
      if (failure === 'clear') throw new Error('clear failed')
      return true
    })
    if (failure === 'frame') {
      write.mockImplementationOnce(() => {
        throw new Error('frame failed')
      })
    }

    vi.advanceTimersByTime(80)
    expect(vi.getTimerCount()).toBe(0)
    expect(output().at(-1)).toBe('\x1b[?25h')
  })

  it('suppresses stop cleanup failure and remains restartable', () => {
    const spinner = spinlog('work', { spinner: 'line' }).start()
    write.mockImplementationOnce(() => {
      throw new Error('clear failed')
    })
    write.mockImplementationOnce(() => true)

    spinner.stop()
    expect(vi.getTimerCount()).toBe(0)
    write.mockImplementation(() => true)
    spinner.start()
    expect(vi.getTimerCount()).toBe(1)
  })

  it.each([1, 2, 3])('preserves terminal state when interactive step %s fails', (step) => {
    const spinner = spinlog('work', { spinner: 'line' }).start()
    let call = 0
    write.mockImplementation(() => {
      call += 1
      if (call === step) throw new Error('terminal write failed')
      return true
    })
    write.mockClear()

    spinner.succeed()
    expect(vi.getTimerCount()).toBe(0)
    const calls = output().length
    spinner.fail()
    expect(output()).toHaveLength(calls)
  })

  it('contains non-interactive start and terminal write failures without cursor output', () => {
    setTTY(false)
    const spinner = spinlog('work')
    write.mockImplementationOnce(() => {
      throw new Error('static start failed')
    })
    spinner.start()
    expect(output()).toEqual(['⠋ work\n'])

    write.mockImplementation(() => true)
    spinner.start()
    expect(output().at(-1)).toBe('⠋ work\n')
    write.mockImplementationOnce(() => {
      throw new Error('static status failed')
    })
    spinner.info()
    const count = output().length
    spinner.fail()
    expect(output()).toHaveLength(count)
    expect(output()).not.toContain('\x1b[?25h')
  })

  it('does not install process or stream listeners or call host termination APIs', () => {
    const signals = ['SIGINT', 'SIGTERM', 'exit'] as const
    const before = signals.map((signal) => process.listenerCount(signal))
    const streamErrors = stderr.listenerCount('error')
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    const kill = vi.spyOn(process, 'kill').mockImplementation((() => true) as never)

    spinlog('work', { spinner: 'line' }).start().stop()

    expect(signals.map((signal) => process.listenerCount(signal))).toEqual(before)
    expect(stderr.listenerCount('error')).toBe(streamErrors)
    expect(exit).not.toHaveBeenCalled()
    expect(kill).not.toHaveBeenCalled()
  })
})
