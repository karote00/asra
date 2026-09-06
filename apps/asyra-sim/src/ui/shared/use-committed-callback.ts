import { useCallback, useLayoutEffect, useRef } from 'react'

/** Stable event identity, reading only the latest committed React inputs. */
export function useCommittedCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
): (...args: Args) => Result {
  const current = useRef(callback)

  useLayoutEffect(() => {
    current.current = callback
  }, [callback])

  return useCallback((...args: Args) => current.current(...args), [])
}
