interface Vec2 {
  x: number
  y: number
}

export interface DashedCenterStrokeFrame extends Vec2 {
  widthLeft: number
  widthRight: number
}

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

const interpolateFrame = (
  start: DashedCenterStrokeFrame,
  end: DashedCenterStrokeFrame,
  t: number
): DashedCenterStrokeFrame => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t,
  widthLeft: start.widthLeft + (end.widthLeft - start.widthLeft) * t,
  widthRight: start.widthRight + (end.widthRight - start.widthRight) * t
})

const dedupeFrames = (frames: DashedCenterStrokeFrame[]) =>
  frames.filter((frame, index) => {
    if (index === 0) {
      return true
    }

    const previous = frames[index - 1]
    return (
      Math.abs(previous.x - frame.x) > 1e-6 ||
      Math.abs(previous.y - frame.y) > 1e-6 ||
      Math.abs(previous.widthLeft - frame.widthLeft) > 1e-6 ||
      Math.abs(previous.widthRight - frame.widthRight) > 1e-6
    )
  })

const getTotalLength = (frames: DashedCenterStrokeFrame[], closed: boolean) => {
  if (frames.length < 2) {
    return 0
  }

  let length = 0
  for (let index = 1; index < frames.length; index += 1) {
    length += distanceBetween(frames[index - 1], frames[index])
  }

  if (closed) {
    length += distanceBetween(frames[frames.length - 1], frames[0])
  }

  return length
}

const sliceFrameRange = (
  frames: DashedCenterStrokeFrame[],
  closed: boolean,
  startDistance: number,
  endDistance: number
) => {
  if (frames.length < 2 || endDistance <= startDistance) {
    return []
  }

  const segments = frames.slice(1).map((frame, index) => ({
    start: frames[index],
    end: frame
  }))

  if (closed) {
    segments.push({
      start: frames[frames.length - 1],
      end: frames[0]
    })
  }

  let cursor = 0
  const sliced: DashedCenterStrokeFrame[] = []

  segments.forEach((segment) => {
    const segmentLength = distanceBetween(segment.start, segment.end)
    const segmentStart = cursor
    const segmentEnd = cursor + segmentLength
    cursor = segmentEnd

    if (segmentLength <= 0 || segmentEnd <= startDistance || segmentStart >= endDistance) {
      return
    }

    const overlapStart = Math.max(startDistance, segmentStart)
    const overlapEnd = Math.min(endDistance, segmentEnd)
    const startT = (overlapStart - segmentStart) / segmentLength
    const endT = (overlapEnd - segmentStart) / segmentLength
    const startFrame = interpolateFrame(segment.start, segment.end, startT)
    const endFrame = interpolateFrame(segment.start, segment.end, endT)

    if (sliced.length === 0) {
      sliced.push(startFrame)
    } else {
      const previous = sliced[sliced.length - 1]
      if (
        Math.abs(previous.x - startFrame.x) > 1e-6 ||
        Math.abs(previous.y - startFrame.y) > 1e-6 ||
        Math.abs(previous.widthLeft - startFrame.widthLeft) > 1e-6 ||
        Math.abs(previous.widthRight - startFrame.widthRight) > 1e-6
      ) {
        sliced.push(startFrame)
      }
    }

    sliced.push(endFrame)
  })

  return dedupeFrames(sliced)
}

export const sliceDashedCenterStrokeFrames = (
  frames: DashedCenterStrokeFrame[],
  closed: boolean,
  startDistance: number,
  endDistance: number,
  wrapsSeam: boolean
) => {
  if (!wrapsSeam) {
    return sliceFrameRange(frames, closed, startDistance, endDistance)
  }

  const totalLength = getTotalLength(frames, closed)
  const tail = sliceFrameRange(frames, closed, startDistance, totalLength)
  const head = sliceFrameRange(frames, closed, 0, endDistance)
  return dedupeFrames([...tail, ...head])
}
