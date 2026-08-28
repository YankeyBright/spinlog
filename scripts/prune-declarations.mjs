import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

import { inlineRootStyleDeclarations } from './declaration-pruning.mjs'

const DISPOSABLE_REFERENCE = '/// <reference lib="esnext.disposable" />\n\n'

for (const entry of readdirSync('dist')) {
  if (entry.endsWith('.d.ts') && !['index.d.ts', 'styles.d.ts'].includes(entry)) {
    rmSync(`dist/${entry}`)
  }
}

const contract = JSON.parse(readFileSync('specs/v1-behavior.json', 'utf8'))
const styleExports = contract.publicApi?.styleExports
if (!Array.isArray(styleExports) || !styleExports.every((name) => typeof name === 'string')) {
  throw new Error('specs/v1-behavior.json must define the public style catalog')
}

let indexDeclaration = inlineRootStyleDeclarations(
  readFileSync('dist/index.d.ts', 'utf8'),
  styleExports,
)
if (!indexDeclaration.startsWith(DISPOSABLE_REFERENCE)) {
  // Consumers need this standard library declaration to type the public disposal method.
  indexDeclaration = `${DISPOSABLE_REFERENCE}${indexDeclaration}`
}
writeFileSync('dist/index.d.ts', indexDeclaration)
