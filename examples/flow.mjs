import spinlog from 'spinlog'

const output = { color: false, indent: 2, unicode: false }

spinlog.intro('Deployment', output)
const spinner = spinlog('Verifying', output).start()
spinner.succeed()
spinlog.outro('Complete', output)
