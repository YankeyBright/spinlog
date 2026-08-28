import { stderr } from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import spinlog from '../src/index.js'
import {
  DEFAULT_SPINNER_COLOR,
  createFrameSet,
  hasAnimatedFrames,
  selectBuiltinFrame,
  selectFrame,
  selectStatus,
} from '../src/spinner-data.js'
import { setupTerminalFixture, type TerminalFixture } from './terminal-fixture.js'

describe('custom spinner definitions', () => {
  let write: ReturnType<typeof vi.spyOn>
  let terminal: TerminalFixture

  beforeEach(() => {
    terminal = setupTerminalFixture()
    write = terminal.write
  })

  afterEach(() => {
    terminal.restore()
  })

  it('copies validated frames and advances at the caller-selected interval', () => {
    const frames = ['A', 'B']
    const spinner = spinlog('work', { spinner: { frames, interval: 120 } }).start()
    frames[0] = 'changed'

    expect(write).toHaveBeenCalledWith('\x1b[?25lA work')
    vi.advanceTimersByTime(119)
    expect(write).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(write).toHaveBeenLastCalledWith('\x1b[2K\rB work')
    spinner.stop()
  })

  it('uses a static line for one-frame definitions and preserves sanitized output', () => {
    spinlog('work', { spinner: { frames: ['\x1b[31mA\x1b[0m'] } })
      .start()
      .succeed()

    expect(write.mock.calls.map(([value]) => String(value))).toEqual(['A work\n', '\u2714 work\n'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sanitizes and freezes caller-defined frames when the definition is accepted', () => {
    const frames = ['\x1b[31mA\x1b[0m', 'B']
    const frameSet = createFrameSet({ frames, interval: 16 })
    frames[0] = 'changed after validation'

    expect(frameSet.frames).toEqual(['A', 'B'])
    expect(Object.isFrozen(frameSet.frames)).toBe(true)
    expect(Object.isFrozen(frameSet)).toBe(true)
  })

  it('measures every grapheme in a multi-character custom frame', () => {
    Object.defineProperty(stderr, 'columns', { configurable: true, value: 7 })

    spinlog('go', { spinner: { frames: ['==>', '-->'], interval: 16 } }).start()

    expect(write.mock.calls.map(([value]) => String(value))).toEqual(['==> go\n'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects unsafe definitions before writes and exposes fixed status validation', () => {
    const invalid = [
      { frames: [] },
      { frames: ['\r\n'] },
      { frames: ['\u200d'] },
      { frames: ['\u0301'] },
      { frames: [1] },
      { frames: ['a'], interval: 0 },
      { frames: ['a'], interval: 60_001 },
      null,
    ]

    for (const spinner of invalid) {
      expect(() => spinlog('work', { spinner: spinner as never })).toThrow(TypeError)
    }
    expect(() => selectStatus(9 as never, true)).toThrow('unknown terminal action')
    expect(write).not.toHaveBeenCalled()
  })

  it('retains built-in Unicode fallback and validates direct frame sources', () => {
    expect(createFrameSet(undefined).interval).toBe(80)
    const dots = createFrameSet('dots')
    const line = createFrameSet('line')
    const configured = createFrameSet({ frames: ['a', 'b'], interval: 16 })

    expect(dots.frames).toHaveLength(10)
    expect(line.frames).toEqual(['-', '\\', '|', '/'])
    expect(configured.interval).toBe(16)
    expect(DEFAULT_SPINNER_COLOR).toBe('cyan')
    expect(selectBuiltinFrame('dots', true, 0)).toBe('\u280b')
    expect(selectFrame(dots, false, 1)).toBe('\\')
    expect(hasAnimatedFrames(dots, false)).toBe(true)
    expect(selectStatus(0, false)).toEqual(['+', 'green'])
    expect(() =>
      selectFrame({ frames: [], interval: 80, unicodeFallback: false }, true, 0),
    ).toThrow('spinner frame set must not be empty')
    expect(Object.isFrozen(createFrameSet({ frames: ['a'] }).frames)).toBe(true)
    expect(Object.isFrozen(dots)).toBe(true)
    expect(Object.isFrozen(dots.frames)).toBe(true)
    expect(() => createFrameSet({ frames: Array.from({ length: 65 }, () => 'a') })).toThrow(
      'between 1 and 64',
    )
  })
})
