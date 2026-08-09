import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const CANONICAL_PHASES = Object.freeze([
  Object.freeze({ number: 0, title: 'Product and Spec Lock' }),
  Object.freeze({ number: 1, title: 'Package Scaffolding' }),
  Object.freeze({ number: 2, title: 'Core Implementation and Testing' }),
  Object.freeze({ number: 3, title: 'Benchmarking and SBOM Hardening' }),
  Object.freeze({ number: 4, title: 'Documentation and Migration' }),
  Object.freeze({ number: 5, title: 'Trusted Release' }),
])

export const AUTHORITATIVE_PHASE_FILES = Object.freeze([
  'README.md',
  'docs/phase-map.md',
  'specs/03_COMPETITIVE_ANALYSIS.md',
  'specs/09_PHASE_0_PRODUCT_SPEC_LOCK.md',
  'specs/10_PHASE_1_PACKAGE_SCAFFOLDING.md',
  'specs/11_PHASE_2_CORE_IMPLEMENTATION_AND_TESTING.md',
  'specs/12_PHASE_3_BENCHMARK_SBOM.md',
  'specs/13_PHASE_4_DOCS_MIGRATION.md',
  'specs/14_PHASE_5_RELEASE.md',
  'specs/16_POST_MVP_FEATURES.md',
  'harness/plan.md',
  'harness/invariants.md',
  'harness/loops.md',
  'harness/done.md',
  'harness/kickoff.md',
])

const REQUIRED_TEXT = Object.freeze({
  'README.md': [
    'Phase 0 freezes the product contract. Phase 1 establishes the secure package shell.',
    'the v1 runtime API begins in Phase 2',
  ],
  'docs/phase-map.md': CANONICAL_PHASES.map(({ number, title }) => `| ${number} | ${title} |`),
  'specs/03_COMPETITIVE_ANALYSIS.md': [
    '| Color functions (red, green, blue, etc.) | chalk, picocolors |',
    '| npm OIDC provenance configuration |',
  ],
  'specs/09_PHASE_0_PRODUCT_SPEC_LOCK.md': ['# Phase 0: Product and Spec Lock'],
  'specs/10_PHASE_1_PACKAGE_SCAFFOLDING.md': ['# Phase 1: Package Scaffolding'],
  'specs/11_PHASE_2_CORE_IMPLEMENTATION_AND_TESTING.md': [
    '# Phase 2: Core Implementation and Testing',
  ],
  'specs/12_PHASE_3_BENCHMARK_SBOM.md': ['# Phase 3: Benchmarking and SBOM Hardening'],
  'specs/13_PHASE_4_DOCS_MIGRATION.md': ['# Phase 4: Documentation and Migration'],
  'specs/14_PHASE_5_RELEASE.md': ['# Phase 5: Trusted Release'],
  'specs/16_POST_MVP_FEATURES.md': ['after the Phase 2 core is stable and tested'],
  'harness/plan.md': CANONICAL_PHASES.map(({ number, title }) => `## Phase ${number}: ${title}`),
  'harness/invariants.md': ['canonical phase map', 'npm run check:phase-map'],
  'harness/loops.md': ['`docs/phase-map.md`', '`npm run check:phase-map`'],
  'harness/done.md': ['npm run check:phase-map'],
})

const LEGACY_TAXONOMY = Object.freeze([
  'Phase 0: Scaffolding and Compliance Baseline',
  'Phase 1: Core Implementation Hardening',
  'Phase 2: Testing Matrix',
  'core (Phase 1)',
])

const REQUIRED_PATTERNS = Object.freeze({
  'specs/03_COMPETITIVE_ANALYSIS.md': [
    {
      pattern:
        /^\| Color functions \(red, green, blue, etc\.\) \| chalk, picocolors \|[^\r\n]+\| Phase 2 \|$/m,
      description: 'the color runtime row assigned to Phase 2',
    },
    {
      pattern: /^\| npm OIDC provenance configuration \|[^\r\n]+\| Phase 1 \|$/m,
      description: 'the OIDC package-shell row assigned to Phase 1',
    },
  ],
})

function normalizeTitle(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function validatePhaseMap(documents) {
  const failures = []
  const expectedTitles = new Map(CANONICAL_PHASES.map(({ number, title }) => [number, title]))

  for (const path of AUTHORITATIVE_PHASE_FILES) {
    if (typeof documents[path] !== 'string') {
      failures.push(`missing authoritative phase document: ${path}`)
    }
  }

  for (const [path, requiredText] of Object.entries(REQUIRED_TEXT)) {
    const content = documents[path]

    if (typeof content !== 'string') {
      continue
    }

    for (const value of requiredText) {
      if (!content.includes(value)) {
        failures.push(`${path} must contain: ${value}`)
      }
    }
  }

  for (const [path, requirements] of Object.entries(REQUIRED_PATTERNS)) {
    const content = documents[path]

    if (typeof content !== 'string') {
      continue
    }

    for (const { pattern, description } of requirements) {
      if (!pattern.test(content)) {
        failures.push(`${path} must contain ${description}`)
      }
    }
  }

  for (const [path, content] of Object.entries(documents)) {
    if (!AUTHORITATIVE_PHASE_FILES.includes(path) || typeof content !== 'string') {
      continue
    }

    for (const legacyText of LEGACY_TAXONOMY) {
      if (content.includes(legacyText)) {
        failures.push(`${path} contains legacy phase taxonomy: ${legacyText}`)
      }
    }

    for (const match of content.matchAll(/^#{1,6}\s+Phase\s+([0-5]):\s*(.+?)\s*$/gim)) {
      const phaseNumber = Number(match[1])
      const actualTitle = match[2]
      const expectedTitle = expectedTitles.get(phaseNumber)

      if (normalizeTitle(actualTitle) !== normalizeTitle(expectedTitle)) {
        failures.push(
          `${path} has conflicting Phase ${phaseNumber} heading: expected "${expectedTitle}", found "${actualTitle}"`,
        )
      }
    }
  }

  return failures
}

function run() {
  const documents = {}
  const failures = []

  for (const path of AUTHORITATIVE_PHASE_FILES) {
    try {
      documents[path] = readFileSync(path, 'utf8')
    } catch (error) {
      failures.push(`could not read ${path}: ${error.message}`)
    }
  }

  failures.push(...validatePhaseMap(documents))

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`phase-map: ${failure}`)
    }

    process.exitCode = 1
    return
  }

  console.log('phase-map=pass')
}

const invokedPath = process.argv[1]

if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  run()
}
