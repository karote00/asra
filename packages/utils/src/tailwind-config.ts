export const TailwindConfig = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3A4D39',
          10: '#E6F2E6',
          20: '#CCE5CC',
          30: '#B3D8B3',
          40: '#99CC99',
          50: '#80BF80',
          60: '#66B366',
          70: '#4DA64D',
          80: '#339933',
          90: '#1A8C1A',
          100: '#007F00'
        },
        secondary: {
          DEFAULT: '#4A4A4A',
          10: '#E6E6E6',
          20: '#CCCCCC',
          30: '#B3B3B3',
          40: '#999999',
          50: '#808080',
          60: '#666666',
          70: '#4D4D4D',
          80: '#333333',
          90: '#1A1A1A',
          100: '#000000'
        },
        accent: {
          DEFAULT: '#A3C4BC',
          10: '#EAF4F1',
          20: '#D5EAE4',
          30: '#C0DFD7',
          40: '#ABd5CA',
          50: '#96CABC',
          60: '#81C0AF',
          70: '#6CB6A1',
          80: '#57AC94',
          90: '#429F86',
          100: '#2D9278'
        },
        warning: {
          DEFAULT: '#D85C47',
          10: '#F9E6E3',
          20: '#F3CCC7',
          30: '#EFB3AB',
          40: '#EA9990',
          50: '#E47F74',
          60: '#DF6658',
          70: '#D94C3D',
          80: '#D43321',
          90: '#CE1A06',
          100: '#B31200'
        },
        panel: {
          dark: '#1A1A1A',
          darker: '#141414',
          light: '#242424',
          lighter: '#343434'
        },
        text: {
          primary: '#E0E0E0',
          secondary: '#A0A0A0'
        },
        border: {
          dark: '#333333'
        },
        divider: '#2D2D2D',
        inputBorder: '#3C3C3C',
        inputFocus: '#A3C4BC'
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'Inter', 'sans-serif']
      },
      boxShadow: {
        subtle: '0 2px 4px rgba(0, 0, 0, 0.1)'
      },
      borderColor: {
        DEFAULT: '#2D2D2D'
      }
    }
  },
  plugins: []
}
