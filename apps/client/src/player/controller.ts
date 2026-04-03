import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { getHeightAtPosition } from '../world/island.js'
import { rightMouseHeld } from './camera.js'

const WALK_SPEED = 0.08
const RUN_SPEED = 0.18
const STRAFE_SPEED = 0.08
const TURN_SPEED = 0.04
const JUMP_FORCE = 0.22
const GRAVITY = 0.01
const GROUND_OFFSET = 0.0  // Root sits at terrain level, model offset handles the rest
const ISLAND_BOUNDARY = 95

interface ControllerState {
  keys: Record<string, boolean>
  velocityY: number
  isGrounded: boolean
  chatFocused: boolean
  wasMoving: boolean
  wasMovingBack: boolean
  wasStrafing: boolean
  isRunning: boolean
}

/**
 * WoW-style controls:
 * 
 * WITHOUT right-click held:
 *   W/S = move forward/backward
 *   A/D = turn character left/right
 * 
 * WITH right-click held (mouse look mode):
 *   W/S = move forward/backward
 *   A/D = strafe left/right
 *   Mouse = rotate character
 * 
 * Always:
 *   Q/E = strafe left/right
 *   Space = jump
 */
export function setupController(
  scene: Scene,
  player: Mesh,
  camera: ArcRotateCamera,
  avatar?: AnimatedAvatar,
): { update: () => void; state: ControllerState } {
  const state: ControllerState = {
    keys: {},
    velocityY: 0,
    isGrounded: true,
    chatFocused: false,
    wasMoving: false,
    wasMovingBack: false,
    wasStrafing: false,
    isRunning: false,
  }

  window.addEventListener('keydown', (e) => {
    state.keys[e.key.toLowerCase()] = true

    // Shift held = run
    if (e.key === 'Shift') {
      state.isRunning = true
      if (avatar && state.wasMoving && !state.wasMovingBack) {
        avatar.playRun()
      }
    }

    if (e.key === 'Enter' && !state.chatFocused) {
      const chatInput = document.getElementById('chat-input') as HTMLInputElement
      if (chatInput) { chatInput.focus(); state.chatFocused = true; e.preventDefault() }
    }
    if (e.key === 'Escape' && state.chatFocused) {
      const chatInput = document.getElementById('chat-input') as HTMLInputElement
      if (chatInput) { chatInput.blur(); state.chatFocused = false }
    }
  })

  window.addEventListener('keyup', (e) => {
    state.keys[e.key.toLowerCase()] = false

    // Release Shift = stop running
    if (e.key === 'Shift') {
      state.isRunning = false
      if (avatar && state.wasMoving && !state.wasMovingBack) {
        avatar.playWalk()
      }
    }
  })

  // Chat input may not exist yet — retry until found
  const bindChatInput = () => {
    const chatInput = document.getElementById('chat-input')
    if (chatInput) {
      chatInput.addEventListener('focus', () => { state.chatFocused = true })
      chatInput.addEventListener('blur', () => { state.chatFocused = false })
    } else {
      setTimeout(bindChatInput, 500)
    }
  }
  bindChatInput()

  const update = () => {
    if (state.chatFocused) return

    const keys = state.keys

    const moveSpeed = state.isRunning ? RUN_SPEED : WALK_SPEED

    // Character's forward and right vectors
    const forward = new Vector3(
      Math.sin(player.rotation.y),
      0,
      Math.cos(player.rotation.y),
    )
    const right = Vector3.Cross(forward, Vector3.Up()).normalize()

    if (rightMouseHeld) {
      // MOUSE LOOK MODE: A/D = strafe
      if (keys['a'] || keys['arrowleft']) {
        player.position.addInPlace(right.scale(STRAFE_SPEED))
      }
      if (keys['d'] || keys['arrowright']) {
        player.position.addInPlace(right.scale(-STRAFE_SPEED))
      }
    } else {
      // NORMAL MODE: A/D = turn character
      if (keys['a'] || keys['arrowleft']) {
        player.rotation.y -= TURN_SPEED
      }
      if (keys['d'] || keys['arrowright']) {
        player.rotation.y += TURN_SPEED
      }
    }

    // W/S = forward/backward
    if (keys['w'] || keys['arrowup']) {
      player.position.addInPlace(forward.scale(moveSpeed))
    }
    if (keys['s'] || keys['arrowdown']) {
      player.position.addInPlace(forward.scale(-moveSpeed * 0.5))
    }

    // Q/E removed — strafe only with right-click + A/D

    // Jump — physics handles vertical movement; keep current animation playing
    // to avoid model-swap pop (jump.glb uses a generic model, not the race model)
    if (keys[' '] && state.isGrounded) {
      state.velocityY = JUMP_FORCE
      state.isGrounded = false
    }

    // Gravity
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

    // Boundary
    const dist = Math.sqrt(player.position.x ** 2 + player.position.z ** 2)
    if (dist > ISLAND_BOUNDARY) {
      const scale = ISLAND_BOUNDARY / dist
      player.position.x *= scale
      player.position.z *= scale
    }

    // Water floor — don't go below water level
    if (player.position.y < -0.2) {
      player.position.y = -0.2
      state.velocityY = 0
      state.isGrounded = true
    }

    // ─── Locomotion system (Unreal/WoW style) ──────────────────────────────────
    // Calculate movement direction relative to character facing
    // and rotate the model visually + pick the right animation
    if (avatar) {
      const isMovingForward = keys['w'] || keys['arrowup']
      const isMovingBack = keys['s'] || keys['arrowdown']
      const isStrafeLeft = rightMouseHeld && (keys['a'] || keys['arrowleft'])
      const isStrafeRight = rightMouseHeld && (keys['d'] || keys['arrowright'])
      const isMoving = isMovingForward || isMovingBack || isStrafeLeft || isStrafeRight

      if (isMoving) {
        // Calculate the visual yaw offset based on movement direction
        // 0 = forward, PI = backward, PI/2 = right, -PI/2 = left
        let moveAngle = 0

        const goingBack = isMovingBack && !isMovingForward

        if (goingBack) {
          // Walking backward: model faces OPPOSITE of strafe direction
          if (isStrafeLeft) moveAngle = Math.PI / 4        // S+A: walk back-left, face 45° right
          else if (isStrafeRight) moveAngle = -Math.PI / 4  // S+D: walk back-right, face 45° left
          else moveAngle = 0                                 // S only: face forward, walk back
        } else {
          // Walking forward: model faces movement direction
          if (isMovingForward && isStrafeLeft) moveAngle = -Math.PI / 4   // W+A: face 45° left
          else if (isMovingForward && isStrafeRight) moveAngle = Math.PI / 4 // W+D: face 45° right
          else if (isMovingForward) moveAngle = 0                          // W: face forward
          else if (isStrafeLeft) moveAngle = -Math.PI / 2                  // A: face 90° left
          else if (isStrafeRight) moveAngle = Math.PI / 2                  // D: face 90° right
        }

        avatar.setVisualYaw(moveAngle)

        // Animation: WalkBack for any backward movement, Walk/Run for forward/strafe
        if (goingBack) {
          if (!state.wasMoving || !state.wasMovingBack) avatar.playWalkBack()
        } else {
          if (!state.wasMoving || state.wasMovingBack) {
            if (state.isRunning) avatar.playRun()
            else avatar.playWalk()
          }
        }
        state.wasMovingBack = goingBack
      } else {
        // Not moving — idle + reset visual rotation
        if (state.wasMoving) avatar.playIdle()
        avatar.setVisualYaw(0) // Face forward
        state.wasMovingBack = false
      }

      state.wasMoving = isMoving
      state.wasStrafing = false
    }
  }

  return { update, state }
}
