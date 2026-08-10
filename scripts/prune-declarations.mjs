import { readdirSync, rmSync } from 'node:fs'

for (const entry of readdirSync('dist')) {
  if (entry.endsWith('.d.ts') && !['index.d.ts', 'styles.d.ts'].includes(entry)) {
    rmSync(`dist/${entry}`)
  }
}
