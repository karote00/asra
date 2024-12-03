import React, { useEffect, useRef } from 'react'
import { app } from './states/app'
import { initPixiApp, destroyPixiApp } from './controllers/app'

const PixiApp: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pixiContainerRef.current) {
      initPixiApp(pixiContainerRef.current, 800, 600)
    }

    return () => {
      if (pixiContainerRef.current) {
        pixiContainerRef.current.innerHTML = ''
        destroyPixiApp()
      }
    }
  }, [app.value])

  return <div ref={pixiContainerRef} />
}

export default PixiApp
