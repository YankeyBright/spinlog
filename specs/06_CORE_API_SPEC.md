# Core API Specification

This specification defines the frozen v1 runtime surface. It is subordinate to `docs/mvp-contract.md` and `docs/stream-policy.md`.

## Spinner Factory

```ts
const spinner = spinlog('Installing', {
  color: 'cyan',
  prefix: '[1/3]',
  suffix: 'please wait',
})
```

The factory returns a spinner instance. Cosmetic output always writes to `stderr`.

## Spinner Lifecycle

```ts
spinner.start()
spinner.stop()
spinner.succeed('Done')
spinner.fail('Failed')
spinner.warn('Warning')
spinner.info('Information')
```

Terminal transitions must stop animation, clear or finalize the active line as appropriate, restore cursor state if it was hidden, and write a persistent result to `stderr`.

## Live Mutation

```ts
spinner.text = 'Downloading'
spinner.color = 'blue'
spinner.prefix = '[2/3]'
spinner.suffix = 'almost there'
```

Mutations affect the next rendered frame without adding unintended line breaks. The supported mutable fields are exactly `text`, `color`, `prefix`, and `suffix`.

## Promise Wrapper

```ts
const value = await spinlog.promise(fetchData(), { text: 'Fetching' })
```

`spinlog.promise(...)` accepts a promise or async function, starts a spinner, calls `succeed` on resolution, calls `fail` on rejection, and rethrows the original rejection.

## Colors

```ts
import { bold, blue, dim, green, red, yellow } from 'spinlog'

const message = bold(green('done'))
```

Color helpers are named ESM exports and must remain independently tree-shakeable. They honor the environment policy for color support.

## Non-TTY And CI Behavior

- Non-TTY and CI execution never starts an animation interval.
- Static messages and terminal transitions still use `stderr`.
- `NO_COLOR` disables color output according to the environment policy.
- `FORCE_COLOR` behavior is defined and tested without overriding the stream policy.

## Explicitly Excluded From v1

The following API members must not be implemented or documented as available in v1: `spinlog.group`, `spinlog.progress`, `spinlog.confirm`, `spinlog.text`, `spinlog.intro`, `spinlog.outro`, and `structured: true`.
