import { TailwindConfig } from '@asyra/utils'

export default {
  ...TailwindConfig,
  safelist: [
    {
      pattern: /^h-/
    }
  ],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']
}
