import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

const WATER_SIZE = 500

/**
 * Create a water plane at y=0 surrounding the island.
 * Uses a semi-transparent blue-green material with gentle wave animation.
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

  // Water material with tiled texture for surface detail
  const material = new StandardMaterial('waterMat', scene)

  const waterTex = new Texture('/textures/water.png', scene)
  waterTex.uScale = 8
  waterTex.vScale = 8
  waterTex.hasAlpha = false
  material.diffuseTexture = waterTex

  material.specularColor = new Color3(0.5, 0.5, 0.6)
  material.specularPower = 64
  material.emissiveColor = new Color3(0.02, 0.08, 0.15) // Slight self-illumination for depth
  material.alpha = 0.7
  material.backFaceCulling = false

  water.material = material

  // Gentle wave animation — bob the water plane up and down + scroll UV for flow
  let time = 0
  scene.registerBeforeRender(() => {
    time += scene.getEngine().getDeltaTime() * 0.001
    water.position.y = -0.3 + Math.sin(time * 0.8) * 0.15

    // Scroll UV offset for flowing water effect
    waterTex.uOffset += 0.0003
    waterTex.vOffset += 0.0002

    // Subtle alpha oscillation for shimmer effect
    material.alpha = 0.68 + Math.sin(time * 1.5) * 0.04
  })

  return water
}
