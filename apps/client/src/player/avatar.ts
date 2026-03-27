import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'

// Predefined avatar colors for different players
const AVATAR_COLORS: Color3[] = [
  new Color3(0.2, 0.6, 1.0),   // Blue
  new Color3(1.0, 0.3, 0.3),   // Red
  new Color3(0.3, 0.9, 0.3),   // Green
  new Color3(1.0, 0.8, 0.2),   // Yellow
  new Color3(0.8, 0.3, 0.9),   // Purple
  new Color3(1.0, 0.5, 0.2),   // Orange
  new Color3(0.3, 0.9, 0.9),   // Cyan
  new Color3(0.9, 0.4, 0.6),   // Pink
]

/**
 * Create a player avatar mesh (capsule shape: cylinder body + hemisphere top/bottom).
 */
export function createAvatar(
  scene: Scene,
  playerId: string,
  isLocal: boolean = false,
): Mesh {
  // Body (cylinder)
  const body = MeshBuilder.CreateCylinder(
    `avatar_body_${playerId}`,
    { height: 1.4, diameter: 0.6, tessellation: 12 },
    scene,
  )

  // Head (sphere on top)
  const head = MeshBuilder.CreateSphere(
    `avatar_head_${playerId}`,
    { diameter: 0.5, segments: 8 },
    scene,
  )
  head.position.y = 1.0

  // Merge into single mesh
  const avatar = Mesh.MergeMeshes([body, head], true, true, undefined, false, true)!
  avatar.name = `avatar_${playerId}`

  // Pick color based on player ID hash
  const colorIndex = hashString(playerId) % AVATAR_COLORS.length
  const color = isLocal
    ? new Color3(0.2, 0.6, 1.0) // Local player is always blue
    : AVATAR_COLORS[colorIndex]

  const material = new StandardMaterial(`avatarMat_${playerId}`, scene)
  material.diffuseColor = color
  material.specularColor = new Color3(0.3, 0.3, 0.3)
  avatar.material = material

  // Slight glow for local player
  if (isLocal) {
    material.emissiveColor = new Color3(0.05, 0.15, 0.3)
  }

  return avatar
}

/**
 * Simple string hash for deterministic color assignment.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash)
}
