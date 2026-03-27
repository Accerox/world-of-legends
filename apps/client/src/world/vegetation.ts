import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Matrix } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { getHeightAtPosition } from './island.js'

const TREE_COUNT = 80
const ROCK_COUNT = 40
const MIN_HEIGHT = 0.5 // Don't place vegetation below this height (water line)

/**
 * Create trees and rocks scattered across the island using thin instances.
 */
export function createVegetation(scene: Scene): void {
  createTrees(scene)
  createRocks(scene)
}

/**
 * Create instanced trees (cylinder trunk + cone canopy).
 */
function createTrees(scene: Scene): void {
  // ─── Trunk template ─────────────────────────────────────────────────────────
  const trunk = MeshBuilder.CreateCylinder(
    'treeTrunk',
    { height: 3, diameter: 0.4, tessellation: 8 },
    scene,
  )
  const trunkMat = new StandardMaterial('trunkMat', scene)
  trunkMat.diffuseColor = new Color3(0.45, 0.3, 0.15)
  trunk.material = trunkMat
  trunk.isVisible = false // Template is invisible; instances are visible

  // ─── Canopy template ────────────────────────────────────────────────────────
  const canopy = MeshBuilder.CreateSphere(
    'treeCanopy',
    { diameter: 4, segments: 6 },
    scene,
  )
  const canopyMat = new StandardMaterial('canopyMat', scene)
  canopyMat.diffuseColor = new Color3(0.2, 0.55, 0.2)
  canopy.material = canopyMat
  canopy.isVisible = false

  // ─── Place instances ────────────────────────────────────────────────────────
  const rng = seedRandom(42) // Deterministic placement

  for (let i = 0; i < TREE_COUNT; i++) {
    const x = (rng() - 0.5) * 160 // Stay within island bounds
    const z = (rng() - 0.5) * 160
    const height = getHeightAtPosition(x, z)

    if (height < MIN_HEIGHT) continue // Skip water areas

    const scale = 0.7 + rng() * 0.8 // Random size variation
    const rotY = rng() * Math.PI * 2

    // Trunk instance
    const trunkMatrix = Matrix.Compose(
      new Vector3(scale, scale, scale),
      Vector3.Zero().toQuaternion(),
      new Vector3(x, height + 1.5 * scale, z),
    )
    trunk.thinInstanceAdd(trunkMatrix)

    // Canopy instance (on top of trunk)
    const canopyMatrix = Matrix.Compose(
      new Vector3(scale, scale * (0.8 + rng() * 0.4), scale),
      Vector3.Zero().toQuaternion(),
      new Vector3(x, height + 3.5 * scale, z),
    )
    canopy.thinInstanceAdd(canopyMatrix)
  }

  // Make templates visible after adding instances
  trunk.isVisible = true
  canopy.isVisible = true
}

/**
 * Create instanced rocks (scaled spheres).
 */
function createRocks(scene: Scene): void {
  const rock = MeshBuilder.CreateSphere(
    'rock',
    { diameter: 1, segments: 4 },
    scene,
  )
  const rockMat = new StandardMaterial('rockMat', scene)
  rockMat.diffuseColor = new Color3(0.5, 0.48, 0.45)
  rockMat.specularColor = new Color3(0.1, 0.1, 0.1)
  rock.material = rockMat
  rock.isVisible = false

  const rng = seedRandom(123)

  for (let i = 0; i < ROCK_COUNT; i++) {
    const x = (rng() - 0.5) * 170
    const z = (rng() - 0.5) * 170
    const height = getHeightAtPosition(x, z)

    if (height < MIN_HEIGHT * 0.5) continue

    const scaleX = 0.5 + rng() * 1.5
    const scaleY = 0.3 + rng() * 0.8
    const scaleZ = 0.5 + rng() * 1.5

    const matrix = Matrix.Compose(
      new Vector3(scaleX, scaleY, scaleZ),
      Vector3.Zero().toQuaternion(),
      new Vector3(x, height + scaleY * 0.3, z),
    )
    rock.thinInstanceAdd(matrix)
  }

  rock.isVisible = true
}

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Ensures vegetation placement is deterministic across sessions.
 */
function seedRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
