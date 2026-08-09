import { useEffect } from 'react'
import { getFeature, subscribeToFileLoadComplete } from '@asyra/core'
import { FeatureNames } from '../constants'

const DataContexts = () => {
  useEffect(() => {
    // Trigger zoom fit after file is loaded to show all content in viewport
    const fileLoadSubscription = subscribeToFileLoadComplete(() => {
      try {
        const featureAPI = getFeature(FeatureNames.ZOOM_FIT)
        if (featureAPI?.zoomFit) {
          const zoomFitFn = featureAPI.zoomFit as () => void
          zoomFitFn()
        }
      } catch (error) {
        // Feature may not be available yet
      }
    })

    return () => {
      fileLoadSubscription.unsubscribe()
    }
  }, [])

  return null
}

export default DataContexts
