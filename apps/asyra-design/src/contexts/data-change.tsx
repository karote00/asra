import { useEffect } from 'react'
import {
  subscribeToRenderIsReady,
  subscribeToFileLoadComplete,
  fileLoadComplete
} from '@asyra/reactive-events'
import { importFeature } from '@asyra/feature-system'

const DataContexts = () => {
  useEffect(() => {
    // Old persistence is now handled by core.start() with setPersistence()
    // Commenting out to avoid duplicate save/load
    // const renderSubscription = subscribeToRenderIsReady(() => {
    //   // TODO: Connect to DB
    //   const fileData = localStorage.getItem('FILE')
    //   if (fileData) {
    //     core.load(JSON.parse(fileData))
    //     fileLoadComplete()
    //   }
    // })

    // const transactSubscription = subscribeToEndTransaction(async () => {
    //   // TODO: Connect to DB
    //   const coreData = await core.save()
    //   localStorage.setItem('FILE', JSON.stringify(coreData))
    // })

    // Still need fileLoadComplete for any subscribers to this event
    const renderSubscription = subscribeToRenderIsReady(() => {
      fileLoadComplete()
    })

    // Trigger zoom fit after file is loaded to show all content in viewport
    const fileLoadSubscription = subscribeToFileLoadComplete(() => {
      try {
        const featureAPI = importFeature('zoomFit')
        if (featureAPI?.zoomFit) {
          const zoomFitFn = featureAPI.zoomFit as () => void
          zoomFitFn()
        }
      } catch (error) {
        // Feature may not be available yet
      }
    })

    return () => {
      renderSubscription.unsubscribe()
      fileLoadSubscription.unsubscribe()
      // transactSubscription.unsubscribe()
    }
  }, [])

  return null
}

export default DataContexts
