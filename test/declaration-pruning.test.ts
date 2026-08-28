import { describe, expect, it } from 'vitest'

import { inlineRootStyleDeclarations } from '../scripts/declaration-pruning.mjs'

const styles = ['bold', 'red']

describe('root declaration pruning', () => {
  it('replaces a style re-export with the frozen value signatures', () => {
    const declaration = "export {\n  bold,\n  red,\n} from './styles.js';\n\nexport default value\n"

    expect(inlineRootStyleDeclarations(declaration, styles)).toBe(
      'export declare const bold: (text: string) => string\n' +
        'export declare const red: (text: string) => string\n\nexport default value\n',
    )
  })

  it('rejects a root style catalog that would drift from the contract', () => {
    expect(() =>
      inlineRootStyleDeclarations("export { bold } from './styles.js'\n", styles),
    ).toThrow('root styles re-export must match the frozen public style catalog')
  })

  it('requires exactly one root style re-export', () => {
    const declaration =
      "export { bold, red } from './styles.js'\n" + "export { bold, red } from './styles.js'\n"

    expect(() => inlineRootStyleDeclarations(declaration, styles)).toThrow(
      'dist/index.d.ts must contain one root styles re-export',
    )
  })
})
