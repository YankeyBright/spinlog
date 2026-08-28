const ESBUILD_VERSION = '0.28.2'
const AFFECTED_ESBUILD_MINIMUM = [0, 27, 3]
const PATCHED_ESBUILD_MINIMUM = [0, 28, 1]

function humanList(values) {
  if (values.length === 0) return ''
  if (values.length === 1) return values[0]
  if (values.length === 2) return values.join(' and ')
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

function supportedNodeMajors(engine) {
  if (typeof engine !== 'string') return []
  return [...engine.matchAll(/\^(\d+)\.\d+\.\d+/gu)].map((match) => match[1])
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  return match?.slice(1).map(Number)
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index]
    if (difference !== 0) return difference
  }
  return 0
}

function isAffectedEsbuildVersion(version) {
  const parsed = parseVersion(version)
  return (
    parsed !== undefined &&
    compareVersions(parsed, AFFECTED_ESBUILD_MINIMUM) >= 0 &&
    compareVersions(parsed, PATCHED_ESBUILD_MINIMUM) < 0
  )
}

export function validateTypeScriptConfig(tsconfig) {
  const compilerOptions = tsconfig?.compilerOptions
  const failures = []

  for (const [option, expected] of [
    ['target', 'ES2023'],
    ['module', 'Node20'],
    ['moduleResolution', 'Node16'],
    ['rootDir', 'src'],
    ['outDir', 'dist'],
    ['declaration', true],
    ['declarationMap', false],
    ['sourceMap', false],
    ['noEmitOnError', true],
    ['strict', true],
    ['verbatimModuleSyntax', true],
    ['isolatedModules', true],
    ['isolatedDeclarations', true],
    ['noUncheckedSideEffectImports', true],
    ['moduleDetection', 'force'],
    ['noUncheckedIndexedAccess', true],
    ['noImplicitReturns', true],
    ['noUnusedLocals', true],
    ['noUnusedParameters', true],
    ['noFallthroughCasesInSwitch', true],
    ['skipLibCheck', false],
  ]) {
    if (compilerOptions?.[option] !== expected) {
      failures.push(`tsconfig ${option} must be ${String(expected)}`)
    }
  }

  if ('esModuleInterop' in (compilerOptions ?? {})) {
    failures.push('tsconfig must not enable CommonJS interoperability')
  }
  if (JSON.stringify(compilerOptions?.lib) !== JSON.stringify(['ES2023'])) {
    failures.push('tsconfig lib must be exactly ES2023')
  }
  if (JSON.stringify(compilerOptions?.types) !== JSON.stringify(['node'])) {
    failures.push('tsconfig types must explicitly include only node')
  }

  return failures
}

/** Keep the human-maintained toolchain specification aligned with executable configuration. */
export function validateToolchainDocumentation(document, packageJson, biome) {
  const failures = []
  const dependencies = packageJson?.devDependencies ?? {}
  const nodeMajors = supportedNodeMajors(packageJson?.engines?.node)
  const biomeVersion = dependencies['@biomejs/biome']
  const expectedSchema =
    typeof biomeVersion === 'string'
      ? `https://biomejs.dev/schemas/${biomeVersion}/schema.json`
      : undefined

  if (typeof document !== 'string') return ['specs/04_TECH_STACK.md must be readable text']

  const expectedRuntime = `Runtime support: Node.js ${humanList(nodeMajors)}.`
  if (nodeMajors.length === 0 || !document.includes(expectedRuntime)) {
    failures.push('toolchain documentation must state the manifest-supported Node majors')
  }
  if (
    !document.includes("Spinlog's internal metadata-driven SGR composer") ||
    !document.includes("Node's `stripVTControlCharacters`") ||
    document.includes('styleText')
  ) {
    failures.push(
      'toolchain documentation must describe the internal SGR composer and VT sanitization',
    )
  }
  if (
    typeof biomeVersion !== 'string' ||
    !document.includes(`Biome \`${biomeVersion}\` owns formatting and linting.`)
  ) {
    failures.push('toolchain documentation must state the manifest-pinned Biome version')
  }
  if (biome?.$schema !== expectedSchema) {
    failures.push('biome.json schema must match the manifest-pinned Biome version')
  }

  return failures
}

export function validateEsbuildSecurityPolicy(packageJson, packageLock) {
  const failures = []
  const packages = packageLock?.packages ?? {}
  const rootEsbuild = packages['node_modules/esbuild']

  if (packageJson?.devDependencies?.esbuild !== ESBUILD_VERSION) {
    failures.push(`esbuild must be a direct exact pin at ${ESBUILD_VERSION}`)
  }
  if ('tsup' in (packageJson?.devDependencies ?? {})) {
    failures.push('tsup must not remain after direct esbuild migration')
  }
  if ('overrides' in (packageJson ?? {})) {
    failures.push('package.json overrides must be absent after direct esbuild migration')
  }
  if (packageLock?.lockfileVersion !== 3) {
    failures.push('package-lock.json must use lockfileVersion 3')
  }
  if (rootEsbuild?.version !== ESBUILD_VERSION) {
    failures.push(`package-lock.json root esbuild must resolve to ${ESBUILD_VERSION}`)
  }

  for (const [path, metadata] of Object.entries(packages)) {
    if (path.endsWith('node_modules/esbuild') && isAffectedEsbuildVersion(metadata?.version)) {
      failures.push(
        `${path} resolves ${metadata.version}, which is affected by GHSA-g7r4-m6w7-qqqr`,
      )
    }
  }

  return failures
}
