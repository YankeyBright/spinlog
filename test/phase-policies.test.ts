import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AUTHORITATIVE_PHASE_FILES, validatePhaseMap } from '../scripts/check-phase-map.mjs'
import {
  validateEsbuildSecurityPolicy,
  validateTypeScriptConfig,
} from '../scripts/phase1-toolchain-policy.mjs'

function loadPhaseDocuments() {
  return Object.fromEntries(
    AUTHORITATIVE_PHASE_FILES.map((path) => [path, readFileSync(path, 'utf8')]),
  )
}

const validTypeScriptConfig = {
  compilerOptions: {
    target: 'ES2022',
    module: 'Node18',
    moduleResolution: 'Node16',
    rootDir: 'src',
    outDir: 'dist',
    declaration: true,
    declarationMap: false,
    sourceMap: false,
    noEmitOnError: true,
    strict: true,
  },
}

const validPackageJson = {
  devDependencies: { tsup: '8.5.1' },
  overrides: { tsup: { esbuild: '0.28.1' } },
}

const validPackageLock = {
  lockfileVersion: 3,
  packages: {
    'node_modules/esbuild': { version: '0.28.1' },
    'node_modules/tsup': {
      version: '8.5.1',
      dependencies: { esbuild: '^0.27.0' },
    },
    'node_modules/vite/node_modules/esbuild': { version: '0.25.12' },
  },
}

describe('phase-map policy', () => {
  it('accepts the canonical phase documents', () => {
    expect(validatePhaseMap(loadPhaseDocuments())).toEqual([])
  })

  it('rejects the former Phase 1 runtime taxonomy', () => {
    const documents = loadPhaseDocuments()

    documents['harness/plan.md'] = documents['harness/plan.md'].replace(
      '## Phase 1: Package Scaffolding',
      '## Phase 1: Core Implementation Hardening',
    )

    expect(validatePhaseMap(documents)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('contains legacy phase taxonomy'),
        expect.stringContaining('has conflicting Phase 1 heading'),
      ]),
    )
  })
})

describe('Phase 1 TypeScript policy', () => {
  it('accepts Node18 modules with Node16 resolution', () => {
    expect(validateTypeScriptConfig(validTypeScriptConfig)).toEqual([])
  })

  it('rejects a NodeNext module configuration', () => {
    const nodeNextConfig = {
      compilerOptions: {
        ...validTypeScriptConfig.compilerOptions,
        module: 'NodeNext',
      },
    }

    expect(validateTypeScriptConfig(nodeNextConfig)).toContain('tsconfig module must be Node18')
  })
})

describe('Phase 1 esbuild security policy', () => {
  it('accepts the scoped patched override and lockfile', () => {
    expect(validateEsbuildSecurityPolicy(validPackageJson, validPackageLock)).toEqual([])
  })

  it('rejects removal of the security override', () => {
    expect(
      validateEsbuildSecurityPolicy({ ...validPackageJson, overrides: {} }, validPackageLock),
    ).toContain('tsup esbuild override must be 0.28.1')
  })

  it('rejects an affected esbuild resolution', () => {
    const vulnerableLock = {
      ...validPackageLock,
      packages: {
        ...validPackageLock.packages,
        'node_modules/esbuild': { version: '0.27.7' },
      },
    }

    expect(validateEsbuildSecurityPolicy(validPackageJson, vulnerableLock)).toEqual(
      expect.arrayContaining([
        'package-lock.json root esbuild must resolve to 0.28.1',
        expect.stringContaining('affected by GHSA-g7r4-m6w7-qqqr'),
      ]),
    )
  })

  it('requires review when tsup changes its esbuild range', () => {
    const updatedRangeLock = {
      ...validPackageLock,
      packages: {
        ...validPackageLock.packages,
        'node_modules/tsup': {
          ...validPackageLock.packages['node_modules/tsup'],
          dependencies: { esbuild: '^0.28.1' },
        },
      },
    }

    expect(validateEsbuildSecurityPolicy(validPackageJson, updatedRangeLock)).toContain(
      'tsup esbuild range changed; review whether the security override can be retired',
    )
  })
})
