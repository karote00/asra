const TailwindConfig = require('@asra/utils').TailwindConfig

module.exports = {
  ...TailwindConfig,
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']
}
