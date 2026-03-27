import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { PlayerState } from '../types.js'
import type { RemotePlayerMesh } from '../types.js'
import { createAvatar } from '../player/avatar.js'
import { createNameplate } from '../ui/nameplate.js'

const LERP_SPEED = 0.1 // Interpolation speed for remote players

/**
 * Manages the state of all remote players in the scene.
 * Handles creating/removing meshes and interpolating positions.
 */
export class GameStateManager {
  private remotePlayers: Map<string, RemotePlayerMesh> = new Map()
  private scene: Scene
  private localPlayerId: string

  constructor(scene: Scene, localPlayerId: string) {
    this.scene = scene
    this.localPlayerId = localPlayerId
  }

  /**
   * Update all remote players from server state.
   * Creates new meshes for new players, removes meshes for departed players,
   * and updates target positions for interpolation.
   */
  updatePlayers(serverPlayers: PlayerState[]): number {
    const activeIds = new Set<string>()

    for (const p of serverPlayers) {
      // Skip local player
      if (p.id === this.localPlayerId) continue

      activeIds.add(p.id)

      let remote = this.remotePlayers.get(p.id)

      if (!remote) {
        // New player — create mesh
        const mesh = createAvatar(this.scene, p.id, false)
        mesh.position = new Vector3(p.x, p.y, p.z)
        mesh.rotation.y = p.rotY

        createNameplate(this.scene, mesh, p.username)

        remote = {
          id: p.id,
          username: p.username,
          mesh,
          targetX: p.x,
          targetY: p.y,
          targetZ: p.z,
          targetRotY: p.rotY,
          lastUpdate: Date.now(),
        }
        this.remotePlayers.set(p.id, remote)
        console.log(`[WOL] Player joined: ${p.username}`)
      } else {
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
        remote.mesh.dispose()
        this.remotePlayers.delete(id)
      }
    }

    return this.remotePlayers.size
  }

  /**
   * Interpolate remote player positions toward their targets.
   * Call this every frame for smooth movement.
   */
  interpolate(): void {
    for (const remote of this.remotePlayers.values()) {
      const mesh = remote.mesh
      mesh.position.x += (remote.targetX - mesh.position.x) * LERP_SPEED
      mesh.position.y += (remote.targetY - mesh.position.y) * LERP_SPEED
      mesh.position.z += (remote.targetZ - mesh.position.z) * LERP_SPEED

      // Interpolate rotation (simple lerp, good enough for MVP)
      let rotDiff = remote.targetRotY - mesh.rotation.y
      // Handle wrap-around
      if (rotDiff > Math.PI) rotDiff -= Math.PI * 2
      if (rotDiff < -Math.PI) rotDiff += Math.PI * 2
      mesh.rotation.y += rotDiff * LERP_SPEED
    }
  }

  /**
   * Clean up all remote player meshes.
   */
  dispose(): void {
    for (const remote of this.remotePlayers.values()) {
      remote.mesh.dispose()
    }
    this.remotePlayers.clear()
  }
}
