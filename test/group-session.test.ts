import { describe, expect, it } from 'vitest'

import {
  GROUP_SPINNING,
  GROUP_STOPPED,
  GROUP_SUCCEEDED,
  createGroupItem,
} from '../src/group-rendering.js'
import { createGroupSession } from '../src/group-session.js'

describe('group session', () => {
  it('keeps live and persisted rows scoped to one active session', () => {
    const live = createGroupItem('live', {})
    const persisted = createGroupItem('persisted', {})
    const stopped = createGroupItem('stopped', {})
    const session = createGroupSession([live, persisted, stopped])

    session.join(live)
    live.state = GROUP_SPINNING
    session.join(persisted)
    persisted.state = GROUP_SUCCEEDED
    session.join(stopped)
    stopped.state = GROUP_STOPPED

    expect(session.owns(live)).toBe(true)
    expect(session.activeItems()).toEqual([live])
    expect(session.visibleItems()).toEqual([live, persisted])

    session.reset()

    expect(session.owns(live)).toBe(false)
    expect(session.activeItems()).toEqual([])
    expect(session.visibleItems()).toEqual([])

    session.join(live)
    expect(session.owns(live)).toBe(true)
    expect(session.owns(persisted)).toBe(false)
  })
})
