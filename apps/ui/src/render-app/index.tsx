import React, { useEffect, useRef } from 'react'
import { initRenderApp, destroyRenderApp } from '../controllers/app'

const RenderApp: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initApp = async () => {
      if (pixiContainerRef.current) {
        await initRenderApp(
          pixiContainerRef.current,
          window.innerWidth,
          window.innerHeight
        )
      }
    }

    initApp()

    return () => {
      if (pixiContainerRef.current) {
        pixiContainerRef.current.innerHTML = ''
        destroyRenderApp()
      }
    }
  }, [])

  return <div className="absolute top-0 left-0 z-10" ref={pixiContainerRef} />
}

export default RenderApp
