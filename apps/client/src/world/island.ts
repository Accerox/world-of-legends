import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

const ISLAND_SIZE = 200
const SUBDIVISIONS = 100

/**
 * Generate a heightmap value for a given (x, z) position.
 * Creates a circular island shape: high in center, tapering to water level at edges.
 */
export function getHeightAtPosition(x: number, z: number): number {
  const halfSize = ISLAND_SIZE / 2
  const nx = x / halfSize // Normalize to -1..1
  const nz = z / halfSize

  // Distance from center (0..1+)
  const dist = Math.sqrt(nx * nx + nz * nz)

  // Island falloff — smooth circular shape
  const falloff = Math.max(0, 1 - dist * 1.3)
  const islandShape = falloff * falloff * falloff // Cubic falloff for smooth edges

  // Multi-octave noise for terrain variation
  const noise1 = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.5
  const noise2 = Math.sin(x * 0.12 + 1.7) * Math.cos(z * 0.1 + 2.3) * 0.25
  const noise3 = Math.sin(x * 0.25 + 4.1) * Math.cos(z * 0.22 + 3.7) * 0.12

  // Combine: base height + noise, shaped by island falloff
  const baseHeight = 8 * islandShape
  const noiseHeight = (noise1 + noise2 + noise3) * islandShape * 6

  // Central peak
  const peak = Math.max(0, 1 - dist * 3) * 12

  return Math.max(-0.5, baseHeight + noiseHeight + peak)
}

/**
 * Linearly interpolate between two values.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Create the island terrain mesh with procedural heightmap and vertex coloring.
 */
export function createIsland(scene: Scene): Mesh {
  // Create a flat ground mesh with enough subdivisions for smooth vertex coloring
  const ground = MeshBuilder.CreateGround(
    'island',
    {
      width: ISLAND_SIZE,
      height: ISLAND_SIZE,
      subdivisions: SUBDIVISIONS,
      updatable: true,
    },
    scene,
  )

  // Apply heightmap by modifying vertex positions
  const positions = ground.getVerticesData(VertexBuffer.PositionKind)
  if (!positions) {
    throw new Error('Failed to get ground vertex positions')
  }

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const z = positions[i + 2]
    positions[i + 1] = getHeightAtPosition(x, z)
  }

  ground.updateVerticesData(VertexBuffer.PositionKind, positions)
  ground.createNormals(false) // Recalculate normals

  // ─── Procedural vertex coloring based on height ───────────────────────────
  const colors: number[] = []

  // Color palette
  const sandColor = { r: 0.76, g: 0.70, b: 0.50 }
  const grassColor = { r: 0.22, g: 0.58, b: 0.18 }
  const darkGrassColor = { r: 0.15, g: 0.42, b: 0.12 }
  const rockyColor = { r: 0.50, g: 0.45, b: 0.38 }
  const peakColor = { r: 0.60, g: 0.58, b: 0.55 }

  // Height thresholds
  const SAND_MAX = 0.5
  const GRASS_START = 0.5
  const GRASS_END = 3.0
  const DARK_GRASS_END = 6.0
  const ROCKY_END = 10.0

  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1] // height
    const x = positions[i]
    const z = positions[i + 2]

    // Add subtle noise to color transitions for natural look
    const colorNoise = (Math.sin(x * 0.3 + z * 0.2) * 0.5 + 0.5) * 0.08

    let r: number, g: number, b: number

    if (y < SAND_MAX) {
      // Sand near water level
      r = sandColor.r + colorNoise
      g = sandColor.g + colorNoise * 0.5
      b = sandColor.b - colorNoise
    } else if (y < GRASS_END) {
      // Blend from sand to grass
      const t = Math.min(1, (y - GRASS_START) / (GRASS_END - GRASS_START))
      r = lerp(sandColor.r, grassColor.r, t) + colorNoise * 0.5
      g = lerp(sandColor.g, grassColor.g, t) + colorNoise * 0.3
      b = lerp(sandColor.b, grassColor.b, t)
    } else if (y < DARK_GRASS_END) {
      // Blend from grass to dark grass
      const t = (y - GRASS_END) / (DARK_GRASS_END - GRASS_END)
      r = lerp(grassColor.r, darkGrassColor.r, t) + colorNoise * 0.3
      g = lerp(grassColor.g, darkGrassColor.g, t) + colorNoise * 0.2
      b = lerp(grassColor.b, darkGrassColor.b, t)
    } else if (y < ROCKY_END) {
      // Blend from dark grass to rocky
      const t = (y - DARK_GRASS_END) / (ROCKY_END - DARK_GRASS_END)
      r = lerp(darkGrassColor.r, rockyColor.r, t) + colorNoise * 0.2
      g = lerp(darkGrassColor.g, rockyColor.g, t) + colorNoise * 0.1
      b = lerp(darkGrassColor.b, rockyColor.b, t)
    } else {
      // Peak — rocky/gray
      const t = Math.min(1, (y - ROCKY_END) / 5)
      r = lerp(rockyColor.r, peakColor.r, t) + colorNoise * 0.1
      g = lerp(rockyColor.g, peakColor.g, t) + colorNoise * 0.1
      b = lerp(rockyColor.b, peakColor.b, t)
    }

    // Clamp to valid range
    colors.push(
      Math.max(0, Math.min(1, r)),
      Math.max(0, Math.min(1, g)),
      Math.max(0, Math.min(1, b)),
      1, // alpha
    )
  }

  ground.setVerticesData(VertexBuffer.ColorKind, colors)

  // Create terrain material — grass texture tiled across the surface,
  // modulated by vertex colors for height-based tinting (sand/grass/rock).
  const material = new StandardMaterial('islandMat', scene)

  const grassTex = new Texture('/textures/grass.png', scene)
  grassTex.uScale = 20
  grassTex.vScale = 20
  material.diffuseTexture = grassTex

  // White diffuse lets vertex colors modulate the texture naturally
  material.diffuseColor = new Color3(1, 1, 1)
  material.specularColor = new Color3(0.1, 0.1, 0.1)

  ground.material = material
  ground.receiveShadows = true

  return ground as unknown as Mesh
}
