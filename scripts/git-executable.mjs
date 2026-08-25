import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

const GIT_EXECUTABLE_ENV = 'SPINLOG_GIT_EXECUTABLE'
const POSIX_GIT_PATHS = Object.freeze([
  '/usr/bin/git',
  '/bin/git',
  '/usr/local/bin/git',
  '/opt/homebrew/bin/git',
])

function isRegularFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** Return absolute Git locations without consulting PATH. */
export function gitExecutableCandidates(environment = process.env, platform = process.platform) {
  const configured = environment[GIT_EXECUTABLE_ENV]
  if (configured !== undefined) {
    if (!isAbsolute(configured)) {
      throw new Error(`${GIT_EXECUTABLE_ENV} must be an absolute executable path`)
    }
    return [configured]
  }

  if (platform !== 'win32') return [...POSIX_GIT_PATHS]

  const programFiles = [environment.ProgramW6432, environment.ProgramFiles].filter(
    (directory) => typeof directory === 'string' && directory.length > 0,
  )
  return [...new Set(programFiles.map((directory) => join(directory, 'Git', 'cmd', 'git.exe')))]
}

/** Resolve Git before executing it so release gates never depend on PATH ordering. */
export function resolveGitExecutable(options = {}) {
  const candidates = gitExecutableCandidates(options.environment, options.platform)
  const executable = candidates.find((candidate) => isRegularFile(candidate))
  if (executable === undefined) {
    throw new Error(
      `Git was not found at an approved absolute path; set ${GIT_EXECUTABLE_ENV} to its absolute path`,
    )
  }
  return executable
}

/** Run Git through the absolute executable selected by the resolver. */
export function runGit(arguments_, options) {
  return execFileSync(resolveGitExecutable(), arguments_, options)
}
