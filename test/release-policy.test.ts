import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { validateHttpsPolicy } from '../scripts/https-policy.mjs'
import { validatePreviewContract, validateReleaseWorkflows } from '../scripts/release-policy.mjs'
import { validatePublishedIntegrity } from '../scripts/verify-published-integrity.mjs'
import { parseWorkflow } from '../scripts/workflow-policy.mjs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const contract = JSON.parse(readFileSync('specs/phase5-preview.json', 'utf8'))
const workflows = {
  'release-readiness.yml': parseWorkflow(
    readFileSync('.github/workflows/release-readiness.yml', 'utf8'),
    'release-readiness.yml',
  ).value,
}

describe('release freeze policy', () => {
  it('accepts the explicit publication hold and read-only revalidation workflow', () => {
    expect(validatePreviewContract(contract, packageJson)).toEqual([])
    expect(validateReleaseWorkflows(workflows)).toEqual([])
  })

  it('rejects a changed publication target or incomplete revalidation sequence', () => {
    const alteredContract = {
      ...contract,
      blockedPublication: { ...contract.blockedPublication, distTag: 'latest' },
      requiredRevalidation: contract.requiredRevalidation.slice(1),
    }

    expect(validatePreviewContract(alteredContract, packageJson)).toEqual(
      expect.arrayContaining([
        'release freeze must identify the blocked 0.2.0 next publication exactly',
        'release freeze must list the complete revalidation sequence',
      ]),
    )
  })

  it.each([
    ['tag trigger', 'workflow_dispatch:', "push:\n    tags: ['v0.1.0']"],
    ['OIDC permission', 'contents: read', 'contents: read\n  id-token: write'],
    ['publication command', 'npm run check:phase4', 'npm publish .'],
    ['attestation action', 'actions/setup-node@', 'actions/attest@'],
  ])('rejects %s in the temporary release workflow', (_name, before, after) => {
    const source = readFileSync('.github/workflows/release-readiness.yml', 'utf8').replace(
      before,
      after,
    )
    const altered = parseWorkflow(source, 'release-readiness.yml').value

    expect(validateReleaseWorkflows({ 'release-readiness.yml': altered })).not.toEqual([])
  })

  it('rejects additional jobs after sorting their names explicitly', () => {
    const readiness = workflows['release-readiness.yml']
    const altered = {
      ...readiness,
      jobs: { zebra: {}, ...readiness.jobs },
    }

    expect(validateReleaseWorkflows({ 'release-readiness.yml': altered })).toContain(
      'release-readiness.yml must contain only the revalidation job',
    )
  })
})

describe('release transport policy', () => {
  it('permits only the CycloneDX schema HTTP identifier', () => {
    expect(
      validateHttpsPolicy({
        'sbom.json': '{"$schema":"http://cyclonedx.org/schema/bom-1.5.schema.json"}',
      }),
    ).toEqual([])
  })

  it('rejects insecure actionable URLs and integrity mismatches', () => {
    expect(validateHttpsPolicy({ 'README.md': 'Install from http://example.test/pkg' })).toEqual([
      'README.md must use HTTPS: http://example.test/pkg',
    ])
    expect(validatePublishedIntegrity('sha512-reviewed', 'sha512-other')).toEqual([
      'published npm integrity does not match the attested tarball',
    ])
  })

  it('scans long and punctuated input without regular-expression matching', () => {
    const longPath = 'a'.repeat(100_000)
    expect(
      validateHttpsPolicy({
        'README.md': `Use http://example.test/${longPath}, then http://other.test/path.`,
      }),
    ).toEqual([
      `README.md must use HTTPS: http://example.test/${longPath}`,
      'README.md must use HTTPS: http://other.test/path',
    ])
  })
})
