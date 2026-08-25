import spinlog from 'spinlog'

const group = spinlog.group({ indent: 2, maxRows: 4 })
const install = group.add('Installing packages').start()
const build = group.add('Building assets').start()

install.succeed('Installed')
build.succeed('Built')
group.stop()
