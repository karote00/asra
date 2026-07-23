import { Icon, type IconName } from '@asyra/design-system'
import { EntityTypes } from '@asyra/utils'
import { VectorShapeIcon } from './VectorShapeIcon'

const ELEMENT_ICON_MAP: Record<string, IconName> = {
  [EntityTypes.GROUP]: 'Group',
  [EntityTypes.FRAME]: 'Group',
  [EntityTypes.WORKSPACE]: 'Group',
  rect: 'Rect',
  oval: 'Oval',
  vector: 'Pen'
}

const getElementIconName = (type: string): IconName => {
  return ELEMENT_ICON_MAP[type] ?? 'Rect'
}

interface ElementIconProps {
  elementId: string
  type: string
}

export const ElementIcon = ({ elementId, type }: ElementIconProps) => {
  if (type === 'vector') {
    return <VectorShapeIcon elementId={elementId} />
  }

  return <Icon showCursor={false} name={getElementIconName(type)} />
}
