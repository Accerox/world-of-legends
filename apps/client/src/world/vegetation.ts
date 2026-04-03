import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Matrix } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { getHeightAtPosition } from './island.js'

const TREE_COUNT = 130
const ROCK_COUNT = 60
const GRASS_PATCH_COUNT = 200
const MIN_HEIGHT = 0.5 // Don't place vegetation below this height (water line)

/**
 * Create trees, rocks, and grass scattered across the island using thin instances.
 */
export function createVegetation(scene: Scene): void {
  createTrees(scene)
  createRocks(scene)
  createGrassPatches(scene)
}

/**
 * Create instanced trees with size and color variation.
 * Three canopy color variants for natural look.
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

  // ─── Canopy templates with color variation ──────────────────────────────────
  const canopyColors = [
    new Color3(0.18, 0.52, 0.18), // Standard green
    new Color3(0.25, 0.60, 0.15), // Light green
    new Color3(0.12, 0.42, 0.22), // Dark green
    new Color3(0.20, 0.55, 0.10), // Yellow-green
    new Color3(0.15, 0.48, 0.25), // Blue-green
  ]

  const canopies: Mesh[] = []
  for (let c = 0; c < canopyColors.length; c++) {
    const canopy = MeshBuilder.CreateSphere(
      `treeCanopy${c}`,
      { diameter: 4, segments: 6 },
      scene,
    )
    const canopyMat = new StandardMaterial(`canopyMat${c}`, scene)
    canopyMat.diffuseColor = canopyColors[c]
    canopy.material = canopyMat
    canopy.isVisible = false
    canopies.push(canopy)
  }

  // ─── Place instances ────────────────────────────────────────────────────────
  const rng = seedRandom(42) // Deterministic placement

  for (let i = 0; i < TREE_COUNT; i++) {
    const x = (rng() - 0.5) * 160 // Stay within island bounds
    const z = (rng() - 0.5) * 160
    const height = getHeightAtPosition(x, z)

    if (height < MIN_HEIGHT) continue // Skip water areas
    if (height > 10) continue // Skip mountain peaks

    // Size categories: small (0.4-0.7), medium (0.7-1.1), large (1.1-1.6)
    const sizeRoll = rng()
    let scale: number
    if (sizeRoll < 0.3) {
      scale = 0.4 + rng() * 0.3 // Small
    } else if (sizeRoll < 0.75) {
      scale = 0.7 + rng() * 0.4 // Medium
    } else {
      scale = 1.1 + rng() * 0.5 // Large
    }

    const rotY = rng() * Math.PI * 2

    // Trunk instance
    const trunkMatrix = Matrix.Compose(
      new Vector3(scale, scale, scale),
      Vector3.Zero().toQuaternion(),
      new Vector3(x, height + 1.5 * scale, z),
    )
    trunk.thinInstanceAdd(trunkMatrix)

    // Pick a random canopy color variant
    const colorIdx = Math.floor(rng() * canopies.length)
    const canopy = canopies[colorIdx]

    // Canopy instance (on top of trunk) with slight shape variation
    const canopyScaleY = scale * (0.7 + rng() * 0.5)
    const canopyMatrix = Matrix.Compose(
      new Vector3(scale, canopyScaleY, scale),
      Vector3.Zero().toQuaternion(),
      new Vector3(x, height + 3.5 * scale, z),
    )
    canopy.thinInstanceAdd(canopyMatrix)
  }

  // Make templates visible after adding instances
  trunk.isVisible = true
  for (const canopy of canopies) {
    canopy.isVisible = true
  }
}

/**
 * Create instanced rocks — dark gray flattened spheres.
 */
function createRocks(scene: Scene): void {
  const rock = MeshBuilder.CreateSphere(
    'rock',
    { diameter: 1, segments: 4 },
    scene,
  )
  const rockMat = new StandardMaterial('rockMat', scene)
  rockMat.diffuseColor = new Color3(0.42, 0.40, 0.38)
  rockMat.specularColor = new Color3(0.08, 0.08, 0.08)
  rock.material = rockMat
  rock.isVisible = false

  const rng = seedRandom(123)

  for (let i = 0; i < ROCK_COUNT; i++) {
    const x = (rng() - 0.5) * 170
    const z = (rng() - 0.5) * 170
    const height = getHeightAtPosition(x, z)

    if (height < MIN_HEIGHT * 0.5) continue

    // Rocks are flattened — wider than tall
    const scaleX = 0.5 + rng() * 1.8
    const scaleY = 0.2 + rng() * 0.6 // Flattened
    const scaleZ = 0.5 + rng() * 1.8

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
 * Create small grass patches scattered around the island.
 * Simple green planes lying flat on the terrain.
 */
function createGrassPatches(scene: Scene): void {
  const grass = MeshBuilder.CreatePlane(
    'grassPatch',
    { width: 1.5, height: 1.5 },
    scene,
  )

  const grassMat = new StandardMaterial('grassMat', scene)
  grassMat.diffuseColor = new Color3(0.18, 0.50, 0.15)
  grassMat.specularColor = new Color3(0.05, 0.05, 0.05)
  grassMat.alpha = 0.85
  grassMat.backFaceCulling = false
  grass.material = grassMat
  grass.isVisible = false

  const rng = seedRandom(789)

  for (let i = 0; i < GRASS_PATCH_COUNT; i++) {
    const x = (rng() - 0.5) * 150
    const z = (rng() - 0.5) * 150
    const height = getHeightAtPosition(x, z)

    if (height < MIN_HEIGHT || height > 6) continue // Only on grassy areas

    const scale = 0.5 + rng() * 1.2
    const rotY = rng() * Math.PI * 2

    // Grass patches lie flat on the ground (rotated 90 degrees on X)
    // Use Quaternion from Euler: rotate -PI/2 on X to lay flat, then rotY on Y
    const rotationQuaternion = Vector3.Zero().toQuaternion()

    const matrix = Matrix.Compose(
      new Vector3(scale, scale, scale),
      rotationQuaternion,
      new Vector3(x, height + 0.05, z),
    )
    grass.thinInstanceAdd(matrix)
  }

  grass.isVisible = true

  // Rotate the template so instances lie flat
  grass.rotation.x = Math.PI / 2
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
