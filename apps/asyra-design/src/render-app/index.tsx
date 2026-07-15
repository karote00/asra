import React, { useEffect, useRef } from 'react'
import { destroyRenderApp } from '../controllers/app'
import core from '../contexts'
import { RenderAdapter } from '@asyra/render'
import { providers } from '@asyra/reactive-events'
import { CANVAS_BACKGROUND_COLOR } from '../constants'

const RenderApp: React.FC = () => {
  const renderContainerRef = useRef<HTMLDivElement>(null)
  const hasInit = useRef<boolean>(false)

  useEffect(() => {
    const initApp = async () => {
      if (renderContainerRef.current && !hasInit.current) {
        hasInit.current = true

        // Phase 1: Configure renderer and persistence
        core.setRenderer(new RenderAdapter())
        core.setPersistence(providers.localStorage)

        // Phase 3: Single startup call
        await core.start(renderContainerRef.current, {
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundColor: CANVAS_BACKGROUND_COLOR,
          backgroundColorAlpha: 1
        })
      }
    }

    initApp()

    return () => {
      if (renderContainerRef.current) {
        renderContainerRef.current.innerHTML = ''
        destroyRenderApp()
      }
    }
  }, [])

  return <div className="absolute top-0 left-0" ref={renderContainerRef} />
}

export default RenderApp
