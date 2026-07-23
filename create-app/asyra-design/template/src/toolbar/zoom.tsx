import { useZoom } from '../providers'

const Zoom = () => {
  const zoom = useZoom()

  return (
    <div className="zoom-display" data-testid="zoom-level" data-value={zoom}>
      {(zoom * 100).toFixed(0)}%
    </div>
  )
}

export default Zoom
