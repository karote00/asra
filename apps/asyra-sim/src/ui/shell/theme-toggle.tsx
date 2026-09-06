import { useEffect, useLayoutEffect, useState } from 'react'
import { ToolbarButton } from './toolbar-button'

const preferenceKey = 'asyra-sim.ui-theme'

type Theme = 'light' | 'dark'

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(preferenceKey)

    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

/** UI preference only: never part of a workcell, saved experiment or Undo. */
export function ThemeToggle() {
  const [preference, setPreference] = useState(savedTheme)

  const [systemDark, setSystemDark] = useState(
    () => matchMedia('(prefers-color-scheme: dark)').matches
  )

  const theme = preference ?? (systemDark ? 'dark' : 'light')

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')

    const changed = () => setSystemDark(media.matches)

    media.addEventListener('change', changed)

    return () => media.removeEventListener('change', changed)
  }, [])

  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`

  return (
    <ToolbarButton
      className="theme-toggle"
      label={label}
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark'

        setPreference(next)

        try {
          localStorage.setItem(preferenceKey, next)
        } catch {
          /* Switching still works without storage. */
        }
      }}
    >
      {theme === 'dark' ? (
        <>
          <circle cx="12" cy="12" r="4" />

          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ) : (
        <path d="M20.7 13a8.8 8.8 0 0 1-9.7-9.7A8.8 8.8 0 1 0 20.7 13Z" />
      )}
    </ToolbarButton>
  )
}
