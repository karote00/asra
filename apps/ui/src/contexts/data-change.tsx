import { useEffect } from 'react'
import {
  subscribeToEndTransaction,
  fileLoadComplete
} from '@asra/reactive-events'
import { initDataContexts } from '@asra/ui-context'
import { core } from './core'

const DataContexts = () => {
  useEffect(() => {
    initDataContexts()

    const fileData = localStorage.getItem('FILE')
    if (fileData) {
      core.load(JSON.parse(fileData))
      fileLoadComplete()
    }

    const subscription = subscribeToEndTransaction(() => {
      localStorage.setItem('FILE', JSON.stringify(core.save()))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}

export default DataContexts
