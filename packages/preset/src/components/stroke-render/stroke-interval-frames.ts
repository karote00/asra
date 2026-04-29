interface Vec2 {
  x: number
  y: number
}

export interface StrokeIntervalFrame extends Vec2 {
  widthLeft: number
  widthRight: number
}

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

const interpolatePoint = (start: Vec2, end: Vec2, t: number): Vec2 => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t
})

const interpolateFrame = (
  start: StrokeIntervalFrame,
  end: StrokeIntervalFrame,
  t: number
): StrokeIntervalFrame => ({
  x: start.x + (end.x - start.x) * t,
  y: start.y + (end.y - start.y) * t,
  widthLeft: start.widthLeft + (end.widthLeft - start.widthLeft) * t,
  widthRight: start.widthRight + (end.widthRight - start.widthRight) * t
})

const dedupeFrames = (frames: StrokeIntervalFrame[]) =>
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

const dedupePoints = (points: Vec2[]) =>
  points.filter((point, index) => {
    if (index === 0) {
      return true
    }

    const previous = points[index - 1]
    return (
      Math.abs(previous.x - point.x) > 1e-6 ||
      Math.abs(previous.y - point.y) > 1e-6
    )
  })

const getTotalLength = (frames: StrokeIntervalFrame[], closed: boolean) => {
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

const getPointTotalLength = (points: Vec2[], closed: boolean) => {
  if (points.length < 2) {
    return 0
  }

  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += distanceBetween(points[index - 1], points[index])
  }

  if (closed) {
    length += distanceBetween(points[points.length - 1], points[0])
  }

  return length
}

const sliceFrameRange = (
  frames: StrokeIntervalFrame[],
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
  const sliced: StrokeIntervalFrame[] = []

  segments.forEach((segment) => {
    const segmentLength = distanceBetween(segment.start, segment.end)
    const segmentStart = cursor
    const segmentEnd = cursor + segmentLength
    cursor = segmentEnd

    if (
      segmentLength <= 0 ||
      segmentEnd <= startDistance ||
      segmentStart >= endDistance
    ) {
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

const slicePointRange = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number
) => {
  if (points.length < 2 || endDistance <= startDistance) {
    return []
  }

  const sliced: Vec2[] = []
  let cursor = 0
  const segmentCount = closed ? points.length : points.length - 1

  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    const segmentLength = distanceBetween(start, end)
    const segmentStart = cursor
    const segmentEnd = cursor + segmentLength
    cursor = segmentEnd

    if (
      segmentLength <= 0 ||
      segmentEnd <= startDistance ||
      segmentStart >= endDistance
    ) {
      continue
    }

    const overlapStart = Math.max(startDistance, segmentStart)
    const overlapEnd = Math.min(endDistance, segmentEnd)
    const startPoint = interpolatePoint(
      start,
      end,
      (overlapStart - segmentStart) / segmentLength
    )
    const endPoint = interpolatePoint(
      start,
      end,
      (overlapEnd - segmentStart) / segmentLength
    )

    const previous = sliced[sliced.length - 1]
    if (
      !previous ||
      Math.abs(previous.x - startPoint.x) > 1e-6 ||
      Math.abs(previous.y - startPoint.y) > 1e-6
    ) {
      sliced.push(startPoint)
    }

    sliced.push(endPoint)
  }

  return dedupePoints(sliced)
}

interface StrokeIntervalPointSegment {
  start: Vec2
  end: Vec2
  startDistance: number
  endDistance: number
  length: number
}

export interface StrokeIntervalPointSlicer {
  totalLength: number
  slice: (
    startDistance: number,
    endDistance: number,
    wrapsSeam: boolean
  ) => Vec2[]
}

interface StrokeIntervalFrameSegment {
  start: StrokeIntervalFrame
  end: StrokeIntervalFrame
  startDistance: number
  endDistance: number
  length: number
}

export interface StrokeIntervalFrameSlicer {
  totalLength: number
  slice: (
    startDistance: number,
    endDistance: number,
    wrapsSeam: boolean
  ) => StrokeIntervalFrame[]
}

export const createStrokeIntervalFrameSlicer = (
  frames: StrokeIntervalFrame[],
  closed: boolean
): StrokeIntervalFrameSlicer => {
  const segments: StrokeIntervalFrameSegment[] = []
  let cursor = 0
  const segmentCount =
    frames.length < 2 ? 0 : closed ? frames.length : frames.length - 1

  for (let index = 0; index < segmentCount; index += 1) {
    const start = frames[index]
    const end = frames[(index + 1) % frames.length]
    const length = distanceBetween(start, end)
    segments.push({
      start,
      end,
      startDistance: cursor,
      endDistance: cursor + length,
      length
    })
    cursor += length
  }

  const sliceRange = (startDistance: number, endDistance: number) => {
    if (segments.length === 0 || endDistance <= startDistance) {
      return []
    }

    const sliced: StrokeIntervalFrame[] = []

    for (const segment of segments) {
      if (
        segment.length <= 0 ||
        segment.endDistance <= startDistance ||
        segment.startDistance >= endDistance
      ) {
        continue
      }

      const overlapStart = Math.max(startDistance, segment.startDistance)
      const overlapEnd = Math.min(endDistance, segment.endDistance)
      const startFrame = interpolateFrame(
        segment.start,
        segment.end,
        (overlapStart - segment.startDistance) / segment.length
      )
      const endFrame = interpolateFrame(
        segment.start,
        segment.end,
        (overlapEnd - segment.startDistance) / segment.length
      )

      const previous = sliced[sliced.length - 1]
      if (
        !previous ||
        Math.abs(previous.x - startFrame.x) > 1e-6 ||
        Math.abs(previous.y - startFrame.y) > 1e-6 ||
        Math.abs(previous.widthLeft - startFrame.widthLeft) > 1e-6 ||
        Math.abs(previous.widthRight - startFrame.widthRight) > 1e-6
      ) {
        sliced.push(startFrame)
      }

      sliced.push(endFrame)
    }

    return dedupeFrames(sliced)
  }

  return {
    totalLength: cursor,
    slice: (startDistance, endDistance, wrapsSeam) => {
      if (!wrapsSeam) {
        return sliceRange(startDistance, endDistance)
      }

      const tail = sliceRange(startDistance, cursor)
      const head = sliceRange(0, endDistance)
      return dedupeFrames([...tail, ...head])
    }
  }
}

export const createStrokeIntervalPointSlicer = (
  points: Vec2[],
  closed: boolean
): StrokeIntervalPointSlicer => {
  const segments: StrokeIntervalPointSegment[] = []
  let cursor = 0
  const segmentCount =
    points.length < 2 ? 0 : closed ? points.length : points.length - 1

  for (let index = 0; index < segmentCount; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    const length = distanceBetween(start, end)
    segments.push({
      start,
      end,
      startDistance: cursor,
      endDistance: cursor + length,
      length
    })
    cursor += length
  }

  const sliceRange = (startDistance: number, endDistance: number) => {
    if (segments.length === 0 || endDistance <= startDistance) {
      return []
    }

    const sliced: Vec2[] = []

    for (const segment of segments) {
      if (
        segment.length <= 0 ||
        segment.endDistance <= startDistance ||
        segment.startDistance >= endDistance
      ) {
        continue
      }

      const overlapStart = Math.max(startDistance, segment.startDistance)
      const overlapEnd = Math.min(endDistance, segment.endDistance)
      const startPoint = interpolatePoint(
        segment.start,
        segment.end,
        (overlapStart - segment.startDistance) / segment.length
      )
      const endPoint = interpolatePoint(
        segment.start,
        segment.end,
        (overlapEnd - segment.startDistance) / segment.length
      )

      const previous = sliced[sliced.length - 1]
      if (
        !previous ||
        Math.abs(previous.x - startPoint.x) > 1e-6 ||
        Math.abs(previous.y - startPoint.y) > 1e-6
      ) {
        sliced.push(startPoint)
      }

      sliced.push(endPoint)
    }

    return dedupePoints(sliced)
  }

  return {
    totalLength: cursor,
    slice: (startDistance, endDistance, wrapsSeam) => {
      if (!wrapsSeam) {
        return sliceRange(startDistance, endDistance)
      }

      const tail = sliceRange(startDistance, cursor)
      const head = sliceRange(0, endDistance)
      return dedupePoints([...tail, ...head])
    }
  }
}

export const sliceStrokeIntervalFrames = (
  frames: StrokeIntervalFrame[],
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

export const sliceStrokeIntervalPoints = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number,
  wrapsSeam: boolean
) => {
  if (!wrapsSeam) {
    return slicePointRange(points, closed, startDistance, endDistance)
  }

  const totalLength = getPointTotalLength(points, closed)
  const tail = slicePointRange(points, closed, startDistance, totalLength)
  const head = slicePointRange(points, closed, 0, endDistance)
  return dedupePoints([...tail, ...head])
}
