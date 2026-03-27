import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'

const MIN_DISTANCE = 3
const MAX_DISTANCE = 15
const DEFAULT_DISTANCE = 8
const DEFAULT_ALPHA = -Math.PI / 2 // Behind the player
const DEFAULT_BETA = Math.PI / 3   // ~60 degrees from top

/**
 * Create a third-person follow camera targeting the player mesh.
 */
export function createFollowCamera(
  scene: Scene,
  canvas: HTMLCanvasElement,
  target: Mesh,
): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    'followCamera',
    DEFAULT_ALPHA,
    DEFAULT_BETA,
    DEFAULT_DISTANCE,
    target.position.clone(),
    scene,
  )

  // Zoom limits
  camera.lowerRadiusLimit = MIN_DISTANCE
  camera.upperRadiusLimit = MAX_DISTANCE

  // Vertical rotation limits (don't go underground or straight up)
  camera.lowerBetaLimit = 0.3
  camera.upperBetaLimit = Math.PI / 2.1

  // Smooth camera movement
  camera.inertia = 0.85

  // Mouse controls
  camera.attachControl(canvas, true)

  // Scroll wheel zoom speed
  camera.wheelPrecision = 30

  // Panning disabled (we follow the player)
  camera.panningSensibility = 0

  // Smooth follow: update target position each frame with lerp
  scene.registerBeforeRender(() => {
    const targetPos = target.position
    camera.target = Vector3.Lerp(camera.target, targetPos, 0.1)
  })

  return camera
}
