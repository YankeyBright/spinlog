import { stderr } from 'node:process'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  acquireInteractiveLease,
  releaseInteractiveLease,
  writeCoordinatedLine,
  writeInteractiveFrame,
  type InteractiveLease,
} from '../src/renderer.js'

function lease(frame = '- active') {
  const owner = {
    currentFrame: () => frame,
    stopAfterRenderFailure: vi.fn(),
  } satisfies InteractiveLease
  return owner
}

describe('interactive terminal lease', () => {
  const owners: InteractiveLease[] = []

  afterEach(() => {
    for (const owner of owners.splice(0)) releaseInteractiveLease(owner)
    vi.restoreAllMocks()
  })

  it('permits one owner and redraws it after coordinated permanent output', () => {
    const write = vi.spyOn(stderr, 'write').mockImplementation(() => true)
    const first = lease()
    const second = lease('- secondary')
    owners.push(first, second)

    expect(acquireInteractiveLease(first)).toBe(true)
    expect(acquireInteractiveLease(first)).toBe(true)
    expect(acquireInteractiveLease(second)).toBe(false)
    expect(writeInteractiveFrame(first, '\x1b[?25l- active')).toBe(true)
    expect(writeCoordinatedLine('status\n')).toBe(true)
    expect(write.mock.calls.map(([value]) => String(value))).toEqual([
      '\x1b[?25l- active',
      '\x1b[2K\rstatus\n- active',
    ])

    releaseInteractiveLease(second)
    releaseInteractiveLease(first)
    expect(writeCoordinatedLine('plain\n')).toBe(true)
    expect(write).toHaveBeenLastCalledWith('plain\n')
  })

  it('stops the owning renderer after a synchronous coordinated write failure', () => {
    const write = vi.spyOn(stderr, 'write').mockImplementation(() => {
      throw new Error('stderr unavailable')
    })
    const owner = lease()
    owners.push(owner)

    acquireInteractiveLease(owner)
    expect(writeCoordinatedLine('flow\n')).toBe(false)
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledWith('\x1b[2K\rflow\n- active')

    releaseInteractiveLease(owner)
    expect(writeCoordinatedLine('plain\n')).toBe(false)
    expect(owner.stopAfterRenderFailure).toHaveBeenCalledOnce()
  })
})
