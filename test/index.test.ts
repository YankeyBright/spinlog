import { stderr, stdout } from 'node:process'

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import { sortCanonicalText } from '../scripts/canonical-order.mjs'
import spinlog, * as moduleExports from '../src/index.js'
import type { Spinner } from '../src/index.js'

const STYLE_EXPORTS = [
  'reset',
  'bold',
  'dim',
  'italic',
  'underline',
  'strikethrough',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
  'bgBlack',
  'bgRed',
  'bgGreen',
  'bgYellow',
  'bgBlue',
  'bgMagenta',
  'bgCyan',
  'bgWhite',
  'bgBlackBright',
  'bgRedBright',
  'bgGreenBright',
  'bgYellowBright',
  'bgBlueBright',
  'bgMagentaBright',
  'bgCyanBright',
  'bgWhiteBright',
]

describe('public runtime surface', () => {
  it('exports only the callable default and frozen named styles', () => {
    expect(sortCanonicalText(Object.keys(moduleExports))).toEqual(
      sortCanonicalText(['default', ...STYLE_EXPORTS]),
    )
    expect(spinlog).toBeTypeOf('function')
    expect(spinlog.promise).toBeTypeOf('function')
    expect(spinlog.intro).toBeTypeOf('function')
    expect(spinlog.outro).toBeTypeOf('function')
    expectTypeOf(spinlog.intro).returns.toBeVoid()
    expectTypeOf(spinlog.outro).returns.toBeVoid()
  })

  it('returns an instance with only the frozen fields and lifecycle methods', () => {
    expect(Object.keys(spinlog())).toEqual([
      'text',
      'color',
      'prefix',
      'suffix',
      'start',
      'stop',
      'log',
      'succeed',
      'fail',
      'warn',
      'info',
    ])
    expect(typeof spinlog()[Symbol.dispose]).toBe('function')
    expectTypeOf(spinlog()[Symbol.dispose]).returns.toBeVoid()
    expectTypeOf(spinlog().log).parameter(0).toEqualTypeOf<string>()
    expectTypeOf(spinlog().log).returns.toEqualTypeOf<Spinner>()
  })
})

describe('intro and outro flow messages', () => {
  let write: ReturnType<typeof vi.spyOn>
  let stdoutWrite: ReturnType<typeof vi.spyOn>
  let ttyDescriptor: PropertyDescriptor | undefined
  let columnsDescriptor: PropertyDescriptor | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CI', '1')
    vi.stubEnv('FORCE_COLOR', '0')
    vi.stubEnv('WT_SESSION', 'test-session')
    vi.stubEnv('TERM', 'xterm-256color')
    ttyDescriptor = Object.getOwnPropertyDescriptor(stderr, 'isTTY')
    columnsDescriptor = Object.getOwnPropertyDescriptor(stderr, 'columns')
    Object.defineProperty(stderr, 'isTTY', { configurable: true, value: true })
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 80 })
    write = vi.spyOn(stderr, 'write').mockImplementation(() => true)
    stdoutWrite = vi.spyOn(stdout, 'write').mockImplementation(() => true)
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

  it('writes Unicode, empty, and repeated messages exactly once per call', () => {
    expect(spinlog.intro('Build')).toBeUndefined()
    spinlog.outro('Done')
    spinlog.intro()
    spinlog.outro('')
    spinlog.intro('Again')

    expect(write.mock.calls.map(([value]) => String(value))).toEqual([
      '┌  Build\n',
      '└  Done\n',
      '┌\n',
      '└\n',
      '┌  Again\n',
    ])
    expect(stdoutWrite).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses ASCII markers when Unicode is unavailable', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    vi.stubEnv('WT_SESSION', '')

    spinlog.intro('Build')
    spinlog.outro('Done')

    expect(write.mock.calls.map(([value]) => String(value))).toEqual(['>  Build\n', '<  Done\n'])
  })

  it('colors only the marker and honors explicit color-disable precedence', () => {
    vi.stubEnv('FORCE_COLOR', '1')
    vi.stubEnv('NO_COLOR', '')
    spinlog.intro('Build')
    expect(write).toHaveBeenLastCalledWith('\x1b[90m┌\x1b[39m  Build\n')

    vi.stubEnv('NO_COLOR', '1')
    spinlog.outro('Done')
    expect(write).toHaveBeenLastCalledWith('└  Done\n')
  })

  it('sanitizes terminal controls without mutating caller-owned text', () => {
    const message = '\x1b[31mred\x1b[0m\r\nnext\u202ehidden\x1b]0;title\x07'
    spinlog.intro(message)

    expect(message).toContain('\x1b[31m')
    expect(write).toHaveBeenCalledWith('┌  red next hidden\n')
  })

  it('validates before capability detection or output', () => {
    const environmentDescriptor = Object.getOwnPropertyDescriptor(process, 'env')
    Object.defineProperty(process, 'env', {
      configurable: true,
      get() {
        throw new Error('capability detection occurred')
      },
    })

    try {
      expect(() => spinlog.intro(42 as unknown as string)).toThrow('message must be a string')
      expect(() => spinlog.outro(null as unknown as string)).toThrow('message must be a string')
      expect(write).not.toHaveBeenCalled()
    } finally {
      if (environmentDescriptor) Object.defineProperty(process, 'env', environmentDescriptor)
    }
  })

  it('suppresses write exceptions and ignores backpressure', () => {
    write.mockImplementationOnce(() => {
      throw new Error('stderr unavailable')
    })
    expect(() => spinlog.intro('Build')).not.toThrow()

    write.mockImplementationOnce(() => false)
    expect(() => spinlog.outro('Done')).not.toThrow()
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('coordinates flow messages around an active spinner without process ownership', () => {
    vi.stubEnv('CI', '')
    const beforeSignals = {
      sigint: process.listenerCount('SIGINT'),
      sigterm: process.listenerCount('SIGTERM'),
    }
    const spinner = spinlog('work', { spinner: 'line' }).start()
    expect(vi.getTimerCount()).toBe(1)

    spinlog.intro('Build')
    spinlog.outro('Done')

    expect(vi.getTimerCount()).toBe(1)
    expect(write.mock.calls.map(([value]) => String(value))).toEqual([
      '\x1b[?25l- work',
      '\x1b[2K\r┌  Build\n- work',
      '\x1b[2K\r└  Done\n- work',
    ])
    expect(process.listenerCount('SIGINT')).toBe(beforeSignals.sigint)
    expect(process.listenerCount('SIGTERM')).toBe(beforeSignals.sigterm)
    spinner.succeed()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('promise wrapper', () => {
  let write: ReturnType<typeof vi.spyOn>
  let stdoutWrite: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CI', '1')
    vi.stubEnv('FORCE_COLOR', '0')
    vi.stubEnv('WT_SESSION', 'test-session')
    write = vi.spyOn(stderr, 'write').mockImplementation(() => true)
    stdoutWrite = vi.spyOn(stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('starts before observing and assimilating a direct thenable', async () => {
    const order: string[] = []
    write.mockImplementation((value: unknown) => {
      order.push(String(value))
      return true
    })
    const thenable = Object.defineProperty({}, 'then', {
      configurable: true,
      get() {
        order.push('then-observed')
        return (resolve: (value: number) => void) => resolve(42)
      },
    }) as PromiseLike<number>

    await expect(spinlog.promise(thenable, { text: 'direct', spinner: 'line' })).resolves.toBe(42)
    expect(order[0]).toBe('- direct\n')
    expect(order[1]).toBe('then-observed')
    expect(order.at(-1)).toBe('✔ direct\n')
  })

  it('starts before invoking a task exactly once and preserves fulfillment', async () => {
    const task = vi.fn(() => Promise.resolve({ value: 7 }))
    const promise = spinlog.promise(task, { text: 'task', prefix: 'p' })

    expect(write).toHaveBeenCalledWith('p ⠋ task\n')
    expect(task).toHaveBeenCalledTimes(1)
    await expect(promise).resolves.toEqual({ value: 7 })
    expect(write).toHaveBeenLastCalledWith('p ✔ task\n')
  })

  it('preserves rejection reasons and converts synchronous task throws', async () => {
    const reason = { reason: 'original' }
    await expect(spinlog.promise(Promise.reject(reason), { text: 'reject' })).rejects.toBe(reason)
    expect(write).toHaveBeenLastCalledWith('✖ reject\n')

    const thrown = new Error('synchronous')
    const rejected = spinlog.promise(() => {
      throw thrown
    })
    await expect(rejected).rejects.toBe(thrown)
  })

  it('never lets cosmetic write failure replace action settlement', async () => {
    write.mockImplementation(() => {
      throw new Error('stderr unavailable')
    })

    await expect(spinlog.promise(Promise.resolve('ok'))).resolves.toBe('ok')
    const reason = new Error('action failed')
    await expect(spinlog.promise(Promise.reject(reason))).rejects.toBe(reason)
    expect(stdoutWrite).not.toHaveBeenCalled()
  })

  it('rejects invalid JavaScript options before invoking a task', async () => {
    const task = vi.fn(() => Promise.resolve('unreachable'))
    await expect(spinlog.promise(task, null as unknown as never)).rejects.toThrow(
      'options must be an object',
    )
    expect(task).not.toHaveBeenCalled()
  })
})
