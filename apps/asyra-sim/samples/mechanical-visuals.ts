import { MechanicalMesh } from './mechanical-mesh'

const paint = 0xe3e7ea,
  dark = 0x19232e,
  steel = 0x9da9b4,
  accent = 0x287c9e

/** Original industrial main-body study, not an ABB or other manufacturer's CAD. */
export function createMechanicalVisuals(): {
  body: string
  bytes: Uint8Array
}[] {
  const sources: { body: string; bytes: Uint8Array }[] = []
  const part = (body: string, build: (mesh: MechanicalMesh) => void) => {
    const mesh = new MechanicalMesh()
    build(mesh)
    sources.push({ body, bytes: mesh.toGlb(body) })
  }
  const hub = (m: MechanicalMesh, y: number, radius: number, depth: number) => {
    m.cylinder(paint, [0, y, 0], radius, depth, 'z')
    for (const side of [-1, 1]) {
      m.cylinder(
        dark,
        [0, y, side * (depth / 2 + 0.002)],
        radius * 0.86,
        0.004,
        'z'
      )
      m.cylinder(
        accent,
        [0, y, side * (depth / 2 + 0.009)],
        radius * 0.78,
        0.01,
        'z'
      )
      if (side === 1)
        m.bolts([0, y, depth / 2 + 0.016], radius * 0.61, 6, 'z', 0.006)
    }
  }
  part('base', (m) => {
    m.block(dark, [0, -0.095, 0], [0.45, 0.05, 0.45], 0.015)
    m.lathe(
      paint,
      [0, 0, 0],
      [
        [0, -0.07],
        [0.17, -0.07],
        [0.18, -0.06],
        [0.175, -0.02],
        [0.15, 0.07],
        [0.15, 0.103],
        [0, 0.103]
      ]
    )
    m.cylinder(steel, [0, 0.11, 0], 0.149, 0.014)
    m.bolts([0, -0.066, 0], 0.195, 4, 'y', 0.014)
    m.block(accent, [0, -0.014, 0.163], [0.09, 0.055, 0.01], 0.002)
  })
  part('joint-1', (m) => {
    m.cylinder(dark, [0, 0.008, 0], 0.143, 0.012)
    m.lathe(
      paint,
      [0, 0, 0],
      [
        [0, 0.014],
        [0.143, 0.014],
        [0.15, 0.025],
        [0.15, 0.11],
        [0.13, 0.16],
        [0.085, 0.37],
        [0, 0.37]
      ]
    )
    for (const side of [-1, 1]) {
      m.shell(
        paint,
        [0, 0, side * 0.126],
        [
          [0.2, 0.2, 0.06],
          [0.4, 0.2, 0.055],
          [0.5, 0.19, 0.05]
        ],
        0.018
      )
      m.cylinder(paint, [0, 0.5, side * 0.126], 0.1, 0.05, 'z')
      m.cylinder(steel, [0, 0.5, side * 0.158], 0.065, 0.012, 'z')
    }
    m.bolts([0, 0.5, 0.168], 0.048, 6, 'z', 0.006)
    m.block(dark, [0, 0.19, -0.131], [0.105, 0.12, 0.016], 0.008)
  })
  part('joint-2', (m) => {
    hub(m, 0, 0.095, 0.187)
    m.shell(
      paint,
      [0, 0, 0],
      [
        [0.055, 0.16, 0.145],
        [0.13, 0.18, 0.145],
        [0.48, 0.135, 0.115],
        [0.6, 0.14, 0.12]
      ],
      0.024
    )
    m.block(accent, [0, 0.31, 0.075], [0.091, 0.27, 0.009], 0.012)
    m.block(dark, [0, 0.29, -0.077], [0.093, 0.26, 0.01], 0.01)
    for (const side of [-1, 1]) {
      m.cylinder(paint, [0, 0.65, side * 0.103], 0.087, 0.044, 'z')
      m.cylinder(steel, [0, 0.65, side * 0.131], 0.06, 0.012, 'z')
    }
    m.bolts([0, 0.65, 0.14], 0.045, 6, 'z', 0.006)
  })
  part('joint-3', (m) => {
    hub(m, 0, 0.078, 0.155)
    m.shell(
      paint,
      [0, 0, 0],
      [
        [0.035, 0.13, 0.125],
        [0.12, 0.14, 0.12],
        [0.39, 0.105, 0.095],
        [0.465, 0.104, 0.104]
      ],
      0.022
    )
    m.block(accent, [0, 0.25, 0.064], [0.065, 0.25, 0.01], 0.008)
    m.cylinder(dark, [0, 0.48, 0], 0.06, 0.022)
    m.cylinder(steel, [0, 0.496, 0], 0.057, 0.01)
  })
  part('joint-4', (m) => {
    m.lathe(
      paint,
      [0, 0, 0],
      [
        [0, 0.002],
        [0.055, 0.002],
        [0.06, 0.013],
        [0.06, 0.09],
        [0.05, 0.12],
        [0, 0.12]
      ]
    )
    for (const side of [-1, 1]) {
      m.shell(
        paint,
        [0, 0, side * 0.047],
        [
          [0.08, 0.09, 0.025],
          [0.18, 0.088, 0.023]
        ],
        0.007
      )
      m.cylinder(paint, [0, 0.18, side * 0.047], 0.044, 0.023, 'z')
    }
    m.bolts([0, 0.18, 0.061], 0.029, 4, 'z', 0.004)
  })
  part('joint-5', (m) => {
    hub(m, 0, 0.04, 0.067)
    m.lathe(
      paint,
      [0, 0, 0],
      [
        [0, 0.026],
        [0.035, 0.026],
        [0.046, 0.05],
        [0.046, 0.12],
        [0.038, 0.14],
        [0, 0.14]
      ]
    )
    m.cylinder(dark, [0, 0.132, 0], 0.041, 0.008)
  })
  part('joint-6', (m) => {
    m.cylinder(steel, [0, 0.013, 0], 0.037, 0.024)
    m.cylinder(dark, [0, 0.039, 0], 0.04, 0.028)
    m.cylinder(steel, [0, 0.072, 0], 0.053, 0.036)
    m.cylinder(dark, [0, 0.094, 0], 0.027, 0.008)
    m.bolts([0, 0.091, 0], 0.041, 6, 'y', 0.005)
  })
  part('gripper', (m) => {
    m.block(dark, [0, 0.027, 0], [0.18, 0.054, 0.1], 0.007)
    m.block(steel, [0, 0.057, 0], [0.164, 0.008, 0.078], 0.002)
    m.block(accent, [0, 0.027, 0.052], [0.09, 0.029, 0.006], 0.002)
    for (const side of [-1, 1]) {
      m.block(steel, [side * 0.072, 0.092, 0], [0.027, 0.065, 0.07], 0.003)
      m.block(dark, [side * 0.072, 0.15, 0], [0.027, 0.055, 0.07], 0.003)
      for (const y of [0.078, 0.106])
        m.cylinder(dark, [side * 0.072, y, 0.036], 0.005, 0.003, 'z', 6)
      for (let i = 0; i < 5; i++)
        m.block(
          steel,
          [side * 0.059, 0.13 + i * 0.009, 0],
          [0.001, 0.002, 0.061],
          0.0003
        )
    }
  })
  part('workpiece', (m) => {
    m.block(accent, [0, 0, 0], [0.11, 0.075, 0.08], 0.008)
    m.cylinder(dark, [0, 0.0376, 0], 0.017, 0.001)
    m.cylinder(steel, [0, 0.0382, 0], 0.012, 0.001)
  })
  part('fixture-table', (m) => {
    m.block(steel, [0, 0, 0], [0.75, 0.12, 0.6], 0.01)
    for (let i = -3; i <= 3; i++)
      m.block(dark, [i * 0.095, 0.0605, 0], [0.012, 0.001, 0.55], 0.0002)
    for (const x of [-0.27, 0.27])
      for (const z of [-0.21, 0.21]) {
        m.block(dark, [x, -0.31, z], [0.06, 0.5, 0.06], 0.004)
        m.block(steel, [x, -0.54, z], [0.105, 0.02, 0.105], 0.004)
      }
  })
  part('fixture-post', (m) => {
    m.block(steel, [0, 0, 0], [0.14, 1.3, 0.14], 0.005)
    for (const x of [-0.041, 0.041])
      m.block(dark, [x, 0, 0.0705], [0.009, 1.26, 0.001], 0.0002)
    m.block(dark, [0, -0.638, 0], [0.22, 0.024, 0.22], 0.008)
    m.block(accent, [0, 0.57, 0.073], [0.08, 0.075, 0.008], 0.002)
  })
  return sources
}
