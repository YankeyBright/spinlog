const ESBUILD_OVERRIDE_VERSION = '0.28.1'
const TSUP_ESBUILD_RANGE = '^0.27.0'
const AFFECTED_ESBUILD_MINIMUM = [0, 27, 3]
const PATCHED_ESBUILD_MINIMUM = [0, 28, 1]

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  return match?.slice(1).map(Number)
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index]

    if (difference !== 0) {
      return difference
    }
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
    ['target', 'ES2022'],
    ['module', 'Node18'],
    ['moduleResolution', 'Node16'],
    ['rootDir', 'src'],
    ['outDir', 'dist'],
    ['declaration', true],
    ['declarationMap', false],
    ['sourceMap', false],
    ['noEmitOnError', true],
    ['strict', true],
  ]) {
    if (compilerOptions?.[option] !== expected) {
      failures.push(`tsconfig ${option} must be ${String(expected)}`)
    }
  }

  return failures
}

export function validateEsbuildSecurityPolicy(packageJson, packageLock) {
  const failures = []
  const packages = packageLock?.packages ?? {}
  const tsupPackage = packages['node_modules/tsup']
  const rootEsbuild = packages['node_modules/esbuild']

  if (packageJson?.overrides?.tsup?.esbuild !== ESBUILD_OVERRIDE_VERSION) {
    failures.push(`tsup esbuild override must be ${ESBUILD_OVERRIDE_VERSION}`)
  }

  if (packageLock?.lockfileVersion !== 3) {
    failures.push('package-lock.json must use lockfileVersion 3')
  }

  if (tsupPackage?.version !== packageJson?.devDependencies?.tsup) {
    failures.push('package-lock.json tsup version must match package.json')
  }

  if (tsupPackage?.dependencies?.esbuild !== TSUP_ESBUILD_RANGE) {
    failures.push('tsup esbuild range changed; review whether the security override can be retired')
  }

  if (rootEsbuild?.version !== ESBUILD_OVERRIDE_VERSION) {
    failures.push(`package-lock.json root esbuild must resolve to ${ESBUILD_OVERRIDE_VERSION}`)
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
