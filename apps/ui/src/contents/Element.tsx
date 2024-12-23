import { useSignals } from '@preact/signals-react/runtime'
import { getElement } from '../states/scene-tree'

const Element = ({ elementId }: { elementId: string }) => {
  useSignals()
  const element = getElement(elementId)
  if (!element) return null

  return <div>{element.value.name}</div>
}

export default Element
