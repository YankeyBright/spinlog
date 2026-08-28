import { isGroupSpinning, isGroupVisible, type GroupItem } from './group-rendering.js'

const NO_SESSION = Symbol('spinlog.group.none')

export interface GroupSession {
  join(item: GroupItem): void
  owns(item: GroupItem): boolean
  activeItems(): GroupItem[]
  visibleItems(): GroupItem[]
  reset(): void
}

/** Keep one group's active-session identity and its live/persisted row queries together. */
export function createGroupSession(items: GroupItem[]): GroupSession {
  let activeSession = NO_SESSION

  function join(item: GroupItem): void {
    if (activeSession === NO_SESSION) activeSession = Symbol('spinlog.group')
    item.session = activeSession
  }

  function owns(item: GroupItem): boolean {
    return item.session === activeSession
  }

  function activeItems(): GroupItem[] {
    return items.filter((item) => owns(item) && isGroupSpinning(item))
  }

  function visibleItems(): GroupItem[] {
    return items.filter((item) => owns(item) && isGroupVisible(item))
  }

  function reset(): void {
    activeSession = NO_SESSION
  }

  return { join, owns, activeItems, visibleItems, reset }
}
