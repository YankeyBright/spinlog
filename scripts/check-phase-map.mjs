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
  'specs/00_PHASE_MAP.md',
  'specs/03_COMPETITIVE_ANALYSIS.md',
  'specs/09_PHASE_0_PRODUCT_SPEC_LOCK.md',
  'specs/10_PHASE_1_PACKAGE_SCAFFOLDING.md',
  'specs/11_PHASE_2_CORE_IMPLEMENTATION_AND_TESTING.md',
  'specs/12_PHASE_3_BENCHMARK_SBOM.md',
  'specs/13_PHASE_4_DOCS_MIGRATION.md',
  'specs/14_PHASE_5_RELEASE.md',
  'specs/16_POST_MVP_FEATURES.md',
])

const REQUIRED_TEXT = Object.freeze({
  'README.md': [
    'final pre-1.0 API redesign',
    'spinlog@0.2.0',
    'The reviewed release bootstrap fixes only the',
  ],
  'specs/00_PHASE_MAP.md': CANONICAL_PHASES.map(({ number, title }) => `| ${number} | ${title} |`),
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
  'specs/16_POST_MVP_FEATURES.md': ['outside the frozen 0.2 pre-1.0 surface'],
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

function validateAuthoritativePresence(documents) {
  const failures = []
  for (const path of AUTHORITATIVE_PHASE_FILES) {
    if (typeof documents[path] !== 'string') {
      failures.push(`missing authoritative phase document: ${path}`)
    }
  }
  return failures
}

function validateRequiredTextEntries(documents) {
  const failures = []
  for (const [path, requiredText] of Object.entries(REQUIRED_TEXT)) {
    const content = documents[path]
    if (typeof content !== 'string') continue

    for (const value of requiredText) {
      if (!content.includes(value)) {
        failures.push(`${path} must contain: ${value}`)
      }
    }
  }
  return failures
}

function validateRequiredPatternEntries(documents) {
  const failures = []
  for (const [path, requirements] of Object.entries(REQUIRED_PATTERNS)) {
    const content = documents[path]
    if (typeof content !== 'string') continue

    for (const { pattern, description } of requirements) {
      if (!pattern.test(content)) {
        failures.push(`${path} must contain ${description}`)
      }
    }
  }
  return failures
}

function validateLegacyTaxonomyEntries(documents) {
  const failures = []
  for (const [path, content] of Object.entries(documents)) {
    if (!AUTHORITATIVE_PHASE_FILES.includes(path) || typeof content !== 'string') continue

    for (const legacyText of LEGACY_TAXONOMY) {
      if (content.includes(legacyText)) {
        failures.push(`${path} contains legacy phase taxonomy: ${legacyText}`)
      }
    }
  }
  return failures
}

function isHeadingWhitespace(character) {
  return character === ' ' || character === '\t'
}

function skipHeadingWhitespace(line, index) {
  let cursor = index
  while (isHeadingWhitespace(line[cursor])) cursor += 1
  return cursor
}

function parsePhaseHeading(line) {
  let cursor = 0
  while (line[cursor] === '#') cursor += 1
  if (cursor === 0 || cursor > 6) return undefined

  const afterHashes = skipHeadingWhitespace(line, cursor)
  if (afterHashes === cursor || !line.startsWith('Phase', afterHashes)) return undefined

  cursor = afterHashes + 'Phase'.length
  const afterPhase = skipHeadingWhitespace(line, cursor)
  if (afterPhase === cursor) return undefined

  const phase = line[afterPhase]
  if (!'012345'.includes(phase) || line[afterPhase + 1] !== ':') return undefined

  const title = line.slice(afterPhase + 2)
  if (title.length === 0) return undefined

  return { number: Number(phase), title: title.trim() }
}

function validatePhaseHeadingEntries(documents, expectedTitles) {
  const failures = []
  for (const [path, content] of Object.entries(documents)) {
    if (!AUTHORITATIVE_PHASE_FILES.includes(path) || typeof content !== 'string') continue

    for (const rawLine of content.split('\n')) {
      const heading = parsePhaseHeading(rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine)
      if (!heading) continue

      const { number: phaseNumber, title: actualTitle } = heading
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

export function validatePhaseMap(documents) {
  const expectedTitles = new Map(CANONICAL_PHASES.map(({ number, title }) => [number, title]))

  return [
    ...validateAuthoritativePresence(documents),
    ...validateRequiredTextEntries(documents),
    ...validateRequiredPatternEntries(documents),
    ...validateLegacyTaxonomyEntries(documents),
    ...validatePhaseHeadingEntries(documents, expectedTitles),
  ]
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
