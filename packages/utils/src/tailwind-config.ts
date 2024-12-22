export const TailwindConfig = {
  darkMode: 'class',
  mode: 'jit',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A73E8',
          10: '#e5f1ff',
          20: '#c9d9ff',
          30: '#a3c0ff',
          40: '#7ea7ff',
          50: '#599eff',
          60: '#3385ff',
          70: '#1d6dff',
          80: '#1258d8',
          90: '#0a44b1',
          100: '#003590'
        },
        secondary: {
          DEFAULT: '#FF6F61',
          10: '#ffdfd9',
          20: '#ffbdb7',
          30: '#ff9b96',
          40: '#ff7a75',
          50: '#ff5853',
          60: '#ff3732',
          70: '#ff1611',
          80: '#e6120f',
          90: '#b7100c',
          100: '#9c0e09'
        },
        panel: {
          bg: {
            light: '#F7F7F7',
            dark: '#2D2D2D'
          },
          border: {
            light: '#E0E0E0',
            dark: '#484848'
          }
        },
        text: {
          DEFAULT: '#333333',
          light: '#B0B0B0',
          dark: '#1A1A1A'
        }
      },
      spacing: {
        0.5: '0.125rem',
        1: '0.25rem',
        1.5: '0.375rem',
        2: '0.5rem',
        2.5: '0.625rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
        72: '18rem',
        80: '20rem',
        96: '24rem'
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
        serif: ['Serif', 'Georgia', 'serif']
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem'
      }
    }
  },
  plugins: []
}
