import spinlog from 'spinlog'

const artifact = await spinlog.promise(() => Promise.resolve('dist/index.js'), {
  text: 'Building package',
})

if (artifact !== 'dist/index.js') throw new Error('unexpected artifact')
