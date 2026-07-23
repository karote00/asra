import { Icon } from '@asyra/design-system'
import { useVectorIconPathMap } from '../providers'

interface VectorShapeIconProps {
  elementId: string
}

export const VectorShapeIcon = ({ elementId }: VectorShapeIconProps) => {
  const path = useVectorIconPathMap(elementId)
  if (path === undefined || path === null) {
    return <Icon showCursor={false} name="Pen" />
  }

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
