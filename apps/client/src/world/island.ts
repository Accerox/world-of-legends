import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import type { GroundMesh } from '@babylonjs/core/Meshes/groundMesh'
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
 * Create the island terrain mesh with procedural heightmap.
 */
export function createIsland(scene: Scene): Mesh {
  // Create a flat ground mesh
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
  const positions = ground.getVerticesData('position')
  if (positions) {
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const z = positions[i + 2]
      positions[i + 1] = getHeightAtPosition(x, z)
    }

    ground.updateVerticesData('position', positions)
    ground.createNormals(false) // Recalculate normals
  }

  // Create terrain material with procedural texture
  const material = new StandardMaterial('islandMat', scene)
  const terrainTexture = createTerrainTexture(scene)
  material.diffuseTexture = terrainTexture
  material.specularColor = new Color3(0.1, 0.1, 0.1)
  ground.material = material

  ground.receiveShadows = true

  return ground as unknown as Mesh
}

/**
 * Create a procedural terrain texture (green grass with brown patches).
 */
function createTerrainTexture(scene: Scene): DynamicTexture {
  const size = 512
  const texture = new DynamicTexture('terrainTex', size, scene, true)
  const ctx = texture.getContext()

  // Base green
  ctx.fillStyle = '#3a7d44'
  ctx.fillRect(0, 0, size, size)

  // Add noise patches
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 4 + 1

    // Mix of greens and browns
    const colors = ['#4a8d54', '#2d6b35', '#5a9d64', '#6b5b3a', '#4a7d44', '#3a6d34']
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)]
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  texture.update()
  return texture
}
