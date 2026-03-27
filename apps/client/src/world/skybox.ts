import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

/**
 * Create the sky environment: skybox, ambient light, and sun.
 */
export function createSky(scene: Scene): void {
  // Clear color (sky gradient base)
  scene.clearColor = new Color4(0.53, 0.72, 0.9, 1.0)

  // Fog for depth
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogDensity = 0.003
  scene.fogColor = new Color3(0.7, 0.82, 0.95)

  // Skybox
  const skybox = MeshBuilder.CreateBox('skybox', { size: 800 }, scene)
  const skyMaterial = new StandardMaterial('skyMat', scene)
  skyMaterial.backFaceCulling = false
  skyMaterial.disableLighting = true

  // Procedural sky texture
  const skyTexture = createSkyTexture(scene)
  skyMaterial.diffuseTexture = skyTexture
  skyMaterial.emissiveTexture = skyTexture

  skybox.material = skyMaterial
  skybox.infiniteDistance = true

  // ─── Lighting ───────────────────────────────────────────────────────────────

  // Ambient hemisphere light (sky blue from above, ground brown from below)
  const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene)
  hemiLight.intensity = 0.7
  hemiLight.diffuse = new Color3(1, 0.95, 0.9)
  hemiLight.groundColor = new Color3(0.3, 0.25, 0.2)

  // Directional sun light
  const sunLight = new DirectionalLight('sunLight', new Vector3(-0.5, -1, -0.3), scene)
  sunLight.intensity = 0.8
  sunLight.diffuse = new Color3(1, 0.95, 0.85)
}

/**
 * Create a simple procedural sky gradient texture.
 */
function createSkyTexture(scene: Scene): DynamicTexture {
  const size = 256
  const texture = new DynamicTexture('skyTex', size, scene, false)
  const ctx = texture.getContext()

  // Gradient from deep blue (top) to light blue/white (horizon)
  const gradient = ctx.createLinearGradient(0, 0, 0, size)
  gradient.addColorStop(0, '#1a3a6a')    // Deep blue at top
  gradient.addColorStop(0.3, '#4a7ab5')  // Medium blue
  gradient.addColorStop(0.6, '#87b5d6')  // Light blue
  gradient.addColorStop(0.85, '#c8dce8') // Very light
  gradient.addColorStop(1, '#e8e0d0')    // Warm horizon

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  // Add some cloud-like spots (using scaled arcs — DynamicTexture ctx lacks ellipse)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * size
    const y = Math.random() * size * 0.5
    const rx = Math.random() * 40 + 10
    const ry = Math.random() * 15 + 5
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, ry / rx)
    ctx.beginPath()
    ctx.arc(0, 0, rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  texture.update()
  return texture
}
