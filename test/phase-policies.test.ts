import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AUTHORITATIVE_PHASE_FILES, validatePhaseMap } from '../scripts/check-phase-map.mjs'
import {
  validateEsbuildSecurityPolicy,
  validateTypeScriptConfig,
} from '../scripts/phase1-toolchain-policy.mjs'
import { APPROVED_PACKAGE_FILES, validatePackOutput } from '../scripts/pack-policy.mjs'

function loadPhaseDocuments() {
  return Object.fromEntries(
    AUTHORITATIVE_PHASE_FILES.map((path) => [path, readFileSync(path, 'utf8')]),
  )
}

const validTypeScriptConfig = {
  compilerOptions: {
    target: 'ES2023',
    lib: ['ES2023'],
    module: 'Node20',
    moduleResolution: 'Node16',
    types: ['node'],
    rootDir: 'src',
    outDir: 'dist',
    declaration: true,
    declarationMap: false,
    sourceMap: false,
    noEmitOnError: true,
    strict: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    isolatedDeclarations: true,
    noUncheckedSideEffectImports: true,
    moduleDetection: 'force',
    noUncheckedIndexedAccess: true,
    noImplicitReturns: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noFallthroughCasesInSwitch: true,
    skipLibCheck: false,
  },
}

const validPackageJson = {
  devDependencies: { esbuild: '0.28.2' },
}

const validPackageLock = {
  lockfileVersion: 3,
  packages: {
    'node_modules/esbuild': { version: '0.28.2' },
    'node_modules/vite/node_modules/esbuild': { version: '0.25.12' },
  },
}

describe('phase-map policy', () => {
  it('accepts the canonical phase documents', () => {
    expect(validatePhaseMap(loadPhaseDocuments())).toEqual([])
  })

  it('rejects the former Phase 1 runtime taxonomy', () => {
    const documents = loadPhaseDocuments()

    documents['specs/10_PHASE_1_PACKAGE_SCAFFOLDING.md'] = documents[
      'specs/10_PHASE_1_PACKAGE_SCAFFOLDING.md'
    ].replace('# Phase 1: Package Scaffolding', '# Phase 1: Core Implementation Hardening')

    expect(validatePhaseMap(documents)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('contains legacy phase taxonomy'),
        expect.stringContaining('has conflicting Phase 1 heading'),
      ]),
    )
  })
})

describe('Phase 1 TypeScript policy', () => {
  it('accepts fixed Node20 modules with Node16 resolution', () => {
    expect(validateTypeScriptConfig(validTypeScriptConfig)).toEqual([])
  })

  it('rejects a NodeNext module configuration', () => {
    const nodeNextConfig = {
      compilerOptions: {
        ...validTypeScriptConfig.compilerOptions,
        module: 'NodeNext',
      },
    }

    expect(validateTypeScriptConfig(nodeNextConfig)).toContain('tsconfig module must be Node20')
  })
})

describe('Phase 1 esbuild security policy', () => {
  it('accepts the direct patched esbuild pin and lockfile', () => {
    expect(validateEsbuildSecurityPolicy(validPackageJson, validPackageLock)).toEqual([])
  })

  it('rejects removal of the direct esbuild pin', () => {
    expect(
      validateEsbuildSecurityPolicy({ ...validPackageJson, devDependencies: {} }, validPackageLock),
    ).toContain('esbuild must be a direct exact pin at 0.28.2')
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
        'package-lock.json root esbuild must resolve to 0.28.2',
        expect.stringContaining('affected by GHSA-g7r4-m6w7-qqqr'),
      ]),
    )
  })

  it('rejects tsup or override reintroduction', () => {
    const packageJson = {
      ...validPackageJson,
      devDependencies: { ...validPackageJson.devDependencies, tsup: '8.5.1' },
      overrides: { tsup: { esbuild: '0.28.2' } },
    }
    expect(validateEsbuildSecurityPolicy(packageJson, validPackageLock)).toEqual(
      expect.arrayContaining([
        'tsup must not remain after direct esbuild migration',
        'package.json overrides must be absent after direct esbuild migration',
      ]),
    )
  })
})

function validPackReport() {
  return [
    {
      files: APPROVED_PACKAGE_FILES.map((path) => ({ path })),
      entryCount: APPROVED_PACKAGE_FILES.length,
      bundled: [],
    },
  ]
}

describe('package payload policy', () => {
  it('accepts exactly the approved eleven package files', () => {
    expect(validatePackOutput(validPackReport())).toEqual([])
  })

  it.each(['dist/extra.js.map', 'dist/internal.d.ts', 'dist/nested/private.js'])(
    'rejects additional distribution file %s',
    (path) => {
      const report = validPackReport()
      report[0].files.push({ path })
      report[0].entryCount += 1

      expect(validatePackOutput(report)).toEqual(
        expect.arrayContaining([
          `unexpected package files: ${path}`,
          'package must contain exactly 11 files, found 12',
        ]),
      )
    },
  )

  it('rejects missing and duplicate package files', () => {
    const report = validPackReport()
    report[0].files[0] = { path: 'README.md' }

    expect(validatePackOutput(report)).toEqual(
      expect.arrayContaining([
        'packaged file paths must not contain duplicates',
        'missing package files: LICENSE',
      ]),
    )
  })

  it('rejects multiple package results and bundled dependencies', () => {
    expect(validatePackOutput([...validPackReport(), ...validPackReport()])).toEqual([
      'npm pack must return exactly one package result, found 2',
    ])

    const report = validPackReport()
    report[0].bundled = ['unexpected-runtime']
    expect(validatePackOutput(report)).toContain('tarball must contain zero bundled dependencies')
  })
})
