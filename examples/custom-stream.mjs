import { PassThrough } from 'node:stream'

import spinlog from 'spinlog'

// Stream ownership stays with the application. This target is deliberately
// non-TTY, so it demonstrates deterministic static output as well.
const output = new PassThrough()
output.pipe(process.stderr, { end: false })

const spinner = spinlog('Writing report', {
  color: false,
  stream: output,
  terminal: 'static',
  unicode: false,
}).start()

spinner.succeed('Report written')
output.end()
