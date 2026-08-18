import { execFileSync } from 'node:child_process'

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('candidate verification must run through npm')

function run(arguments_) {
  execFileSync(process.execPath, [npmCli, ...arguments_], { stdio: 'inherit', windowsHide: true })
}

run(['run', 'build'])
run(['run', 'sbom'])
run(['run', 'sbom:check'])
run(['run', 'sbom:build'])
run(['run', 'sbom:build:check'])
run(['run', 'benchmark'])
run(['run', 'benchmark:check'])
run(['run', 'reproducibility:check', '--', '--full'])
run(['audit', '--audit-level=low'])
run(['run', 'test:consumer'])
run(['run', 'candidate:manifest'])
console.log('candidate=valid')
