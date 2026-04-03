import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

/**
 * Create the sky environment: skybox, ambient light, sun, and fog.
 */
export function createSky(scene: Scene): void {
  // Clear color — light sky blue
  scene.clearColor = new Color4(0.53, 0.81, 0.92, 1.0)

  // Linear fog for depth — objects fade into the sky at distance
  scene.fogMode = Scene.FOGMODE_LINEAR
  scene.fogColor = new Color3(0.53, 0.81, 0.92)
  scene.fogStart = 80
  scene.fogEnd = 150

  // Sky dome — sphere with panoramic texture mapped inside
  const skyDome = MeshBuilder.CreateSphere('skyDome', { diameter: 400, segments: 32 }, scene)
  const skyMaterial = new StandardMaterial('skyMat', scene)
  skyMaterial.backFaceCulling = false
  skyMaterial.disableLighting = true

  // Panoramic sky texture
  const skyTexture = new Texture('/textures/sky.png', scene)
  skyTexture.coordinatesMode = Texture.SPHERICAL_MODE
  skyMaterial.diffuseTexture = skyTexture
  skyMaterial.emissiveTexture = skyTexture // Self-lit so sky is always visible

  skyDome.material = skyMaterial
  skyDome.infiniteDistance = true

  // ─── Lighting ───────────────────────────────────────────────────────────────

  // Ambient hemisphere light (warm sky from above, cool ground bounce from below)
  const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene)
  hemiLight.intensity = 0.7
  hemiLight.diffuse = new Color3(1.0, 0.96, 0.92)
  hemiLight.groundColor = new Color3(0.25, 0.28, 0.35)

  // Directional sun light — warm golden hour feel
  const sunLight = new DirectionalLight('sunLight', new Vector3(-0.5, -1, -0.3), scene)
  sunLight.intensity = 0.9
  sunLight.diffuse = new Color3(1.0, 0.94, 0.82)
}


