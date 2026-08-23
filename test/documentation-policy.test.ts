import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  DOCUMENTED_EXAMPLES,
  synchronizeExamples,
  validateDocumentation,
} from '../scripts/documentation-policy.mjs'

const FIXTURE_SIZE_BYTES = 1234

function fixture() {
  const documents = {
    'MIGRATION.md': readFileSync('MIGRATION.md', 'utf8'),
    'README.md': readFileSync('README.md', 'utf8'),
  }
  documents['README.md'] = documents['README.md'].replace(
    /currently measures [\d,]+ bytes using gzip level 9/u,
    `currently measures ${FIXTURE_SIZE_BYTES.toLocaleString('en-US')} bytes using gzip level 9`,
  )
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
    sizeBytes: FIXTURE_SIZE_BYTES,
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

  it('rejects a duplicated example marker', () => {
    const current = fixture()
    const { id } = DOCUMENTED_EXAMPLES[0]
    current.documents['README.md'] += `\n<!-- example:${id}:start -->\n`

    expect(() => synchronizeExamples(current.documents, current.examples)).toThrow(
      `README.md must contain exactly one complete ${id} example block`,
    )
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

  it('rejects color-only capability and render-cache contract drift', () => {
    const current = fixture()
    current.contract.environment.noColor = 'non-empty-disables'
    current.contract.rendering.renderCache.colorMutation = 'invalidate-all'

    expect(validateDocumentation(current)).toEqual(
      expect.arrayContaining([
        'documentation requires the frozen color-only disable and emphasis policy',
        'documentation requires the frozen lazy render-cache policy',
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

  it('validates parsed inline and reference links without treating code spans as links', () => {
    const current = fixture()
    current.availablePaths.add('docs/nested(path).md')
    current.documents['README.md'] += `
[Nested [label]](docs/nested(path).md)
[Missing reference][missing]

[missing]: missing.md

\`[example](not-a-link.md)\`
`

    expect(validateDocumentation(current)).toContain(
      'README.md contains a broken relative link: missing.md',
    )
    expect(validateDocumentation(current)).not.toContain(
      'README.md contains a broken relative link: docs/nested(path).md',
    )
    expect(validateDocumentation(current)).not.toContain(
      'README.md contains a broken relative link: not-a-link.md',
    )
  })
})
