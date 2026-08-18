import { isDeepStrictEqual } from 'node:util'

const REPRODUCIBLE_PROPERTY = Object.freeze({ name: 'cdx:reproducible', value: 'true' })

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }
  return value
}

function componentIdentity(packageJson) {
  const reference = `${packageJson.name}@${packageJson.version}`
  return {
    'bom-ref': reference,
    author: packageJson.author,
    description: packageJson.description,
    externalReferences: [
      { type: 'issue-tracker', url: packageJson.bugs.url },
      { type: 'vcs', url: packageJson.repository.url },
      { type: 'website', url: packageJson.homepage },
    ],
    licenses: [{ license: { id: packageJson.license } }],
    name: packageJson.name,
    purl: `pkg:npm/${packageJson.name}@${packageJson.version}`,
    scope: 'required',
    type: 'library',
    version: packageJson.version,
  }
}

function normalizeMetadata(bom, packageJson) {
  delete bom.serialNumber
  delete bom.metadata?.timestamp
  if (bom.metadata === null || typeof bom.metadata !== 'object') bom.metadata = {}

  const properties = Array.isArray(bom.metadata.properties)
    ? bom.metadata.properties.filter(({ name }) => name !== REPRODUCIBLE_PROPERTY.name)
    : []
  bom.metadata.properties = [...properties, REPRODUCIBLE_PROPERTY].sort((left, right) =>
    left.name.localeCompare(right.name),
  )
  bom.metadata.tools = [{ name: 'cli', vendor: 'npm' }]
  bom.metadata.component = componentIdentity(packageJson)
}

function normalizeDependencies(dependencies, rootReference) {
  if (!Array.isArray(dependencies)) return []
  return dependencies
    .map(({ dependsOn = [], ref }) => ({
      dependsOn: [...dependsOn].sort(),
      ref: ref === rootReference ? rootReference : ref,
    }))
    .sort((left, right) => left.ref.localeCompare(right.ref))
}

function validateIdentity(bom, packageJson) {
  const failures = []
  const reference = `${packageJson.name}@${packageJson.version}`
  const component = bom.metadata?.component
  const properties = bom.metadata?.properties
  const references = component?.externalReferences

  if (bom.$schema !== 'http://cyclonedx.org/schema/bom-1.5.schema.json') {
    failures.push('$schema must identify CycloneDX 1.5')
  }
  if (bom.bomFormat !== 'CycloneDX') failures.push('bomFormat must be CycloneDX')
  if (bom.specVersion !== '1.5') failures.push('specVersion must be 1.5')
  if (bom.version !== 1) failures.push('SBOM document version must be 1')
  if ('serialNumber' in bom || 'timestamp' in (bom.metadata ?? {})) {
    failures.push('SBOM must not contain volatile serial or timestamp fields')
  }
  if (!isDeepStrictEqual(bom.metadata?.tools, [{ name: 'cli', vendor: 'npm' }])) {
    failures.push('SBOM generator identity must be the npm CLI without a volatile version')
  }
  if (
    !Array.isArray(properties) ||
    !properties.some(({ name, value }) => name === 'cdx:reproducible' && value === 'true')
  ) {
    failures.push('SBOM must declare reproducible output')
  }
  if (!isDeepStrictEqual(component, componentIdentity(packageJson))) {
    failures.push(
      'SBOM component identity, license, description, and repository references must match package.json',
    )
  }
  if (
    !Array.isArray(references) ||
    references.find(({ type }) => type === 'vcs')?.url !== packageJson.repository.url
  ) {
    failures.push('SBOM VCS reference must match package.json')
  }
  if (component?.['bom-ref'] !== reference)
    failures.push('metadata.component bom-ref must match the package identity')
  return failures
}

export function normalizeSbom(input, packageJson) {
  const bom = structuredClone(input)
  const reference = `${packageJson.name}@${packageJson.version}`
  const sourceReference = bom.metadata?.component?.['bom-ref']

  normalizeMetadata(bom, packageJson)
  bom.components = Array.isArray(bom.components) ? bom.components : []
  bom.dependencies = Array.isArray(bom.dependencies)
    ? bom.dependencies
        .map(({ dependsOn = [], ref }) => ({
          dependsOn: [...dependsOn]
            .map((dependency) => (dependency === sourceReference ? reference : dependency))
            .sort(),
          ref: ref === sourceReference ? reference : ref,
        }))
        .sort((left, right) => String(left.ref).localeCompare(String(right.ref)))
    : []
  return canonicalize(bom)
}

export function normalizeBuildSbom(input, packageJson) {
  const bom = structuredClone(input)
  const reference = `${packageJson.name}@${packageJson.version}`

  normalizeMetadata(bom, packageJson)
  bom.components = Array.isArray(bom.components)
    ? [...bom.components].sort((left, right) =>
        String(left['bom-ref']).localeCompare(String(right['bom-ref'])),
      )
    : []
  bom.dependencies = normalizeDependencies(bom.dependencies, reference)
  return canonicalize(bom)
}

export function validateSbom(bom, packageJson) {
  const failures = validateIdentity(bom, packageJson)
  const reference = `${packageJson.name}@${packageJson.version}`

  if (!Array.isArray(bom.components) || bom.components.length !== 0) {
    failures.push(`components must be empty, found ${bom.components?.length ?? 'invalid'}`)
  }
  if (!isDeepStrictEqual(bom.dependencies, [{ dependsOn: [], ref: reference }])) {
    failures.push('dependency graph must contain only the dependency-free root package')
  }
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (Object.keys(packageJson[field] ?? {}).length !== 0) {
      failures.push(`${field} must be empty before generating the runtime SBOM`)
    }
  }
  return failures
}

export function validateRawRuntimeSbom(bom, packageJson) {
  const failures = []
  const reference = bom?.metadata?.component?.['bom-ref']

  if (!Array.isArray(bom?.components)) {
    failures.push('raw runtime SBOM components must be an array')
  } else if (bom.components.length !== 0) {
    failures.push(`raw runtime SBOM components must be empty, found ${bom.components.length}`)
  }
  if (typeof reference !== 'string' || reference.length === 0) {
    failures.push('raw runtime SBOM root bom-ref must be a non-empty string')
  } else if (!isDeepStrictEqual(bom?.dependencies, [{ dependsOn: [], ref: reference }])) {
    failures.push(
      'raw runtime SBOM dependency graph must contain only its dependency-free root package',
    )
  }
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (Object.keys(packageJson[field] ?? {}).length !== 0) {
      failures.push(`${field} must be empty before generating the runtime SBOM`)
    }
  }
  return failures
}

export function validateBuildSbom(bom, packageJson) {
  const failures = validateIdentity(bom, packageJson)
  const reference = `${packageJson.name}@${packageJson.version}`
  const components = Array.isArray(bom.components) ? bom.components : []
  const dependencies = Array.isArray(bom.dependencies) ? bom.dependencies : []
  const root = dependencies.find((entry) => entry?.ref === reference)

  if (components.length === 0) failures.push('build SBOM must include development components')
  if (!root) failures.push('build SBOM must include the root dependency graph')
  if (
    JSON.stringify(components) !==
    JSON.stringify(
      [...components].sort((left, right) =>
        String(left?.['bom-ref']).localeCompare(String(right?.['bom-ref'])),
      ),
    )
  ) {
    failures.push('build SBOM components must use canonical bom-ref ordering')
  }
  if (
    JSON.stringify(dependencies) !== JSON.stringify(normalizeDependencies(dependencies, reference))
  ) {
    failures.push('build SBOM dependencies must use canonical ordering')
  }
  for (const [name, version] of Object.entries(packageJson.devDependencies ?? {})) {
    if (
      !components.some((component) => component?.name === name && component?.version === version)
    ) {
      failures.push(`build SBOM must include direct development dependency: ${name}@${version}`)
    }
  }
  return failures
}

export { REPRODUCIBLE_PROPERTY, canonicalize }
