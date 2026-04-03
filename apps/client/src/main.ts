/**
 * World of Legends — Main Entry Point
 *
 * Initializes the Babylon.js engine, shows auth screen, character select,
 * creates the world, spawns the player, connects to the server via WebSocket,
 * and starts the render loop.
 *
 * Flow: Auth → Character Select → Connect WebSocket → Enter World
 */

import { Scene } from '@babylonjs/core/scene'
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'

// Side-effect imports needed for Babylon.js features
import '@babylonjs/core/Meshes/meshBuilder'
import '@babylonjs/core/Meshes/Builders/groundBuilder'
import '@babylonjs/core/Meshes/Builders/sphereBuilder'
import '@babylonjs/core/Meshes/thinInstanceMesh'
import '@babylonjs/core/Meshes/instancedMesh'
import '@babylonjs/core/Materials/standardMaterial'
import '@babylonjs/core/Materials/Textures/texture'
import '@babylonjs/core/Materials/Textures/dynamicTexture'
import '@babylonjs/core/Engines/Extensions/engine.dynamicTexture'
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture'
import '@babylonjs/core/Lights/hemisphericLight'
import '@babylonjs/core/Lights/directionalLight'
import '@babylonjs/core/Cameras/arcRotateCamera'
import '@babylonjs/core/Cameras/freeCamera'
import '@babylonjs/core/Culling/ray'
import '@babylonjs/core/Buffers/buffer'
import '@babylonjs/loaders/glTF'

import { createEngine } from './engine.js'
import { createIsland, getHeightAtPosition } from './world/island.js'
import { createWater } from './world/water.js'
import { createSky } from './world/skybox.js'
import { createVegetation } from './world/vegetation.js'
import { createStatue } from './world/statue.js'
import { createAnimatedAvatar } from './player/avatar.js'
import type { AnimatedAvatar } from './player/avatar.js'
import { createFollowCamera } from './player/camera.js'
import { setupController } from './player/controller.js'
import { createNameplate } from './ui/nameplate.js'
import { NetworkClient } from './network/client.js'
import { GameStateManager } from './network/state.js'
import { ChatSystem } from './network/chat.js'
import { HUD } from './ui/hud.js'
import { initChatUI } from './ui/chat-ui.js'
import { showAuthScreen } from './ui/auth-screen.js'
import { showCharacterSelect } from './ui/character-select.js'
import { initDialogueUI, showDialogue, setAvailableQuest, isDialogueOpen } from './ui/dialogue.js'
import { CombatUI } from './ui/combat.js'
import { QuestTrackerUI } from './ui/quests.js'
import { updateNPCs, getAllNPCMeshData } from './world/npcs.js'
import { SoundManager } from './audio/soundManager.js'
import { DEFAULT_CONFIG } from './types.js'
import type { PlayerState, NPC, PlayerQuestState, Quest } from './types.js'

async function main(): Promise<void> {
  console.log('[WOL] World of Legends starting...')

  // ─── Get canvas ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
  if (!canvas) throw new Error('Canvas not found')

  // ─── Create engine (needed early for canvas sizing) ─────────────────────────
  const engine = await createEngine(canvas)

  // ─── Step 1: Auth Screen — Login or Register ────────────────────────────────
  console.log('[WOL] Showing auth screen...')
  const authResult = await showAuthScreen()
  console.log('[WOL] Authenticated successfully')

  // ─── Step 2: Character Select — Pick or create a character ──────────────────
  console.log('[WOL] Showing character select...')
  const character = await showCharacterSelect(authResult.token)
  console.log(`[WOL] Selected character: ${character.name} (${character.race} ${character.className})`)

  // ─── Step 3: Connect to server via WebSocket with token + characterId ───────
  const network = new NetworkClient()
  let joinData

  try {
    joinData = await network.connect(DEFAULT_CONFIG.wsUrl, authResult.token, character.characterId)
  } catch (err) {
    // Show error on auth screen and reload
    alert(err instanceof Error ? err.message : 'Connection failed. Please try again.')
    window.location.reload()
    return
  }

  // ─── Show loading screen ─────────────────────────────────────────────────────
  const authEl = document.getElementById('auth-screen')
  const charSelectEl = document.getElementById('character-select-screen')
  const charCreateEl = document.getElementById('character-creator-screen')
  if (authEl) authEl.style.display = 'none'
  if (charSelectEl) charSelectEl.style.display = 'none'
  if (charCreateEl) charCreateEl.style.display = 'none'

  // Create loading screen
  const loadingScreen = document.createElement('div')
  loadingScreen.id = 'loading-screen'
  loadingScreen.style.cssText = `
    position:fixed; inset:0; z-index:200;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    font-family: 'Segoe UI', sans-serif; color:white;
  `
  loadingScreen.innerHTML = `
    <h1 style="font-size:2rem; color:#ffd700; margin-bottom:0.5rem; text-shadow:0 0 20px rgba(255,215,0,0.3)">World of Legends</h1>
    <p style="color:#8899aa; margin-bottom:2rem">Entering the world as <strong style="color:white">${joinData.username}</strong> · <span style="color:#667788">${joinData.race} ${joinData.className}</span></p>
    <div style="width:400px; max-width:90vw; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden">
      <div id="loading-bar" style="width:0%; height:100%; background:linear-gradient(90deg,#ffd700,#ff8c00); border-radius:2px; transition:width 0.3s"></div>
    </div>
    <p id="loading-status" style="color:#aabbcc; font-size:0.85rem; margin-top:0.75rem">Initializing...</p>
    <div id="loading-debug" style="margin-top:2rem; width:500px; max-width:90vw; max-height:200px; overflow-y:auto; font-family:'Courier New',monospace; font-size:0.7rem; color:#445566; text-align:left; padding:12px; background:rgba(0,0,0,0.3); border-radius:8px; border:1px solid rgba(255,255,255,0.05)"></div>
  `
  document.body.appendChild(loadingScreen)

  const loadStart = performance.now()
  const debugLog = (msg: string) => {
    const el = document.getElementById('loading-debug')
    if (el) {
      const elapsed = ((performance.now() - loadStart) / 1000).toFixed(2)
      const line = document.createElement('div')
      line.style.cssText = 'margin-bottom:2px; line-height:1.4'
      line.innerHTML = `<span style="color:#667788">[${elapsed}s]</span> <span style="color:#88aacc">${msg}</span>`
      el.appendChild(line)
      el.scrollTop = el.scrollHeight
    }
  }

  const setLoadProgress = (pct: number, status: string) => {
    const bar = document.getElementById('loading-bar')
    const text = document.getElementById('loading-status')
    if (bar) bar.style.width = pct + '%'
    if (text) text.textContent = status
    debugLog(status)
  }

  debugLog(`Engine: Babylon.js v7.54 · ${navigator.gpu ? 'WebGPU' : 'WebGL'}`)
  debugLog(`Player: ${joinData.username} (${joinData.playerId.substring(0,8)}...)`)
  debugLog(`Race: ${joinData.race} · Class: ${joinData.className} · Level: ${joinData.level || 1}`)
  debugLog(`Server: ${joinData.playerCount || '?'}/${joinData.maxPlayers || 50} players online`)
  debugLog(`Resolution: ${canvas.width}x${canvas.height} · DPR: ${window.devicePixelRatio}`)
  debugLog('─'.repeat(50))

  console.log(`[WOL] Joined as ${joinData.username} (${joinData.playerId}) — ${joinData.race} ${joinData.className}`)

  // ─── Create scene ───────────────────────────────────────────────────────────
  const scene = new Scene(engine)

  // ─── Create world ───────────────────────────────────────────────────────────
  setLoadProgress(5, 'Creating scene...')
  debugLog('Scene created · Fog: linear · Clear color: sky blue')
  
  setLoadProgress(10, 'Generating skybox...')
  createSky(scene)
  debugLog('Skybox: procedural gradient + hemispheric light')
  
  setLoadProgress(15, 'Generating terrain...')
  const island = createIsland(scene)
  debugLog('Terrain: 200x200 heightmap · vertex colors · grass texture')
  
  setLoadProgress(25, 'Adding water...')
  const water = createWater(scene)
  debugLog('Water: animated plane · UV scroll · alpha 0.7')
  
  setLoadProgress(30, 'Planting vegetation...')
  createVegetation(scene)
  debugLog('Vegetation: 130 trees · 60 rocks · 200 grass patches (thin instances)')
  
  setLoadProgress(35, 'Loading race showcase statues...')
  createStatue(scene).catch(e => debugLog(`⚠ Statue load failed: ${e}`))
  debugLog('Statues: 8 race models from R2 CDN (background load)')

  // ─── Spawn local player with race-specific model ────────────────────────────
  const playerRace = joinData.race || character.race || 'human'
  setLoadProgress(45, `Downloading ${playerRace} character model...`)
  debugLog(`Model URL: wol-assets.../models/races/${playerRace}-rigged.glb`)
  
  let localAvatar: Awaited<ReturnType<typeof createAnimatedAvatar>>
  try {
    localAvatar = await createAnimatedAvatar(scene, joinData.playerId, playerRace, true)
    debugLog(`✓ Avatar loaded: ${playerRace} · skeleton + animations`)
  } catch (err) {
    debugLog(`⚠ ${playerRace} model failed, loading fallback...`)
    setLoadProgress(55, 'Loading fallback model...')
    localAvatar = await createAnimatedAvatar(scene, joinData.playerId, 'human', true)
    debugLog('✓ Fallback avatar loaded: HVGirl')
  }
  setLoadProgress(65, 'Configuring camera...')
  // Use the avatar's root TransformNode for positioning — cast to Mesh for APIs
  // that expect it (camera, controller, nameplate). The root behaves like a Mesh
  // for position/rotation purposes.
  const localPlayer = localAvatar.root as unknown as Mesh

  // Find spawn position from server data or default
  const serverSelf = joinData.gameState.players.find((p) => p.id === joinData.playerId)
  if (serverSelf) {
    localAvatar.root.position = new Vector3(serverSelf.x, serverSelf.y, serverSelf.z)
  } else {
    // Default spawn at island center
    const spawnHeight = getHeightAtPosition(0, 0) + 1
    localAvatar.root.position = new Vector3(0, spawnHeight, 0)
  }

  // Nameplate for local player — create a dummy mesh parented to the avatar root
  // The root has no scaling (scaling is on the modelPivot child), so position is in world units
  const localNameplateMesh = new Mesh(`avatar_nameplate_local`, scene)
  localNameplateMesh.parent = localAvatar.root
  localNameplateMesh.isVisible = false
  localNameplateMesh.position.y = 2.0 // World units above feet (model is ~1.8 units tall after scaling)
  createNameplate(scene, localNameplateMesh, joinData.username)

  // ─── Camera ─────────────────────────────────────────────────────────────────
  debugLog('Camera: ArcRotate · WoW-style · right-click orbit · terrain collision')
  const camera = createFollowCamera(scene, canvas, localPlayer)

  // ─── Controller ─────────────────────────────────────────────────────────────
  setLoadProgress(75, 'Setting up controls...')
  debugLog('Controls: WASD movement · Shift run · Space jump · Right-click mouse look')
  const { update: updateController, state: controllerState } = setupController(scene, localPlayer, camera, localAvatar)

  // ─── Sound system ──────────────────────────────────────────────────────────
  setLoadProgress(80, 'Initializing audio...')
  const sound = new SoundManager()
  await sound.init()
  sound.startAmbient()
  debugLog('Audio: birds.mp3 · waves.mp3 · procedural footsteps · WebAudio API')

  // ─── Game state manager (remote players) ────────────────────────────────────
  setLoadProgress(85, 'Connecting to game state...')
  debugLog(`Multiplayer: WebSocket · 20 ticks/sec · max ${joinData.maxPlayers || 50} players`)
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
  const hud = new HUD(engine, localPlayer, joinData.maxPlayers)
  hud.createSoundToggle(sound)

  // Start ambient sounds now that the user has interacted (clicked "Enter World")
  sound.startAmbient()

  // ─── Combat UI ──────────────────────────────────────────────────────────────
  const combatUI = new CombatUI()

  // ─── Quest Tracker UI ───────────────────────────────────────────────────────
  const questTracker = new QuestTrackerUI()
  questTracker.setQuestDefinitions(joinData.quests)

  // Track player quest state locally
  let playerQuests: PlayerQuestState[] = joinData.playerQuests ?? []
  questTracker.update(playerQuests)

  // Keep a local copy of quest definitions for lookup
  const questDefs = new Map<string, Quest>()
  for (const q of joinData.quests) questDefs.set(q.id, q)

  // ─── Dialogue UI ────────────────────────────────────────────────────────────
  initDialogueUI(network)

  // ─── NPCs ───────────────────────────────────────────────────────────────────
  // Spawn initial NPCs from server state
  updateNPCs(scene, joinData.gameState.npcs)

  // Initialize player stats from server
  if (serverSelf) {
    combatUI.updatePlayerStats(
      serverSelf.health, serverSelf.maxHealth,
      serverSelf.xp, serverSelf.level, serverSelf.gold,
    )
  }

  // ─── NPC interaction (click handling) ───────────────────────────────────────
  let targetedEnemyId: string | null = null
  const INTERACT_RANGE = 8 // Max distance to interact with NPCs

  canvas.addEventListener('click', (e) => {
    // Don't process clicks when dialogue is open
    if (isDialogueOpen()) return

    const pickResult = scene.pick(e.clientX, e.clientY)
    if (!pickResult?.hit || !pickResult.pickedMesh) return

    // Check if clicked mesh belongs to an NPC
    const meshName = pickResult.pickedMesh.name
    const parentName = pickResult.pickedMesh.parent?.name ?? ''

    // NPC meshes are named npc_body_{id} or parented to npc_root_{id}
    let npcId: string | null = null
    const bodyMatch = meshName.match(/^npc_(?:body|eyeL|eyeR|head|excl|dot|bag)_(.+)$/)
    if (bodyMatch) {
      npcId = bodyMatch[1]
    } else {
      const rootMatch = parentName.match(/^npc_(?:root|body)_(.+)$/)
      if (rootMatch) npcId = rootMatch[1]
    }

    if (!npcId) return

    const npcData = getAllNPCMeshData().get(npcId)
    if (!npcData) return

    const npc = npcData.npcData

    // Check distance
    const dx = localPlayer.position.x - npc.x
    const dz = localPlayer.position.z - npc.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist > INTERACT_RANGE) return

    if (npc.type === 'enemy') {
      // Target the enemy
      if (!npc.isDead) {
        targetedEnemyId = npc.id
        combatUI.setTarget(npc.name, npc.health ?? 0, npc.maxHealth ?? 1)
      }
    } else {
      // Friendly NPC — send interact to server (server will respond with dialogue message)
      network.sendInteract(npc.id)
    }
  })

  // ─── Attack key handler ─────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.key === '1' && targetedEnemyId && !isDialogueOpen()) {
      network.sendAttack(targetedEnemyId)
      sound.playAttack()
      localAvatar.playAttack()
    }
  })

  // Attack button click
  combatUI.onAttackClick(() => {
    if (targetedEnemyId) {
      network.sendAttack(targetedEnemyId)
      sound.playAttack()
    }
  })

  // ─── Network callbacks (WebSocket push) ─────────────────────────────────────
  network.setCallbacks({
    onStateUpdate: (state) => {
      lastPlayers = state.players
      stateManager.updatePlayers(state.players)

      // Update NPC meshes from server state
      if (state.npcs) {
        updateNPCs(scene, state.npcs)
      }

      // Update player stats from server state
      const self = state.players.find((p) => p.id === joinData.playerId)
      if (self) {
        combatUI.updatePlayerStats(self.health, self.maxHealth, self.xp, self.level, self.gold)
      }

      // Update target frame if we have a targeted enemy
      if (targetedEnemyId && state.npcs) {
        const targetNpc = state.npcs.find((n: NPC) => n.id === targetedEnemyId)
        if (targetNpc && !targetNpc.isDead) {
          combatUI.setTarget(targetNpc.name, targetNpc.health ?? 0, targetNpc.maxHealth ?? 1)
        } else if (targetNpc?.isDead) {
          combatUI.clearTarget()
          targetedEnemyId = null
        }
      }
    },

    onChatMessage: (msg) => {
      chatSystem.addMessage(msg)
      // Only ping for messages from other players, not own or system
      if (msg.username && msg.username !== joinData.username) {
        sound.playChatPing()
      }
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

    // ─── Combat callbacks ───────────────────────────────────────────────────
    onDamage: (data) => {
      // Show floating damage number on the target NPC
      const npcMesh = getAllNPCMeshData().get(data.targetId)
      if (npcMesh) {
        // Project NPC world position to screen coordinates
        const worldPos = npcMesh.root.position
        const screenPos = Vector3.Project(
          worldPos,
          Matrix.Identity(),
          scene.getTransformMatrix(),
          camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()),
        )
        combatUI.showDamage(data.damage, screenPos.x, screenPos.y - 40, false)
      }

      // Update target frame if this is our target
      if (data.targetId === targetedEnemyId) {
        const npc = npcMesh?.npcData
        if (npc) {
          combatUI.setTarget(npc.name, data.remainingHealth, npc.maxHealth ?? 1)
        }
      }
    },

    onNpcDied: (data) => {
      if (data.npcId === targetedEnemyId) {
        combatUI.clearTarget()
        targetedEnemyId = null
      }
    },

    onPlayerDamage: (data) => {
      if (data.playerId === joinData.playerId) {
        // Show damage on player
        const screenCenterX = engine.getRenderWidth() / 2
        const screenCenterY = engine.getRenderHeight() / 2
        combatUI.showDamage(data.damage, screenCenterX, screenCenterY - 60, true)
      }
    },

    onPlayerDied: (data) => {
      if (data.playerId === joinData.playerId) {
        combatUI.showDeath(5)
        combatUI.clearTarget()
        targetedEnemyId = null
        sound.playSFX('death')
      }
    },

    onPlayerRespawn: (data) => {
      if (data.playerId === joinData.playerId) {
        localAvatar.root.position = new Vector3(data.x, data.y, data.z)
        combatUI.hideDeath()
      }
    },

    onNpcRespawn: (_data) => {
      // NPC respawn is handled by the state update — mesh will be restored
    },

    // ─── Quest callbacks ────────────────────────────────────────────────────
    onQuestAccepted: (data) => {
      console.log('[WOL] Quest accepted:', data.questId)
      // The quest_update message follows immediately with full quest list
    },

    onQuestUpdate: (data) => {
      console.log('[WOL] Quest update:', data.quests.length, 'quests')
      playerQuests = data.quests
      questTracker.update(playerQuests)
    },

    onQuestProgress: (data) => {
      // Update local quest state
      const pq = playerQuests.find((q) => q.questId === data.questId)
      if (pq) {
        pq.progress[data.objectiveIndex] = data.current
        questTracker.update(playerQuests)
      }
    },

    onQuestComplete: (data) => {
      const pq = playerQuests.find((q) => q.questId === data.questId)
      if (pq) {
        pq.completed = true
        questTracker.update(playerQuests)
      }
      const def = questDefs.get(data.questId)
      questTracker.showCompletion(def?.name ?? 'Quest', data.rewards.xp, data.rewards.gold)
    },

    onLevelUp: (data) => {
      if (data.playerId === joinData.playerId) {
        questTracker.showLevelUp(data.newLevel)
        sound.playSFX('levelup')
      }
    },

    // ─── Dialogue callbacks ─────────────────────────────────────────────────
    onDialogue: (data) => {
      showDialogue(data.npcName, data.lines, data.questId)
    },

    onQuestAvailable: (data) => {
      setAvailableQuest(data.quest)
      // Also register the quest definition if we don't have it
      if (!questDefs.has(data.quest.id)) {
        questDefs.set(data.quest.id, data.quest)
        questTracker.setQuestDefinitions(Array.from(questDefs.values()))
      }
      // Add to player quests tracking if not already there
      if (!playerQuests.find((q) => q.questId === data.quest.id)) {
        playerQuests.push({ questId: data.quest.id, accepted: false, progress: {}, completed: false })
      }
    },
  })

  // ─── Render loop ────────────────────────────────────────────────────────────
  // Send position every 50ms (20 times/sec) — WebSocket is cheap, no request limit
  let lastSend = 0
  let prevWasMoving = false

  scene.registerBeforeRender(() => {
    updateController()
    stateManager.interpolate()
    hud.update(lastPlayers)

    // ─── Sound: update waves volume based on distance to island edge ─────
    sound.updatePosition(localPlayer.position.x, localPlayer.position.z)

    // ─── Sound: footsteps sync with movement ─────────────────────────────
    const isMoving = controllerState.wasMoving
    if (isMoving && !prevWasMoving) {
      sound.startWalking(controllerState.isRunning)
    } else if (!isMoving && prevWasMoving) {
      sound.stopWalking()
    } else if (isMoving && prevWasMoving) {
      // Update walk/run speed if shift state changed
      sound.startWalking(controllerState.isRunning)
    }
    prevWasMoving = isMoving

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

  // ─── Hide loading screen, show game ──────────────────────────────────────────
  setLoadProgress(95, 'Finalizing...')
  debugLog('─'.repeat(50))
  debugLog(`Scene meshes: ${scene.meshes.length} · Materials: ${scene.materials.length}`)
  debugLog(`Active cameras: ${scene.activeCameras?.length || 1} · Lights: ${scene.lights.length}`)
  debugLog(`Total load time: ${((performance.now() - loadStart) / 1000).toFixed(1)}s`)
  debugLog('✓ All systems operational — entering world')
  setLoadProgress(100, 'Ready!')
  
  // Show canvas and HUD
  canvas.style.display = 'block'
  document.getElementById('hud')!.style.display = ''
  document.getElementById('chat-panel')!.style.display = ''
  document.getElementById('controls-hint')!.style.display = ''
  engine.resize()

  // Fade out loading screen
  setTimeout(() => {
    const ls = document.getElementById('loading-screen')
    if (ls) {
      ls.style.transition = 'opacity 0.5s'
      ls.style.opacity = '0'
      setTimeout(() => ls.remove(), 500)
    }
  }, 300)

  engine.runRenderLoop(() => {
    scene.render()
  })

  window.addEventListener('resize', () => {
    engine.resize()
  })

  window.addEventListener('beforeunload', () => {
    network.disconnect()
  })

  console.log('[WOL] World ready! Enjoy your adventure.')
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
main().catch((err) => {
  console.error('[WOL] Fatal error:', err)
  // Try to show error on any visible screen
  const authScreen = document.getElementById('auth-screen')
  if (authScreen) {
    authScreen.style.display = 'flex'
    authScreen.innerHTML = `
      <div style="text-align:center;color:#ff6b6b;padding:2rem;">
        <h2 style="color:#ffd700;margin-bottom:1rem;">World of Legends</h2>
        <p>Error: ${err.message}</p>
        <button onclick="window.location.reload()" style="margin-top:1rem;padding:10px 24px;border:none;border-radius:8px;background:#ffd700;color:#1a1a2e;font-weight:700;cursor:pointer;">Reload</button>
      </div>
    `
  }
})
