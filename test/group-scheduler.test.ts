import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GROUP_SPINNING, createGroupItem } from '../src/group-rendering.js'
import { createGroupScheduler } from '../src/group-scheduler.js'

describe('group scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the fastest active interval, advances due frames, and releases its timer', () => {
    const fast = createGroupItem('fast', { spinner: { frames: ['a', 'b'], interval: 16 } })
    const slow = createGroupItem('slow', { spinner: { frames: ['A', 'B'], interval: 60 } })
    fast.state = GROUP_SPINNING
    slow.state = GROUP_SPINNING
    const redraw = vi.fn()
    const scheduler = createGroupScheduler(() => [fast, slow], redraw)

    scheduler.arm()
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(16)

    expect(fast.frameIndex).toBe(1)
    expect(fast.elapsedMs).toBe(0)
    expect(slow.frameIndex).toBe(0)
    expect(slow.elapsedMs).toBe(16)
    expect(redraw).toHaveBeenCalledTimes(1)

    scheduler.clear()
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(60)
    expect(redraw).toHaveBeenCalledTimes(1)
  })
})
