export const DOCUMENTED_EXAMPLES = Object.freeze([
  { document: 'README.md', id: 'spinner', path: 'examples/spinner.mjs' },
  { document: 'README.md', id: 'promise', path: 'examples/promise.mjs' },
  { document: 'README.md', id: 'flow', path: 'examples/flow.mjs' },
  { document: 'README.md', id: 'styles', path: 'examples/styles.mjs' },
  { document: 'MIGRATION.md', id: 'migration-chalk', path: 'examples/migration-chalk.mjs' },
  { document: 'MIGRATION.md', id: 'migration-ora', path: 'examples/migration-ora.mjs' },
  { document: 'MIGRATION.md', id: 'migration-clack', path: 'examples/migration-clack.mjs' },
])

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
    if (startIndex === -1 || endIndex === -1 || contents.indexOf(start, startIndex + 1) !== -1) {
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
  let synchronized
  try {
    synchronized = synchronizeExamples(documents, examples)
  } catch (error) {
    failures.push(error.message)
    synchronized = documents
  }

  for (const [path, contents] of Object.entries(documents)) {
    if (synchronized[path] !== contents) failures.push(`${path} example snippets are out of date`)
  }

  const readme = documents['README.md'] ?? ''
  const migration = documents['MIGRATION.md'] ?? ''
  const engine = '^22.13.0 || ^24.0.0 || ^26.0.0'
  for (const text of [
    engine,
    'spinlog(text?, options?)',
    'spinlog.promise(input, options?)',
    'spinlog.intro(message?)',
    'spinlog.outro(message?)',
    'Color precedence is `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR`',
    'never writes to `stdout`',
    'installs no process signal listeners',
    `currently measures ${sizeBytes.toLocaleString('en-US')} bytes using gzip level 9`,
    'Exactly eleven files in the npm tarball',
    'zero runtime components',
    'No production version has been published',
  ]) {
    if (!readme.includes(text)) failures.push(`README.md must contain verified claim: ${text}`)
  }

  for (const text of [
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
  ]) {
    if (!migration.includes(text)) failures.push(`MIGRATION.md must contain bounded claim: ${text}`)
  }

  if (packageJson?.engines?.node !== engine || contract?.runtime?.engines !== engine) {
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

  for (const [path, source] of Object.entries(examples)) {
    if (/\b(?:console\.log|process\.stdout|stdout\.write)\b/u.test(source)) {
      failures.push(`${path} must not write example output to stdout`)
    }
    if (!/from ['"]spinlog(?:\/styles)?['"]/u.test(source)) {
      failures.push(`${path} must exercise a public package entrypoint`)
    }
  }

  for (const [document, source] of Object.entries(documents)) {
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
      const target = match[1].split('#')[0]
      if (target === '' || /^(?:https?:|mailto:)/u.test(target)) continue
      if (!availablePaths.has(target))
        failures.push(`${document} contains a broken relative link: ${target}`)
    }
  }

  return [...new Set(failures)]
}
