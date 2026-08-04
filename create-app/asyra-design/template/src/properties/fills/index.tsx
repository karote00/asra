import { MIXED_STRING } from '@asyra/utils'
import { useFills } from '../../providers'
import { useProperty } from '../../hooks'
import { fillApis } from '../../common-apis'
import FillList from './list'

const Fills = () => {
  const fillsValue = useFills()
  const selection = useProperty<Set<string>>('elementSelection')
  const ownerElementId = selection.size === 1 ? Array.from(selection)[0] : null
  const mixed = fillsValue === MIXED_STRING
  const fills = mixed ? [] : fillsValue

  const handleAddFill = () => {
    if (ownerElementId) {
      fillApis.addFill(ownerElementId)
    }
  }

  const handleRemoveFill = (index: number) => {
    if (index < 0 || index >= fills.length) {
      return
    }

    const fillId = fills[index]?.ids[0]
    if (ownerElementId && fillId) {
      fillApis.removeFill(ownerElementId, fillId)
    }
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
