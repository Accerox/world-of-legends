import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { getHeightAtPosition } from '../world/island.js'

const MIN_DISTANCE = 3
const MAX_DISTANCE = 18
// Default camera position on login — close behind, slightly above
const DEFAULT_DISTANCE = 5    // Close to character
const DEFAULT_BETA = 1.0      // Higher angle (~57 degrees, looking down slightly)

// Exported so controller can check mouse look state
export let rightMouseHeld = false

/**
 * WoW-style camera using ArcRotateCamera (Babylon built-in, proven to work).
 * - Right-click drag: orbits camera AND rotates character to match
 * - Scroll: zoom
 * - When moving: camera follows behind player
 * - When still: camera stays where user left it
 */
export function createFollowCamera(
  scene: Scene,
  canvas: HTMLCanvasElement,
  target: Mesh,
): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    'followCamera',
    0,
    DEFAULT_BETA,
    DEFAULT_DISTANCE,
    target.position.clone(),
    scene,
  )

  camera.lowerRadiusLimit = MIN_DISTANCE
  camera.upperRadiusLimit = MAX_DISTANCE
  camera.lowerBetaLimit = -0.5  // Can go below horizon (look up at sky from below)
  camera.upperBetaLimit = Math.PI * 0.85  // Can go almost underneath
  camera.inertia = 0.85
  camera.panningSensibility = 0
  camera.wheelPrecision = 25

  // Left-click AND right-click can orbit the camera
  camera.attachControl(canvas, true)
  if (camera.inputs.attached.pointers) {
    (camera.inputs.attached.pointers as any).buttons = [0, 2]
  }

  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  // Track mouse button states
  let leftMouseHeld = false
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0) leftMouseHeld = true
    if (e.button === 2) rightMouseHeld = true
  })
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) leftMouseHeld = false
    if (e.button === 2) rightMouseHeld = false
  })

  // Track previous camera alpha to detect user rotation
  let prevAlpha = camera.alpha
  let lastPlayerX = target.position.x
  let lastPlayerZ = target.position.z
  let lastPlayerRotY = target.rotation.y
  let desiredRadius = DEFAULT_DISTANCE

  // Force initial camera position (consistent on every login)
  // Always start looking from behind the player
  camera.alpha = -(target.rotation.y + Math.PI / 2)
  camera.radius = DEFAULT_DISTANCE
  camera.beta = DEFAULT_BETA

  // Track user scroll to know desired zoom
  canvas.addEventListener('wheel', () => {
    setTimeout(() => { desiredRadius = camera.radius }, 50)
  })

  // Camera offset: target slightly to the right of the player
  // so the character appears on the left side of the screen
  // and the center of the screen is free for targeting/interaction
  const CAMERA_OFFSET_RIGHT = 0.8

  scene.registerBeforeRender(() => {
    // Calculate offset position (to the right of the player's facing direction)
    const rightDir = new Vector3(
      Math.cos(target.rotation.y),
      0,
      -Math.sin(target.rotation.y),
    )
    const offsetTarget = target.position.add(rightDir.scale(CAMERA_OFFSET_RIGHT))

    // Raise camera target based on zoom — close = head height, far = feet
    // zoomRatio: 0 = closest, 1 = farthest
    const zoomRatio = (camera.radius - camera.lowerRadiusLimit) / (camera.upperRadiusLimit - camera.lowerRadiusLimit)
    // Close (ratio=0) → look at head (+1.7), Far (ratio=1) → look at waist (+0.5)
    const targetHeightOffset = 1.7 - zoomRatio * 1.2
    offsetTarget.y = target.position.y + targetHeightOffset

    // Smooth position follow with offset
    camera.target = Vector3.Lerp(camera.target, offsetTarget, 0.2)

    // When right-click orbiting: rotate character to face camera direction
    if (rightMouseHeld) {
      const alphaDelta = camera.alpha - prevAlpha
      if (Math.abs(alphaDelta) > 0.001) {
        // Camera rotated → rotate character to match
        // Camera alpha and player rotY have opposite conventions
        target.rotation.y = -(camera.alpha + Math.PI / 2)
      }
    }
    prevAlpha = camera.alpha

    // When NOT holding any mouse button and player moves: camera follows behind
    if (!rightMouseHeld && !leftMouseHeld) {
      const dx = target.position.x - lastPlayerX
      const dz = target.position.z - lastPlayerZ
      const moved = (dx * dx + dz * dz) > 0.0001
      const turned = Math.abs(target.rotation.y - lastPlayerRotY) > 0.005

      if (moved || turned) {
        const behindAlpha = -(target.rotation.y + Math.PI / 2)
        let diff = behindAlpha - camera.alpha
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        camera.alpha += diff * 0.06
      }
    }

    lastPlayerX = target.position.x
    lastPlayerZ = target.position.z
    lastPlayerRotY = target.rotation.y

    // Keep camera at desired distance (only scroll changes it)
    camera.radius = desiredRadius

    // Terrain collision: temporarily zoom in
    const camPos = camera.position
    const terrainH = getHeightAtPosition(camPos.x, camPos.z) + 0.8
    if (camPos.y < terrainH) {
      camera.radius = Math.max(camera.lowerRadiusLimit, camera.radius * 0.85)
    }
  })

  return camera
}
