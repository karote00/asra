import { useEffect, useState } from 'react'
import { selectionStore } from '@asra/ui-context'
import { BehaviorSubject } from 'rxjs'

export const useElementSelection = (): Set<string> => {
  const subject = selectionStore.elements
  const [elementSelection, setElementSelection] = useState<Set<string>>(
    new Set()
  )

  useEffect(() => {
    if (!subject) return

    const sub = (subject as BehaviorSubject<Set<string>>).subscribe(
      setElementSelection
    )
    return () => sub.unsubscribe()
  }, [subject])

  return elementSelection
}
