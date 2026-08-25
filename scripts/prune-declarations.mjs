import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

const DISPOSABLE_REFERENCE = '/// <reference lib="esnext.disposable" />\n\n'

for (const entry of readdirSync('dist')) {
  if (entry.endsWith('.d.ts') && !['index.d.ts', 'styles.d.ts'].includes(entry)) {
    rmSync(`dist/${entry}`)
  }
}

const indexDeclaration = readFileSync('dist/index.d.ts', 'utf8')
if (!indexDeclaration.startsWith(DISPOSABLE_REFERENCE)) {
  // Consumers need this standard library declaration to type the public disposal method.
  writeFileSync('dist/index.d.ts', `${DISPOSABLE_REFERENCE}${indexDeclaration}`)
}
