/**
 * App-level viewport behaviors
 */

import core from '@asyra/core'
import { PanZoom, ZOOM_SMOOTH_RATIO, MouseSnapshot } from '@asyra/utils'

export const viewportApis = {
    zoomFit: () => {
        const centerDiv = document.querySelector('#viewport-anchor')
        const uiBounds = centerDiv?.getBoundingClientRect()
        if (uiBounds) {
            core.deps.render.zoomFit(uiBounds)
        }
    },
    pan: (x: number, y: number) => {
        const currentPosition = core.deps.render.getViewportPosition()
        core.deps.render.panTo(currentPosition.x - x, currentPosition.y - y)
    },
    zoomToCenter: (
        scale: number,
        clientX: number,
        clientY: number
    ) => {
        core.deps.render.zoomToCenter(scale, clientX, clientY)
    },
    panZoom: (
        panzoom: PanZoom,
        mouse: MouseSnapshot['position'],
        wheel: MouseSnapshot['delta']
    ) => {
        switch (panzoom) {
            case PanZoom.PAN: {
                viewportApis.pan(wheel.x, wheel.y)
                break
            }
            case PanZoom.ZOOM: {
                const currentScale = core.deps.render.getViewportScale()
                const newScale =
                    currentScale *
                    (wheel.y < 0 ? 1 + ZOOM_SMOOTH_RATIO : 1 - ZOOM_SMOOTH_RATIO)
                viewportApis.zoomToCenter(newScale, mouse.x, mouse.y)
                break
            }
        }
    }
}
