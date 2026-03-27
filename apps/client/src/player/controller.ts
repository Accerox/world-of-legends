import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { getHeightAtPosition } from '../world/island.js'

const MOVE_SPEED = 0.15
const JUMP_FORCE = 0.25
const GRAVITY = 0.012
const GROUND_OFFSET = 1.0 // Avatar center offset above ground
const ISLAND_BOUNDARY = 95 // Keep player within island radius

interface ControllerState {
  keys: Record<string, boolean>
  velocityY: number
  isGrounded: boolean
  chatFocused: boolean
}

/**
 * Set up WASD + mouse look + jump controls for the local player.
 * Returns an update function to call each frame and a state object.
 */
export function setupController(
  scene: Scene,
  player: Mesh,
  camera: ArcRotateCamera,
): { update: () => void; state: ControllerState } {
  const state: ControllerState = {
    keys: {},
    velocityY: 0,
    isGrounded: true,
    chatFocused: false,
  }

  // ─── Key listeners ──────────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    state.keys[e.key.toLowerCase()] = true

    // Enter to focus chat
    if (e.key === 'Enter' && !state.chatFocused) {
      const chatInput = document.getElementById('chat-input') as HTMLInputElement
      if (chatInput) {
        chatInput.focus()
        state.chatFocused = true
        e.preventDefault()
      }
    }

    // Escape to unfocus chat
    if (e.key === 'Escape' && state.chatFocused) {
      const chatInput = document.getElementById('chat-input') as HTMLInputElement
      if (chatInput) {
        chatInput.blur()
        state.chatFocused = false
      }
    }
  })

  window.addEventListener('keyup', (e) => {
    state.keys[e.key.toLowerCase()] = false
  })

  // Track chat focus state
  const chatInput = document.getElementById('chat-input')
  if (chatInput) {
    chatInput.addEventListener('focus', () => { state.chatFocused = true })
    chatInput.addEventListener('blur', () => { state.chatFocused = false })
  }

  // ─── Update function (called each frame) ────────────────────────────────────
  const update = () => {
    // Don't move while typing in chat
    if (state.chatFocused) return

    const keys = state.keys

    // Calculate movement direction relative to camera
    const forward = new Vector3(
      Math.sin(camera.alpha + Math.PI / 2),
      0,
      Math.cos(camera.alpha + Math.PI / 2),
    ).normalize()

    const right = Vector3.Cross(forward, Vector3.Up()).normalize()

    let moveDir = Vector3.Zero()

    if (keys['w'] || keys['arrowup']) moveDir.addInPlace(forward)
    if (keys['s'] || keys['arrowdown']) moveDir.addInPlace(forward.scale(-1))
    if (keys['a'] || keys['arrowleft']) moveDir.addInPlace(right.scale(-1))
    if (keys['d'] || keys['arrowright']) moveDir.addInPlace(right)

    // Normalize diagonal movement
    if (moveDir.length() > 0) {
      moveDir.normalize()
      player.position.addInPlace(moveDir.scale(MOVE_SPEED))

      // Rotate player to face movement direction
      player.rotation.y = Math.atan2(moveDir.x, moveDir.z)
    }

    // ─── Jump / Gravity ─────────────────────────────────────────────────────
    if ((keys[' '] || keys['space']) && state.isGrounded) {
      state.velocityY = JUMP_FORCE
      state.isGrounded = false
    }

    // Apply gravity
    state.velocityY -= GRAVITY
    player.position.y += state.velocityY

    // Terrain collision
    const terrainHeight = getHeightAtPosition(player.position.x, player.position.z)
    const groundLevel = terrainHeight + GROUND_OFFSET

    if (player.position.y <= groundLevel) {
      player.position.y = groundLevel
      state.velocityY = 0
      state.isGrounded = true
    }

    // ─── Boundary clamping ──────────────────────────────────────────────────
    const dist = Math.sqrt(
      player.position.x * player.position.x +
      player.position.z * player.position.z,
    )
    if (dist > ISLAND_BOUNDARY) {
      const scale = ISLAND_BOUNDARY / dist
      player.position.x *= scale
      player.position.z *= scale
    }

    // Don't fall below water
    if (player.position.y < 0.5) {
      player.position.y = 0.5
      state.velocityY = 0
      state.isGrounded = true
    }
  }

  return { update, state }
}
