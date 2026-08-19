import spinlog from 'spinlog'

const spinner = spinlog('Loading').start()
spinner.text = 'Loaded'
spinner.succeed()
