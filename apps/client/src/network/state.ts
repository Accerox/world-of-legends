import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { PlayerState } from '../types.js'
import type { RemotePlayerMesh } from '../types.js'
import { createAnimatedAvatar } from '../player/avatar.js'
import { createNameplate } from '../ui/nameplate.js'

const LERP_SPEED = 0.1 // Interpolation speed for remote players
const MOVE_THRESHOLD = 0.01 // Minimum position delta to consider "moving"

/**
 * Manages the state of all remote players in the scene.
 * Handles creating/removing animated avatars and interpolating positions.
 */
export class GameStateManager {
  private remotePlayers: Map<string, RemotePlayerMesh> = new Map()
  /** Players waiting for async avatar creation */
  private pendingCreation: Set<string> = new Set()
  private scene: Scene
  private localPlayerId: string

  constructor(scene: Scene, localPlayerId: string) {
    this.scene = scene
    this.localPlayerId = localPlayerId
  }

  /**
   * Update all remote players from server state.
   * Creates new animated avatars for new players (async), removes meshes for
   * departed players, and updates target positions for interpolation.
   */
  updatePlayers(serverPlayers: PlayerState[]): number {
    const activeIds = new Set<string>()

    for (const p of serverPlayers) {
      // Skip local player
      if (p.id === this.localPlayerId) continue

      activeIds.add(p.id)

      let remote = this.remotePlayers.get(p.id)

      if (!remote && !this.pendingCreation.has(p.id)) {
        // New player — create animated avatar (async)
        this.pendingCreation.add(p.id)
        this.createRemotePlayer(p)
      } else if (remote) {
        // Existing player — update target for interpolation
        remote.targetX = p.x
        remote.targetY = p.y
        remote.targetZ = p.z
        remote.targetRotY = p.rotY
        remote.lastUpdate = Date.now()
      }
    }

    // Remove players that are no longer in the server state
    for (const [id, remote] of this.remotePlayers) {
      if (!activeIds.has(id)) {
        console.log(`[WOL] Player left: ${remote.username}`)
        if (remote.avatar) {
          remote.avatar.dispose()
        } else {
          remote.mesh.dispose()
        }
        this.remotePlayers.delete(id)
      }
    }

    // Also clean up pending creations for players that left
    for (const id of this.pendingCreation) {
      if (!activeIds.has(id)) {
        this.pendingCreation.delete(id)
      }
    }

    return this.remotePlayers.size
  }

  /**
   * Create a remote player's animated avatar asynchronously.
   * Uses the player's race to load the correct model from R2.
   */
  private async createRemotePlayer(p: PlayerState): Promise<void> {
    try {
      const avatar = await createAnimatedAvatar(this.scene, p.id, p.race || 'human', false)

      // Player may have left while we were loading
      if (!this.pendingCreation.has(p.id)) {
        avatar.dispose()
        return
      }

      // Position the avatar
      avatar.root.position = new Vector3(p.x, p.y, p.z)

      // Create a dummy mesh for nameplate linking (nameplates need a Mesh)
      // We use the root's first child mesh or create a tiny invisible one
      const dummyMesh = new Mesh(`avatar_nameplate_${p.id}`, this.scene)
      dummyMesh.parent = avatar.root
      dummyMesh.isVisible = false
      // Offset the nameplate anchor above the model's head
      // Root has no scaling (scaling is on the modelPivot child), so position is in world units
      dummyMesh.position.y = 2.0 // World units above feet (model is ~1.8 units tall after scaling)

      createNameplate(this.scene, dummyMesh, p.username)

      const remote: RemotePlayerMesh = {
        id: p.id,
        username: p.username,
        mesh: dummyMesh,
        avatar,
        targetX: p.x,
        targetY: p.y,
        targetZ: p.z,
        targetRotY: p.rotY,
        lastUpdate: Date.now(),
        wasMoving: false,
      }
      this.remotePlayers.set(p.id, remote)
      this.pendingCreation.delete(p.id)
      console.log(`[WOL] Player joined: ${p.username}`)
    } catch (err) {
      console.error(`[WOL] Failed to create avatar for ${p.username}:`, err)
      this.pendingCreation.delete(p.id)
    }
  }

  /**
   * Interpolate remote player positions toward their targets.
   * Also switches animations based on whether the player is moving.
   * Call this every frame for smooth movement.
   */
  interpolate(): void {
    for (const remote of this.remotePlayers.values()) {
      const avatar = remote.avatar
      if (!avatar) continue

      const root = avatar.root
      const prevX = root.position.x
      const prevZ = root.position.z

      // Interpolate position
      root.position.x += (remote.targetX - root.position.x) * LERP_SPEED
      root.position.y += (remote.targetY - root.position.y) * LERP_SPEED
      root.position.z += (remote.targetZ - root.position.z) * LERP_SPEED

      // Interpolate rotation (simple lerp with wrap-around)
      let rotDiff = remote.targetRotY - root.rotation.y
      if (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      if (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      root.rotation.y += rotDiff * LERP_SPEED

      // Detect movement for animation switching
      const dx = root.position.x - prevX
      const dz = root.position.z - prevZ
      const isMoving = (dx * dx + dz * dz) > MOVE_THRESHOLD * MOVE_THRESHOLD

      if (isMoving && !remote.wasMoving) {
        avatar.playWalk()
      } else if (!isMoving && remote.wasMoving) {
        avatar.playIdle()
      }
      remote.wasMoving = isMoving
    }
  }

  /**
   * Clean up all remote player meshes.
   */
  dispose(): void {
    for (const remote of this.remotePlayers.values()) {
      if (remote.avatar) {
        remote.avatar.dispose()
      }
      remote.mesh.dispose()
    }
    this.remotePlayers.clear()
  }
}
