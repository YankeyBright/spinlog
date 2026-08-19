import { lexer, walkTokens } from 'marked'

export const DOCUMENTED_EXAMPLES = Object.freeze([
  { document: 'README.md', id: 'spinner', path: 'examples/spinner.mjs' },
  { document: 'README.md', id: 'promise', path: 'examples/promise.mjs' },
  { document: 'README.md', id: 'flow', path: 'examples/flow.mjs' },
  { document: 'README.md', id: 'styles', path: 'examples/styles.mjs' },
  { document: 'MIGRATION.md', id: 'migration-chalk', path: 'examples/migration-chalk.mjs' },
  { document: 'MIGRATION.md', id: 'migration-ora', path: 'examples/migration-ora.mjs' },
  { document: 'MIGRATION.md', id: 'migration-clack', path: 'examples/migration-clack.mjs' },
])
const ENGINE = '^22.13.0 || ^24.0.0 || ^26.0.0'
const REQUIRED_README_CLAIMS = Object.freeze([
  ENGINE,
  'spinlog(text?, options?)',
  'spinlog.promise(input, options?)',
  'spinlog.intro(message?)',
  'spinlog.outro(message?)',
  'Color precedence is `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR`',
  'never writes to `stdout`',
  'installs no process signal listeners',
  'Exactly eleven files in the npm tarball',
  'zero runtime components',
  'No production version has been published',
])
const REQUIRED_MIGRATION_CLAIMS = Object.freeze([
  'not API-compatible with Chalk, Ora, or Clack',
  '## From Chalk',
  '## From Ora',
  '## From Clack',
  'custom streams',
  'custom frame sets',
  'simultaneous spinners',
  'prompts',
  'task groups',
  'progress bars',
])
const EXTERNAL_LINK_PREFIXES = Object.freeze(['http:', 'https:', 'mailto:'])

function exampleBlock(id, source) {
  return `<!-- example:${id}:start -->\n\`\`\`js\n${source.trimEnd()}\n\`\`\`\n<!-- example:${id}:end -->`
}

export function synchronizeExamples(documents, examples) {
  const synchronized = { ...documents }

  for (const { document, id, path } of DOCUMENTED_EXAMPLES) {
    const source = examples[path]
    const contents = synchronized[document]
    if (typeof source !== 'string') throw new Error(`missing canonical example: ${path}`)
    if (typeof contents !== 'string') throw new Error(`missing public document: ${document}`)

    const start = `<!-- example:${id}:start -->`
    const end = `<!-- example:${id}:end -->`
    const startIndex = contents.indexOf(start)
    const endIndex = contents.indexOf(end, startIndex + start.length)
    if (startIndex === -1 || endIndex === -1 || contents.includes(start, startIndex + 1)) {
      throw new Error(`${document} must contain exactly one complete ${id} example block`)
    }
    synchronized[document] =
      contents.slice(0, startIndex) +
      exampleBlock(id, source) +
      contents.slice(endIndex + end.length)
  }

  return synchronized
}

export function validateDocumentation({
  availablePaths,
  contract,
  documents,
  examples,
  packageJson,
  runtimeSbom,
  sizeBytes,
}) {
  const failures = []
  const synchronized = synchronizeDocumentedExamples(documents, examples, failures)
  validateSynchronizedExamples(documents, synchronized, failures)
  validateRequiredClaims(documents, sizeBytes, failures)
  validateDocumentationContract(packageJson, contract, runtimeSbom, failures)
  validateExamples(examples, failures)
  validateRelativeLinks(documents, availablePaths, failures)
  return [...new Set(failures)]
}

function synchronizeDocumentedExamples(documents, examples, failures) {
  try {
    return synchronizeExamples(documents, examples)
  } catch (error) {
    failures.push(error.message)
    return documents
  }
}

function validateSynchronizedExamples(documents, synchronized, failures) {
  for (const [path, contents] of Object.entries(documents)) {
    if (synchronized[path] !== contents) failures.push(`${path} example snippets are out of date`)
  }
}

function validateRequiredClaims(documents, sizeBytes, failures) {
  const readmeClaims = [
    ...REQUIRED_README_CLAIMS,
    `currently measures ${sizeBytes.toLocaleString('en-US')} bytes using gzip level 9`,
  ]
  validateClaims(
    documents['README.md'] ?? '',
    readmeClaims,
    'README.md must contain verified claim',
    failures,
  )
  validateClaims(
    documents['MIGRATION.md'] ?? '',
    REQUIRED_MIGRATION_CLAIMS,
    'MIGRATION.md must contain bounded claim',
    failures,
  )
}

function validateClaims(document, claims, failurePrefix, failures) {
  for (const claim of claims) {
    if (!document.includes(claim)) failures.push(`${failurePrefix}: ${claim}`)
  }
}

function validateDocumentationContract(packageJson, contract, runtimeSbom, failures) {
  if (packageJson?.engines?.node !== ENGINE || contract?.runtime?.engines !== ENGINE) {
    failures.push('README Node support must derive from the frozen package and behavior contract')
  }
  if (JSON.stringify(contract?.runtime?.supportedMajors) !== JSON.stringify([22, 24, 26])) {
    failures.push('documentation requires the frozen Node 22, 24, and 26 major set')
  }
  if (
    JSON.stringify(contract?.publicApi?.callableMethods) !==
    JSON.stringify(['promise', 'intro', 'outro'])
  ) {
    failures.push('documentation requires the exact callable default-export methods')
  }
  if ((runtimeSbom?.components ?? []).length !== 0) {
    failures.push(
      'README zero-runtime-component claim requires an empty runtime SBOM component list',
    )
  }
}

function validateExamples(examples, failures) {
  for (const [path, source] of Object.entries(examples)) {
    validateExampleOutput(path, source, failures)
    validateExampleEntrypoint(path, source, failures)
  }
}

function validateExampleOutput(path, source, failures) {
  if (/\b(?:console\.log|process\.stdout|stdout\.write)\b/u.test(source)) {
    failures.push(`${path} must not write example output to stdout`)
  }
}

function validateExampleEntrypoint(path, source, failures) {
  if (!/from ['"]spinlog(?:\/styles)?['"]/u.test(source)) {
    failures.push(`${path} must exercise a public package entrypoint`)
  }
}

function validateRelativeLinks(documents, availablePaths, failures) {
  for (const [document, source] of Object.entries(documents)) {
    for (const target of markdownLinkTargets(source)) {
      validateRelativeLink(document, target, availablePaths, failures)
    }
  }
}

function markdownLinkTargets(source) {
  const targets = []
  walkTokens(lexer(source), (token) => {
    if (token.type === 'link') targets.push(token.href)
  })
  return targets
}

function validateRelativeLink(document, href, availablePaths, failures) {
  const target = href.split('#')[0]
  if (target === '' || isExternalLink(target)) return
  if (!availablePaths.has(target))
    failures.push(`${document} contains a broken relative link: ${target}`)
}

function isExternalLink(target) {
  return EXTERNAL_LINK_PREFIXES.some((prefix) => target.startsWith(prefix))
}
