import { useProperty } from '../../hooks'

export const useZoom = (): number => useProperty<number>('zoom')
