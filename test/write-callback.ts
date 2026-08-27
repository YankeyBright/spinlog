interface MockCallLog {
  readonly mock: { readonly calls: unknown[][] }
}

/** Model a successful Node Writable.write() call without changing legacy call assertions. */
export function acceptWrite(mock: MockCallLog) {
  return (_value: unknown, callback?: (error?: Error | null) => void): boolean => {
    const call = mock.mock.calls.at(-1)
    callback?.()
    call?.splice(1)
    return true
  }
}
