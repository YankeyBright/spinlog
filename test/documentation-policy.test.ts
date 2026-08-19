import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import {
  DOCUMENTED_EXAMPLES,
  synchronizeExamples,
  validateDocumentation,
} from '../scripts/documentation-policy.mjs'

function fixture() {
  const documents = {
    'MIGRATION.md': readFileSync('MIGRATION.md', 'utf8'),
    'README.md': readFileSync('README.md', 'utf8'),
  }
  const examples = Object.fromEntries(
    DOCUMENTED_EXAMPLES.map(({ path }) => [path, readFileSync(path, 'utf8')]),
  )
  return {
    availablePaths: new Set([
      'LICENSE',
      'MIGRATION.md',
      'SECURITY.md',
      'specs/v1-behavior.json',
      'specs/v1-public-api.d.ts',
      'specs/v1-styles-api.d.ts',
    ]),
    contract: JSON.parse(readFileSync('specs/v1-behavior.json', 'utf8')),
    documents,
    examples,
    packageJson: JSON.parse(readFileSync('package.json', 'utf8')),
    runtimeSbom: JSON.parse(readFileSync('sbom.json', 'utf8')),
    sizeBytes: gzipSync(readFileSync('dist/index.js'), { level: 9 }).length,
  }
}

describe('Phase 4 documentation policy', () => {
  it('accepts synchronized, evidence-backed public documentation', () => {
    expect(validateDocumentation(fixture())).toEqual([])
  })

  it('regenerates a changed example block from its canonical file', () => {
    const current = fixture()
    current.documents['README.md'] = current.documents['README.md'].replace(
      "spinner.text = 'Bundling'",
      "spinner.text = 'Drifted'",
    )

    const synchronized = synchronizeExamples(current.documents, current.examples)
    expect(synchronized['README.md']).toContain("spinner.text = 'Bundling'")
    expect(validateDocumentation(current)).toContain('README.md example snippets are out of date')
  })

  it('rejects size, Node, and SBOM claim drift', () => {
    const current = fixture()
    current.sizeBytes += 1
    current.contract.runtime.supportedMajors = [22, 24]
    current.runtimeSbom.components = [{ name: 'unexpected' }]

    expect(validateDocumentation(current)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('currently measures'),
        'documentation requires the frozen Node 22, 24, and 26 major set',
        'README zero-runtime-component claim requires an empty runtime SBOM component list',
      ]),
    )
  })

  it('rejects broken links and stdout-writing examples', () => {
    const current = fixture()
    current.documents['README.md'] += '\n[Missing](missing.md)\n'
    current.examples['examples/flow.mjs'] += '\nprocess.stdout.write("unsafe")\n'

    expect(validateDocumentation(current)).toEqual(
      expect.arrayContaining([
        'README.md contains a broken relative link: missing.md',
        'examples/flow.mjs must not write example output to stdout',
      ]),
    )
  })
})
