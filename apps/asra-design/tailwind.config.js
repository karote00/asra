import { TailwindConfig } from '@asra/utils'

export default {
  ...TailwindConfig,
  safelist: [
    {
      pattern: /^h-/
    }
  ],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']
}
