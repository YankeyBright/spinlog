import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { AUTHORITATIVE_PHASE_FILES, validatePhaseMap } from '../scripts/check-phase-map.mjs'
import {
  validateEsbuildSecurityPolicy,
  validateToolchainDocumentation,
  validateTypeScriptConfig,
} from '../scripts/phase1-toolchain-policy.mjs'
import { APPROVED_PACKAGE_FILES, validatePackOutput } from '../scripts/pack-policy.mjs'
import { APPROVED_SCRIPTS, validatePackagePolicy } from '../scripts/package-policy.mjs'
import { inspectRuntimeDirectory, validateRuntimePolicy } from '../scripts/runtime-policy.mjs'
import { validateWorkflowPolicy } from '../scripts/workflow-policy.mjs'

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

const toolchainDocumentation = readFileSync('specs/04_TECH_STACK.md', 'utf8')
const toolchainPackageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const toolchainBiome = JSON.parse(readFileSync('biome.json', 'utf8'))

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

  it('parses only single-line Markdown Phase headings without regex backtracking', () => {
    const documents = loadPhaseDocuments()
    const conflictingTitle = `Not ${'canonical '.repeat(10_000)}`
    documents['README.md'] += `\r\n######\tPhase\t1:\t${conflictingTitle}\r\n`

    expect(validatePhaseMap(documents)).toContain(
      `README.md has conflicting Phase 1 heading: expected "Package Scaffolding", found "${conflictingTitle.trim()}"`,
    )
  })

  it('does not treat a multiline construct as a Markdown Phase heading', () => {
    const documents = loadPhaseDocuments()
    documents['README.md'] += '\n#\nPhase 1: Not a heading\n'

    expect(validatePhaseMap(documents)).toEqual([])
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

describe('Phase 1 toolchain documentation policy', () => {
  it('accepts documentation and schema aligned with executable toolchain configuration', () => {
    expect(
      validateToolchainDocumentation(toolchainDocumentation, toolchainPackageJson, toolchainBiome),
    ).toEqual([])
  })

  it('rejects Node support, ANSI implementation, Biome version, and schema drift', () => {
    const biomeVersion = toolchainPackageJson.devDependencies['@biomejs/biome']
    const driftedDocumentation = toolchainDocumentation
      .replace(/Runtime support: [^\r\n]+/u, 'Runtime support: Node.js unsupported.')
      .replace("Spinlog's internal metadata-driven SGR composer", "Node's built-in `styleText`")
      .replace(
        `Biome \`${biomeVersion}\` owns formatting and linting.`,
        'Biome `unsupported` owns formatting and linting.',
      )
    const driftedBiome = {
      ...toolchainBiome,
      $schema: toolchainBiome.$schema.replace(biomeVersion, 'unsupported'),
    }

    expect(
      validateToolchainDocumentation(driftedDocumentation, toolchainPackageJson, driftedBiome),
    ).toEqual(
      expect.arrayContaining([
        'toolchain documentation must state the manifest-supported Node majors',
        'toolchain documentation must describe the internal SGR composer and VT sanitization',
        'toolchain documentation must state the manifest-pinned Biome version',
        'biome.json schema must match the manifest-pinned Biome version',
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

describe('package installation policy', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

  it('accepts the exact approved package manifest', () => {
    expect(validatePackagePolicy(packageJson, ['package.json'])).toEqual([])
    expect(packageJson.scripts).toEqual(APPROVED_SCRIPTS)
  })

  it.each([
    'preinstall',
    'install',
    'postinstall',
    'prepare',
    'prepack',
    'postpack',
    'prepublish',
    'prepublishOnly',
    'publish',
    'postpublish',
    'version',
    'postversion',
    'pretest',
  ])('rejects the %s lifecycle or hook script', (name) => {
    const mutated = {
      ...packageJson,
      scripts: { ...packageJson.scripts, [name]: 'node hostile.mjs' },
    }

    expect(validatePackagePolicy(mutated)).toEqual(
      expect.arrayContaining(['scripts must exactly match the approved command map']),
    )
  })

  it('rejects an altered approved command and native-install metadata', () => {
    const altered = { ...packageJson, scripts: { ...packageJson.scripts, test: 'echo unsafe' } }
    const native = { ...packageJson, gypfile: true }

    expect(validatePackagePolicy(altered)).toContain(
      'scripts must exactly match the approved command map',
    )
    expect(validatePackagePolicy(native, ['binding.gyp'])).toEqual(
      expect.arrayContaining([
        'native-install metadata is forbidden: gypfile',
        'binding.gyp is forbidden',
      ]),
    )
  })
})

describe('runtime source policy', () => {
  const sources = inspectRuntimeDirectory('src').files

  it('accepts the approved runtime topology', () => {
    expect(validateRuntimePolicy(sources)).toEqual([])
  })

  it.each([
    ['nested source', { path: 'nested/hostile.ts', text: "import process from 'node:process'" }],
    [
      'aliased process import',
      { path: 'text.ts', text: "import { stderr as output } from 'node:process'" },
    ],
    ['process listener', { path: 'text.ts', text: "process.on('SIGINT', () => undefined)" }],
    ['termination call', { path: 'text.ts', text: 'process.exit(1)' }],
    ['stdout write', { path: 'text.ts', text: "process.stdout.write('unsafe')" }],
    ['bare Node built-in import', { path: 'spinner.ts', text: "import 'node:fs'" }],
    ['bare process import', { path: 'text.ts', text: "import 'node:process'" }],
    ['Node built-in re-export', { path: 'spinner.ts', text: "export * from 'node:fs'" }],
    ['dynamic Node built-in import', { path: 'text.ts', text: "void import('node:fs')" }],
    ['CommonJS Node built-in import', { path: 'text.ts', text: "const fs = require('node:fs')" }],
    [
      'TypeScript import-equals Node built-in import',
      { path: 'text.ts', text: "import stderr = require('node:process')" },
    ],
    ['computed host termination call', { path: 'text.ts', text: "process['exit'](1)" }],
  ])('rejects %s before accepting a changed architecture', (_name, hostile) => {
    const mutated = sources.map((source) => (source.path === hostile.path ? hostile : source))
    if (!mutated.some((source) => source.path === hostile.path)) mutated.push(hostile)

    expect(validateRuntimePolicy(mutated)).not.toEqual([])
  })

  it('accepts the approved process import with a trailing semicolon', () => {
    const semicolonTerminated = sources.map((source) =>
      source.path === 'text.ts'
        ? { ...source, text: "import { stderr } from 'node:process';" }
        : source,
    )

    expect(validateRuntimePolicy(semicolonTerminated)).toEqual([])
  })

  it('accepts the approved process import regardless of layout', () => {
    const formatted = sources.map((source) =>
      source.path === 'text.ts'
        ? { ...source, text: "import {\n  stderr,\n} from 'node:process'" }
        : source,
    )

    expect(validateRuntimePolicy(formatted)).toEqual([])
  })

  it('does not interpret comments or strings as runtime operations', () => {
    const commentsAndStrings = sources.map((source) =>
      source.path === 'text.ts'
        ? {
            ...source,
            text: `// import { stdout } from 'node:process'\nconst example = 'process.exit(1)'`,
          }
        : source,
    )

    expect(validateRuntimePolicy(commentsAndStrings)).toEqual([])
  })

  it('reports invalid TypeScript without crashing the policy check', () => {
    const invalid = sources.map((source) =>
      source.path === 'text.ts' ? { ...source, text: 'import {' } : source,
    )

    expect(validateRuntimePolicy(invalid)).toContain('text.ts must contain valid TypeScript')
  })

  it('rejects a symlinked runtime module', () => {
    const directory = mkdtempSync(join(tmpdir(), 'spinlog-runtime-policy-'))
    const target = join(directory, 'target')
    const link = join(directory, 'linked')
    mkdirSync(target)
    writeFileSync(join(target, 'entry.ts'), 'export {}\n')
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')

    try {
      expect(inspectRuntimeDirectory(directory).failures).toContain(
        'runtime source must not contain symlinks: linked',
      )
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })
})

describe('workflow policy', () => {
  const workflows = Object.fromEntries(
    ['ci.yml', 'codeql.yml', 'release-readiness.yml'].map((name) => [
      name,
      readFileSync(`.github/workflows/${name}`, 'utf8'),
    ]),
  )

  it('accepts the frozen Phase 5 workflow set', () => {
    expect(validateWorkflowPolicy(workflows)).toEqual([])
  })

  it.each([
    [
      'writable permission',
      (source: string) => source.replace('contents: read', 'contents: write'),
    ],
    [
      'tag trigger',
      (source: string) => source.replace('pull_request:', "pull_request:\n    tags: ['v*']"),
    ],
    [
      'OIDC permission',
      (source: string) => source.replace('contents: read', 'contents: read\n  id-token: write'),
    ],
    [
      'credential reference in a value',
      (source: string) =>
        source.replace('env:\n', `env:\n  UNRELATED_VALUE: \${{ secrets.NPM_TOKEN }}\n`),
    ],
    [
      'publication command',
      (source: string) => source.replace('npm run check:phases', 'npm publish'),
    ],
    ['unpinned action', (source: string) => source.replace(/@[a-f0-9]{40}/, '@main')],
    ['unapproved action', (source: string) => source.replace('actions/checkout@', 'evil/action@')],
    ['missing Node 26 coverage', (source: string) => source.replace(", '26.0.0', '26.x'", '')],
    ['unsupported Node 23 major', (source: string) => source.replace("'22.x'", "'23.x'")],
    ['unsupported Node 25 major', (source: string) => source.replace("'26.0.0'", "'25.0.0'")],
    ['unsupported Node 27 major', (source: string) => source.replace("'26.x'", "'27.x'")],
    ['floating Current alias', (source: string) => source.replace("'26.x'", "'current'")],
    ['changed runtime floor', (source: string) => source.replace("'22.13.0'", "'22.12.0'")],
    [
      'ungated candidate verification',
      (source: string) =>
        source.replace(`    if: \${{ needs.baseline-status.outputs.present == 'true' }}\n`, ''),
    ],
    [
      'unreported baseline availability',
      (source: string) => source.replace('id: baseline', 'id: unavailable'),
    ],
  ])('rejects %s structurally', (_name, mutate) => {
    expect(
      validateWorkflowPolicy({ ...workflows, 'ci.yml': mutate(workflows['ci.yml']) }),
    ).not.toEqual([])
  })
})
