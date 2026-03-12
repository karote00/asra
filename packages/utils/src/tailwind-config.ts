export const TailwindConfig = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Panel backgrounds
        panel: {
          DEFAULT: '#2c2c2c',
          deep: '#1e1e1e',
          surface: '#383838',
          'surface-hover': '#444444'
        },
        // Accent / interactive
        accent: {
          DEFAULT: '#0d99ff',
          hover: '#0b85e0'
        },
        // Text colors
        text: {
          primary: '#e5e5e5',
          secondary: '#999999',
          tertiary: '#777777',
          disabled: '#555555'
        },
        // Borders
        border: {
          DEFAULT: '#333333',
          subtle: '#2d2d2d',
          input: '#3c3c3c',
          hover: '#444444',
          focus: '#0d99ff'
        },
        // Semantic colors
        success: {
          DEFAULT: '#34c759'
        },
        warning: {
          DEFAULT: '#ff9f0a'
        },
        danger: {
          DEFAULT: '#ff3b30'
        },
        // Divider
        divider: '#2d2d2d'
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'Inter', 'sans-serif']
      },
      boxShadow: {
        subtle: '0 2px 4px rgba(0, 0, 0, 0.1)',
        panel: '0 8px 24px rgba(0, 0, 0, 0.3)',
        popup: '0 20px 50px rgba(0, 0, 0, 0.45)'
      },
      borderColor: {
        DEFAULT: '#2d2d2d'
      }
    }
  },
  plugins: [
    function ({ addBase, addComponents, theme }: any) {
      addBase({
        '::-webkit-scrollbar': {
          width: '6px',
          height: '6px'
        },
        '::-webkit-scrollbar-track': {
          background: 'transparent'
        },
        '::-webkit-scrollbar-thumb': {
          background: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '3px'
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: 'rgba(255, 255, 255, 0.2)'
        },
        select: {
          '-webkit-appearance': 'none',
          '-moz-appearance': 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          paddingRight: '24px !important'
        },
        'input[type="checkbox"]': {
          '-webkit-appearance': 'none',
          '-moz-appearance': 'none',
          appearance: 'none',
          width: '14px',
          height: '14px',
          border: '1.5px solid #555',
          borderRadius: '3px',
          background: 'transparent',
          cursor: 'pointer',
          position: 'relative',
          transition: 'border-color 0.12s ease, background 0.12s ease',
          '&:checked': {
            background: theme('colors.accent.DEFAULT'),
            borderColor: theme('colors.accent.DEFAULT'),
            '&::after': {
              content: '""',
              position: 'absolute',
              left: '3px',
              top: '1px',
              width: '5px',
              height: '8px',
              border: 'solid #fff',
              borderWidth: '0 1.5px 1.5px 0',
              transform: 'rotate(45deg)'
            }
          },
          '&:hover': {
            borderColor: '#888'
          }
        }
      })

      addComponents({
        '.icon-btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '4px',
          border: 'none',
          background: 'transparent',
          color: theme('colors.text.secondary'),
          cursor: 'pointer',
          transition: 'background 0.12s ease, color 0.12s ease',
          padding: '0',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.06)',
            color: theme('colors.text.primary')
          },
          '&.active': {
            background: theme('colors.accent.DEFAULT'),
            color: '#fff'
          }
        },
        '.tool-btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: 'none',
          background: 'transparent',
          color: theme('colors.text.secondary'),
          cursor: 'pointer',
          transition: 'background 0.15s ease, color 0.15s ease',
          padding: '0',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.06)',
            color: theme('colors.text.primary')
          },
          '&.active': {
            background: theme('colors.accent.DEFAULT'),
            color: '#fff'
          }
        },
        '.add-btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          border: 'none',
          background: 'transparent',
          color: theme('colors.text.secondary'),
          cursor: 'pointer',
          transition: 'background 0.12s ease, color 0.12s ease',
          padding: '0',
          fontSize: '16px',
          lineHeight: '1',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.06)',
            color: theme('colors.text.primary')
          }
        },
        '.remove-btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '22px',
          padding: '0 6px',
          borderRadius: '4px',
          border: 'none',
          background: 'transparent',
          color: theme('colors.text.secondary'),
          cursor: 'pointer',
          fontSize: '10px',
          transition: 'background 0.12s ease, color 0.12s ease',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.06)',
            color: theme('colors.text.primary')
          }
        },
        '.layer-item': {
          transition: 'background 0.1s ease',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.04)'
          }
        },
        '.zoom-display': {
          fontSize: '11px',
          fontWeight: '500',
          color: theme('colors.text.secondary'),
          minWidth: '56px',
          textAlign: 'right',
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'default',
          transition: 'background 0.12s ease',
          '&:hover': {
            background: 'rgba(255, 255, 255, 0.04)'
          }
        }
      })
    }
  ]
}
