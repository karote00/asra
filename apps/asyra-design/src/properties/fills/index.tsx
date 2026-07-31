import { MIXED_STRING, createDefaultFill } from '@asyra/utils'
import { useFills } from '../../providers'
import { useProperty } from '../../hooks'
import { updateSelectedElementProperties } from '../../controllers/scene-tree'
import FillList from './list'

const Fills = () => {
  const fillsValue = useFills()
  const selection = useProperty<Set<string>>('elementSelection')
  const ownerElementId = selection.size === 1 ? Array.from(selection)[0] : null
  const mixed = fillsValue === MIXED_STRING
  const fills = mixed ? [] : fillsValue

  const writeFills = (
    nextFills: (string | ReturnType<typeof createDefaultFill>)[]
  ) => {
    updateSelectedElementProperties('fills', nextFills)
  }

  const handleAddFill = () => {
    const nextFills = [...fills.map((fill) => fill.ids[0]), createDefaultFill()]
    writeFills(nextFills)
  }

  const handleRemoveFill = (index: number) => {
    if (index < 0 || index >= fills.length) {
      return
    }

    const nextFills = fills
      .filter((_, currentIndex) => currentIndex !== index)
      .map((fill) => fill.ids[0])

    writeFills(nextFills)
  }

  return (
    <FillList
      fills={fills}
      ownerElementId={ownerElementId}
      mixed={mixed}
      onAdd={handleAddFill}
      onRemoveFill={handleRemoveFill}
    />
  )
}

export default Fills
