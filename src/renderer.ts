import { tryWrite } from './text.js'

const CLEAR_LINE = '\x1b[2K\r'

/** An interactive spinner that owns the terminal's current physical line. */
export interface InteractiveLease {
  currentFrame(): string
  stopAfterRenderFailure(): void
}

let activeLease: InteractiveLease | undefined

/** Acquire the single interactive terminal line without taking host-process ownership. */
export function acquireInteractiveLease(lease: InteractiveLease): boolean {
  if (activeLease === undefined) {
    activeLease = lease
    return true
  }
  return activeLease === lease
}

/** Release an interactive line only when it is owned by the calling spinner. */
export function releaseInteractiveLease(lease: InteractiveLease): void {
  if (activeLease === lease) activeLease = undefined
}

/** Write an active frame and stop its owner if the cosmetic write throws. */
export function writeInteractiveFrame(lease: InteractiveLease, value: string): boolean {
  return writeWithLease(lease, value)
}

/** Insert a permanent line above the active frame without leaving the frame corrupted. */
export function writeCoordinatedLine(value: string): boolean {
  const lease = activeLease
  return writeWithLease(
    lease,
    lease === undefined ? value : `${CLEAR_LINE}${value}${lease.currentFrame()}`,
  )
}

function writeWithLease(lease: InteractiveLease | undefined, value: string): boolean {
  if (tryWrite(value)) return true
  if (lease !== undefined && activeLease === lease) lease.stopAfterRenderFailure()
  return false
}
