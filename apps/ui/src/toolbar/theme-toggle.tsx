import React, { useState, useEffect } from 'react'
import { Button } from '@asra/design-system'

const ThemeToggle: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const theme = localStorage.getItem('theme')
    if (!theme) {
      return true
    }

    return theme === 'dark'
  })

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev)
  }

  return (
    <div style={{ display: 'none' }}>
      <Button
        onClick={toggleTheme}
        label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      />
    </div>
  )
}

export default ThemeToggle
