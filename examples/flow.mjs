import spinlog from 'spinlog'

spinlog.intro('Deployment')
const spinner = spinlog('Verifying').start()
spinner.succeed()
spinlog.outro('Complete')
