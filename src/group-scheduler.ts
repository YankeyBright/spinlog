import type { GroupItem } from './group-rendering.js'

export interface GroupScheduler {
  arm(): void
  clear(): void
}

/** Own the one unreferenced timer used to advance an interactive group surface. */
export function createGroupScheduler(
  activeItems: () => GroupItem[],
  redraw: () => void,
): GroupScheduler {
  let timer: NodeJS.Timeout | undefined
  let interval = 0

  function arm(): void {
    clear()
    interval = Math.min(...activeItems().map((item) => item.frameSet.interval))
    timer = setInterval(tick, interval)
    timer.unref()
  }

  function tick(): void {
    for (const item of activeItems()) {
      item.elapsedMs += interval
      if (item.elapsedMs >= item.frameSet.interval) {
        item.frameIndex += 1
        item.elapsedMs %= item.frameSet.interval
      }
    }
    redraw()
  }

  function clear(): void {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
    interval = 0
  }

  return { arm, clear }
}
