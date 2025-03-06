import React, { useEffect, useRef } from 'react'
import { renderIsReady } from '@asra/reactive-events'
import { initRenderApp, destroyRenderApp } from '../controllers/app'

const RenderApp: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null)
  const hasInit = useRef<boolean>(false)

  useEffect(() => {
    const initApp = async () => {
      if (pixiContainerRef.current && !hasInit.current) {
        hasInit.current = true
        await initRenderApp(
          pixiContainerRef.current,
          window.innerWidth,
          window.innerHeight
        )

        renderIsReady()
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
