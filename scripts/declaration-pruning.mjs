import { compareCanonicalText } from './canonical-order.mjs'

/** Replace a root style re-export with the frozen, structurally equivalent declarations. */
export function inlineRootStyleDeclarations(declaration, styleExports) {
  const reexport = /export \{\s*([\s\S]*?)\s*\} from '\.\/styles\.js';?\r?\n?/g
  const matches = [...declaration.matchAll(reexport)]
  if (matches.length !== 1) {
    throw new Error('dist/index.d.ts must contain one root styles re-export')
  }
  const [match] = matches

  const exportedNames = match[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  const expectedNames = [...styleExports]
  if (
    JSON.stringify(exportedNames.toSorted(compareCanonicalText)) !==
      JSON.stringify(expectedNames.toSorted(compareCanonicalText)) ||
    new Set(exportedNames).size !== exportedNames.length
  ) {
    throw new Error('root styles re-export must match the frozen public style catalog')
  }

  const declarations = expectedNames
    .map((name) => `export declare const ${name}: (text: string) => string`)
    .join('\n')
  return declaration.replace(match[0], `${declarations}\n`)
}
