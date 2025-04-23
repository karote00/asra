import { useEffect } from 'react'
import {
  subscribeToEndTransaction,
  subscribeToRenderIsReady,
  fileLoadComplete
} from '@asra/reactive-events'
import { initDataContexts } from '@asra/ui-context'
import core from './core'

const DataContexts = () => {
  useEffect(() => {
    initDataContexts()

    const renderSubscription = subscribeToRenderIsReady(() => {
      const fileData = localStorage.getItem('FILE')
      if (fileData) {
        core.load(JSON.parse(fileData))
        fileLoadComplete()
      }
    })

    const transactSubscription = subscribeToEndTransaction(() => {
      localStorage.setItem('FILE', JSON.stringify(core.save()))
    })

    return () => {
      renderSubscription.unsubscribe()
      transactSubscription.unsubscribe()
    }
  }, [])

  return null
}

export default DataContexts
