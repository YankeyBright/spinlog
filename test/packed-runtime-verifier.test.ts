import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { findPackedTarball, resolveArtifactDirectory } from '../scripts/verify-packed-runtime.mjs'

const workspaces: string[] = []

function artifactFixture() {
  const project = mkdtempSync(join(tmpdir(), 'spinlog-packed-runtime-'))
  const artifacts = join(project, 'artifacts')
  const packageDirectory = join(artifacts, 'package')
  mkdirSync(packageDirectory, { recursive: true })
  workspaces.push(project)
  return { artifacts, packageDirectory, project }
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { force: true, recursive: true })
  }
})

describe('packed runtime artifact boundary', () => {
  it('accepts a canonical artifact subdirectory inside the repository', () => {
    const { artifacts, packageDirectory, project } = artifactFixture()

    expect(resolveArtifactDirectory('artifacts/package', project, artifacts)).toBe(
      realpathSync(packageDirectory),
    )
  })

  it('rejects a CLI path outside the repository artifact root', () => {
    const { artifacts, project } = artifactFixture()
    const outside = join(project, 'outside')
    mkdirSync(outside)

    expect(() => resolveArtifactDirectory('outside', project, artifacts)).toThrow(
      'artifact directory must stay within the repository artifacts directory',
    )
  })

  it('rejects an artifact-directory symlink that resolves outside the artifact root', () => {
    const { artifacts, project } = artifactFixture()
    const outside = join(project, 'outside')
    const escaped = join(artifacts, 'escaped')
    mkdirSync(outside)
    symlinkSync(outside, escaped, process.platform === 'win32' ? 'junction' : 'dir')

    expect(() => resolveArtifactDirectory('artifacts/escaped', project, artifacts)).toThrow(
      'artifact directory must stay within the repository artifacts directory',
    )
  })

  it('selects only a regular tarball from the approved artifact directory', () => {
    const { packageDirectory } = artifactFixture()
    const tarball = join(packageDirectory, 'spinlog-0.1.0.tgz')
    writeFileSync(tarball, 'package')
    mkdirSync(join(packageDirectory, 'not-a-package.tgz'))

    expect(findPackedTarball(packageDirectory)).toBe(realpathSync(tarball))
  })
})
