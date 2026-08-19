import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  normalizeBuildSbom,
  normalizeSbom,
  validateBuildSbom,
  validateRawRuntimeSbom,
  validateSbom,
} from '../scripts/sbom-policy.mjs'

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
    components: [] as Array<Record<string, unknown>>,
    dependencies: [{ ref, dependsOn: [] }],
  }
}

function externalReference(bom: ReturnType<typeof rawSbom>, type: string) {
  const reference = bom.metadata.component.externalReferences.find((entry) => entry.type === type)
  if (!reference) throw new Error(`missing ${type} external reference in test fixture`)
  return reference
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
    const raw = rawSbom()
    raw.components.push({ name: 'unexpected-runtime-package' })
    const bom = normalizeSbom(raw, packageJson)
    externalReference(bom, 'vcs').url = 'https://example.invalid/repository.git'

    expect(validateSbom(bom, packageJson)).toEqual(
      expect.arrayContaining([
        'components must be empty, found 1',
        'SBOM VCS reference must match package.json',
      ]),
    )
  })

  it('requires canonical runtime identity fields', () => {
    const bom = normalizeSbom(rawSbom(), packageJson)
    bom.metadata.component.licenses = []
    externalReference(bom, 'vcs').url = 'https://example.invalid/repository.git'

    expect(validateSbom(bom, packageJson)).toEqual(
      expect.arrayContaining([
        'SBOM component identity, license, description, and repository references must match package.json',
        'SBOM VCS reference must match package.json',
      ]),
    )
  })

  it('rejects unexpected npm runtime inventory before normalization', () => {
    const raw = rawSbom()
    raw.components.push({ name: 'unexpected-runtime-package' })

    expect(validateRawRuntimeSbom(raw, packageJson)).toEqual([
      'raw runtime SBOM components must be empty, found 1',
    ])
  })
})

describe('build SBOM policy', () => {
  it('accepts the full direct development inventory', () => {
    const ref = `${packageJson.name}@${packageJson.version}`
    const components = Object.entries(packageJson.devDependencies).map(([name, version]) => ({
      'bom-ref': `pkg:npm/${name}@${version}`,
      name,
      version,
    }))
    const bom = normalizeBuildSbom(
      {
        ...rawSbom(),
        components,
        dependencies: [{ ref, dependsOn: components.map((component) => component['bom-ref']) }],
      },
      packageJson,
    )

    expect(validateBuildSbom(bom, packageJson)).toEqual([])
  })

  it('rejects a missing direct build dependency', () => {
    const bom = normalizeBuildSbom({ ...rawSbom(), components: [], dependencies: [] }, packageJson)

    expect(validateBuildSbom(bom, packageJson)).toEqual(
      expect.arrayContaining([
        'build SBOM must include development components',
        'build SBOM must include the root dependency graph',
        `build SBOM must include direct development dependency: typescript@${packageJson.devDependencies.typescript}`,
      ]),
    )
  })
})
