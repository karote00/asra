import { useState, useEffect } from 'react'
import { subscribeToEvents, AllEvent } from '@asyra/reactive-events'

const MAX_EVENTS = 300

export const useEventStream = () => {
  const [events, setEvents] = useState<AllEvent[]>([])

  useEffect(() => {
    const subscription = subscribeToEvents((event) => {
      setEvents((prevEvents) => [event, ...prevEvents.slice(0, MAX_EVENTS - 1)])
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return events
}
