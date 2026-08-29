import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { validateHttpsPolicy } from '../scripts/https-policy.mjs'
import {
  validatePreviewContext,
  validatePreviewContract,
  validateReleaseBootstrapContract,
  validateReleaseWorkflows,
} from '../scripts/release-policy.mjs'
import { validatePublishedIntegrity } from '../scripts/verify-published-integrity.mjs'
import { parseWorkflow, validateReleaseAutomationWorkflows } from '../scripts/workflow-policy.mjs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const contract = JSON.parse(readFileSync('specs/phase5-preview.json', 'utf8'))
const releaseContract = JSON.parse(readFileSync('specs/phase5-release.json', 'utf8'))
const workflows = {
  'release-readiness.yml': parseWorkflow(
    readFileSync('.github/workflows/release-readiness.yml', 'utf8'),
    'release-readiness.yml',
  ).value,
}
const automationWorkflows = Object.fromEntries(
  ['release-build.yml', 'release-publish.yml'].map((name) => [
    name,
    parseWorkflow(readFileSync(`.github/workflows/${name}`, 'utf8'), name).value,
  ]),
)

describe('release bootstrap policy', () => {
  it('accepts the historical freeze, bootstrap contract, and guarded workflows', () => {
    expect(validatePreviewContract(contract, packageJson)).toEqual([])
    expect(validateReleaseBootstrapContract(releaseContract, packageJson)).toEqual([])
    expect(validateReleaseWorkflows(workflows)).toEqual([])
    expect(validateReleaseAutomationWorkflows(automationWorkflows)).toEqual([])
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

  it.each([
    ['latest dist-tag', { publication: { ...releaseContract.publication, distTag: 'latest' } }],
    [
      'alternate registry',
      {
        publication: { ...releaseContract.publication, registry: 'https://registry.example.test/' },
      },
    ],
    ['tag mismatch', { publication: { ...releaseContract.publication, tag: 'v0.2.1' } }],
    [
      'token bootstrap',
      {
        publication: {
          ...releaseContract.publication,
          authentication: { ...releaseContract.publication.authentication, bootstrap: 'NPM_TOKEN' },
        },
      },
    ],
    [
      'missing artifact attestation',
      { publication: { ...releaseContract.publication, artifact: 'rebuild-in-publisher' } },
    ],
    ['unreviewed contract key', { unreviewed: true }],
  ])('rejects %s in the bootstrap contract', (_name, mutation) => {
    const altered = { ...releaseContract, ...mutation }
    expect(validateReleaseBootstrapContract(altered, packageJson)).not.toEqual([])
  })

  it.each([
    ['builder drift', { workflow: { ...releaseContract.workflow, builder: 'other.yml' } }],
    ['publisher drift', { workflow: { ...releaseContract.workflow, publisher: 'other.yml' } }],
    ['environment drift', { workflow: { ...releaseContract.workflow, environment: 'public' } }],
  ])('rejects %s in the workflow contract', (_name, mutation) => {
    expect(
      validateReleaseBootstrapContract({ ...releaseContract, ...mutation }, packageJson),
    ).not.toEqual([])
  })

  it('rejects package publication drift', () => {
    expect(
      validateReleaseBootstrapContract(releaseContract, {
        ...packageJson,
        version: '0.2.1',
        publishConfig: { ...packageJson.publishConfig, tag: 'latest' },
      }),
    ).toEqual(
      expect.arrayContaining([
        'package identity and HTTPS next publish configuration must match the release bootstrap',
      ]),
    )
  })

  it('accepts only the exact GitHub tag context for the bootstrap', () => {
    expect(
      validatePreviewContext(
        {
          GITHUB_ACTIONS: 'true',
          GITHUB_REPOSITORY: 'YankeyBright/spinlog',
          GITHUB_REF_NAME: 'v0.2.0',
          GITHUB_SHA: '8aaa6eb33c79a4b9df6ef80e6174ecb056ef7ca0',
        },
        packageJson,
      ),
    ).toEqual([])
    expect(
      validatePreviewContext(
        {
          GITHUB_ACTIONS: 'true',
          GITHUB_REPOSITORY: 'YankeyBright/spinlog',
          GITHUB_REF_NAME: 'v0.2.1',
          GITHUB_SHA: '8aaa6eb33c79a4b9df6ef80e6174ecb056ef7ca0',
          NPM_TOKEN: 'unexpected',
        },
        packageJson,
      ),
    ).toEqual(
      expect.arrayContaining([
        'preview context requires the v0.2.0 tag',
        'preview context must not expose npm publication credentials',
      ]),
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
