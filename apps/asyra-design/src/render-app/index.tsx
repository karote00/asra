import React, { useEffect, useRef } from 'react'
import {
  initRenderApp,
  destroyRenderApp,
  renderIsReady,
  setupInputSystem
} from '../controllers/app'
import { decideToZoomFit } from '../init/events/interaction'

const RenderApp: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement>(null)
  const hasInit = useRef<boolean>(false)

  useEffect(() => {
    const initApp = async () => {
      if (pixiContainerRef.current && !hasInit.current) {
        hasInit.current = true
        const canvas = await initRenderApp(
          pixiContainerRef.current,
          window.innerWidth,
          window.innerHeight
        )

        setupInputSystem(canvas)
        renderIsReady()
        decideToZoomFit()
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

  return <div className="absolute top-0 left-0" ref={pixiContainerRef} />
}

export default RenderApp
