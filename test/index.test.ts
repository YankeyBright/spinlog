import { stderr, stdout } from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import spinlog, * as moduleExports from '../src/index.js'

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
    expect(Object.keys(moduleExports).sort()).toEqual(['default', ...STYLE_EXPORTS].sort())
    expect(spinlog).toBeTypeOf('function')
    expect(spinlog.promise).toBeTypeOf('function')
  })

  it('returns an instance with only the frozen fields and lifecycle methods', () => {
    expect(Object.keys(spinlog())).toEqual([
      'text',
      'color',
      'prefix',
      'suffix',
      'start',
      'stop',
      'succeed',
      'fail',
      'warn',
      'info',
    ])
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
