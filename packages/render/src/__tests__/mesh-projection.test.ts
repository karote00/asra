import { describe, expect, it } from 'vitest'
import { Container, Mesh, Sprite } from 'pixi.js'
import {
  buildProjectionMeshData,
  createMeshProjection
} from '../projections/mesh-projection'

describe('mesh projection', () => {
  it('triangulates polygon geometry into indexed mesh data', () => {
    const meshData = buildProjectionMeshData({
      polygons: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 }
        ],
        [
          { x: 12, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 8 },
          { x: 12, y: 8 }
        ]
      ]
    })

    expect(meshData).not.toBeNull()
    expect(meshData?.vertices.length).toBe(16)
    expect(meshData?.indices.length).toBe(12)
    expect(meshData?.uvs.length).toBe(meshData?.vertices.length)
    expect(meshData?.bounds).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 10
    })
  })

  it('renders solid geometry through a pixi mesh projection', () => {
    const host = new Container()
    const projection = createMeshProjection({
      model: {
        polygons: [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 }
          ],
          [
            { x: 12, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 8 },
            { x: 12, y: 8 }
          ]
        ]
      },
      paint: {
        kind: 'solid',
        color: 0x00ff00,
        alpha: 0.5
      }
    })

    expect(projection.attach(host)).toBe(true)
    expect(host.children).toHaveLength(1)
    expect(host.children[0]).toBeInstanceOf(Container)

    const root = host.children[0] as Container
    expect(root.children).toHaveLength(2)
    expect(root.children[0]).toBeInstanceOf(Sprite)
    expect(root.children[1]).toBeInstanceOf(Mesh)

    const paintSprite = root.children[0] as Sprite
    const mesh = root.children[1] as Mesh
    expect(paintSprite.tint).toBe(0x00ff00)
    expect(paintSprite.alpha).toBe(0.5)
    expect(paintSprite.mask).toBe(mesh)
    expect(mesh.geometry.getBuffer('aPosition').data.length).toBe(16)
    expect(mesh.geometry.getIndex().data.length).toBe(12)

    projection.update({
      model: {
        polygons: [
          [
            { x: 20, y: 20 },
            { x: 30, y: 20 },
            { x: 30, y: 30 },
            { x: 20, y: 30 }
          ]
        ]
      },
      paint: {
        kind: 'solid',
        color: 0xff0000,
        alpha: 1
      }
    })

    expect(paintSprite.tint).toBe(0xff0000)
    expect(paintSprite.alpha).toBe(1)
    expect(mesh.geometry.getBuffer('aPosition').data.length).toBe(8)
    expect(mesh.geometry.getIndex().data.length).toBe(6)

    projection.dispose()
    expect(host.children).toHaveLength(0)
  })
})
