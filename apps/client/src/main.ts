/**
 * World of Legends — Main Entry Point
 *
 * Initializes the Babylon.js engine, shows login, creates the world,
 * spawns the player, connects to the server via WebSocket, and starts the render loop.
 */

import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

// Side-effect imports needed for Babylon.js features
import '@babylonjs/core/Meshes/meshBuilder'
import '@babylonjs/core/Materials/standardMaterial'
import '@babylonjs/core/Lights/hemisphericLight'
import '@babylonjs/core/Lights/directionalLight'
import '@babylonjs/core/Cameras/arcRotateCamera'

import { createEngine } from './engine.js'
import { createIsland, getHeightAtPosition } from './world/island.js'
import { createWater } from './world/water.js'
import { createSky } from './world/skybox.js'
import { createVegetation } from './world/vegetation.js'
import { createAvatar } from './player/avatar.js'
import { createFollowCamera } from './player/camera.js'
import { setupController } from './player/controller.js'
import { createNameplate } from './ui/nameplate.js'
import { NetworkClient } from './network/client.js'
import { GameStateManager } from './network/state.js'
import { ChatSystem } from './network/chat.js'
import { HUD } from './ui/hud.js'
import { initChatUI } from './ui/chat-ui.js'
import { showLoginScreen, hideLoginScreen, showLoginError } from './ui/login.js'
import { DEFAULT_CONFIG } from './types.js'
import type { PlayerState } from './types.js'

async function main(): Promise<void> {
  console.log('[WOL] World of Legends starting...')

  // ─── Get canvas ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
  if (!canvas) throw new Error('Canvas not found')

  // ─── Create engine ──────────────────────────────────────────────────────────
  const engine = await createEngine(canvas)

  // ─── Show login and wait for username ───────────────────────────────────────
  const username = await showLoginScreen()

  // ─── Connect to server via WebSocket ────────────────────────────────────────
  const network = new NetworkClient()
  let joinData

  try {
    joinData = await network.connect(DEFAULT_CONFIG.wsUrl, username)
  } catch (err) {
    showLoginError(err instanceof Error ? err.message : 'Connection failed')
    return
  }

  hideLoginScreen()
  console.log(`[WOL] Joined as ${joinData.username} (${joinData.playerId})`)

  // ─── Create scene ───────────────────────────────────────────────────────────
  const scene = new Scene(engine)

  // ─── Create world ───────────────────────────────────────────────────────────
  createSky(scene)
  const island = createIsland(scene)
  const water = createWater(scene)
  createVegetation(scene)

  // ─── Spawn local player ─────────────────────────────────────────────────────
  const localPlayer = createAvatar(scene, joinData.playerId, true)

  // Find spawn position from server data or default
  const serverSelf = joinData.gameState.players.find((p) => p.id === joinData.playerId)
  if (serverSelf) {
    localPlayer.position = new Vector3(serverSelf.x, serverSelf.y, serverSelf.z)
  } else {
    // Default spawn at island center
    const spawnHeight = getHeightAtPosition(0, 0) + 1
    localPlayer.position = new Vector3(0, spawnHeight, 0)
  }

  // Nameplate for local player
  createNameplate(scene, localPlayer, joinData.username)

  // ─── Camera ─────────────────────────────────────────────────────────────────
  const camera = createFollowCamera(scene, canvas, localPlayer)

  // ─── Controller ─────────────────────────────────────────────────────────────
  const { update: updateController } = setupController(scene, localPlayer, camera)

  // ─── Game state manager (remote players) ────────────────────────────────────
  const stateManager = new GameStateManager(scene, joinData.playerId)

  // Initialize with current server state
  let lastPlayers: PlayerState[] = joinData.gameState.players
  stateManager.updatePlayers(lastPlayers)

  // ─── Chat system ────────────────────────────────────────────────────────────
  initChatUI()
  const chatSystem = new ChatSystem(network)
  chatSystem.loadHistory(joinData.gameState.chat)
  chatSystem.addSystemMessage(`Welcome to World of Legends, ${joinData.username}!`)

  // ─── HUD ────────────────────────────────────────────────────────────────────
  const hud = new HUD(engine, localPlayer)

  // ─── Network callbacks (WebSocket push) ─────────────────────────────────────
  network.setCallbacks({
    onStateUpdate: (state) => {
      lastPlayers = state.players
      stateManager.updatePlayers(state.players)
    },

    onChatMessage: (msg) => {
      chatSystem.addMessage(msg)
    },

    onPlayerJoined: (player) => {
      chatSystem.addSystemMessage(`${player.username} joined the world`)
    },

    onPlayerLeft: (playerId) => {
      chatSystem.addSystemMessage(`A player left the world`)
    },

    onDisconnect: () => {
      chatSystem.addSystemMessage('Disconnected from server. Refresh to reconnect.')
    },
  })

  // ─── Render loop ────────────────────────────────────────────────────────────
  // Send position every 50ms (20 times/sec) — WebSocket is cheap, no request limit
  let lastSend = 0

  scene.registerBeforeRender(() => {
    updateController()
    stateManager.interpolate()
    hud.update(lastPlayers)

    // Send position update at 20 ticks/sec
    const now = Date.now()
    if (now - lastSend > 50) {
      network.sendPosition(
        localPlayer.position.x,
        localPlayer.position.y,
        localPlayer.position.z,
        localPlayer.rotation.y,
      )
      lastSend = now
    }
  })

  engine.runRenderLoop(() => {
    scene.render()
  })

  // ─── Resize handling ────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    engine.resize()
  })

  // ─── Cleanup on page unload ─────────────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    network.disconnect()
  })

  console.log('[WOL] World ready! Enjoy your adventure.')
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error('[WOL] Fatal error:', err)
  const errorEl = document.getElementById('login-error')
  if (errorEl) {
    errorEl.textContent = `Error: ${err.message}`
  }
})
