import { execFileSync } from 'node:child_process'

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('stability testing must run through npm')

for (let run = 1; run <= 3; run += 1) {
  console.log(`stability-run=${run}`)
  execFileSync(process.execPath, [npmCli, 'test'], { stdio: 'inherit', windowsHide: true })
}

console.log('stability=pass runs=3')
