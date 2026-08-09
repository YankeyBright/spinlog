import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { normalizeSbom, validateSbom } from '../scripts/sbom-policy.mjs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

function rawSbom({
  componentName = 'arbitrary-checkout-directory',
  serialNumber = 'urn:uuid:first',
  timestamp = '2026-01-01T00:00:00.000Z',
} = {}) {
  const ref = `${packageJson.name}@${packageJson.version}`

  return {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber,
    version: 1,
    metadata: {
      timestamp,
      tools: [{ vendor: 'npm', name: 'cli', version: '99.0.0' }],
      component: {
        'bom-ref': ref,
        type: 'library',
        name: componentName,
        version: packageJson.version,
        purl: `pkg:npm/${packageJson.name}@${packageJson.version}`,
        externalReferences: [{ type: 'vcs', url: packageJson.repository.url }],
      },
    },
    components: [],
    dependencies: [{ ref, dependsOn: [] }],
  }
}

describe('runtime SBOM policy', () => {
  it('normalizes volatile npm output deterministically', () => {
    const first = normalizeSbom(rawSbom(), packageJson)
    const second = normalizeSbom(
      rawSbom({
        serialNumber: 'urn:uuid:second',
        timestamp: '2027-01-01T00:00:00.000Z',
      }),
      packageJson,
    )

    expect(second).toEqual(first)
    expect(first).not.toHaveProperty('serialNumber')
    expect(first.metadata).not.toHaveProperty('timestamp')
    expect(first.metadata.component.name).toBe(packageJson.name)
  })

  it('accepts a canonical dependency-free CycloneDX document', () => {
    expect(validateSbom(normalizeSbom(rawSbom(), packageJson), packageJson)).toEqual([])
  })

  it('rejects runtime components and repository drift', () => {
    const bom = normalizeSbom(rawSbom(), packageJson)
    bom.components.push({ name: 'unexpected-runtime-package' })
    bom.metadata.component.externalReferences[0].url = 'https://example.invalid/repository.git'

    expect(validateSbom(bom, packageJson)).toEqual(
      expect.arrayContaining([
        'components must be empty, found 1',
        'SBOM VCS reference must match package.json',
      ]),
    )
  })
})
