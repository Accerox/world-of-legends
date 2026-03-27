import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

const WATER_SIZE = 500

/**
 * Create a water plane at y=0 surrounding the island.
 * Uses a semi-transparent blue material with slight animation.
 */
export function createWater(scene: Scene): Mesh {
  const water = MeshBuilder.CreateGround(
    'water',
    {
      width: WATER_SIZE,
      height: WATER_SIZE,
      subdivisions: 2,
    },
    scene,
  )

  water.position.y = -0.3 // Slightly below terrain edge

  const material = new StandardMaterial('waterMat', scene)
  material.diffuseColor = new Color3(0.1, 0.3, 0.6)
  material.specularColor = new Color3(0.4, 0.4, 0.5)
  material.alpha = 0.75
  material.backFaceCulling = false

  water.material = material

  // Simple wave animation — bob the water plane up and down
  let time = 0
  scene.registerBeforeRender(() => {
    time += scene.getEngine().getDeltaTime() * 0.001
    water.position.y = -0.3 + Math.sin(time * 0.8) * 0.15
  })

  return water
}
