import { existsSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

function removeDirectory(path) {
  rmSync(path, { force: true, recursive: true })
}

function uniqueSiblingPath(directory, label) {
  const parent = dirname(directory)
  const name = basename(directory)

  let candidate = join(parent, `.${name}.${label}-${randomUUID()}`)
  while (existsSync(candidate)) {
    candidate = join(parent, `.${name}.${label}-${randomUUID()}`)
  }

  return candidate
}

/** Create a unique staging directory beside the final package output. */
export function createBuildStagingDirectory(projectRoot) {
  return mkdtempSync(join(projectRoot, '.dist.staging-'))
}

/**
 * Promote a complete staged build without discarding an existing distribution
 * until the replacement is ready. If promotion fails, restore the old output.
 */
export function promoteStagedOutput(stagingDirectory, outputDirectory) {
  const backupDirectory = existsSync(outputDirectory)
    ? uniqueSiblingPath(outputDirectory, 'backup')
    : undefined

  if (backupDirectory !== undefined) {
    renameSync(outputDirectory, backupDirectory)
  }

  try {
    renameSync(stagingDirectory, outputDirectory)
  } catch (error) {
    if (backupDirectory === undefined) throw error

    try {
      removeDirectory(outputDirectory)
      renameSync(backupDirectory, outputDirectory)
    } catch (restoreError) {
      throw new AggregateError(
        [error, restoreError],
        'Could not promote staged build output or restore the previous distribution',
      )
    }

    throw error
  }

  if (backupDirectory !== undefined) {
    removeDirectory(backupDirectory)
  }
}

/** Build in a project-local staging directory, then promote only on success. */
export async function buildTransactionalOutput({ projectRoot, outputDirectory, build }) {
  const stagingDirectory = createBuildStagingDirectory(projectRoot)

  try {
    await build(stagingDirectory)
    promoteStagedOutput(stagingDirectory, outputDirectory)
  } finally {
    removeDirectory(stagingDirectory)
  }
}
