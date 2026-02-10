import { useEffect } from 'react'
import {
  subscribeToEndTransaction,
  subscribeToRenderIsReady,
  fileLoadComplete
} from '@asyra/reactive-events'
import { initDataContexts } from '@asyra/ui-context'
import core from './core'

const DataContexts = () => {
  useEffect(() => {
    initDataContexts()

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

    return () => {
      renderSubscription.unsubscribe()
      // transactSubscription.unsubscribe()
    }
  }, [])

  return null
}

export default DataContexts
