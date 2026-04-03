import type { WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import { GameState, MAX_PLAYERS } from '../game/state.js'
import type { ClientMessage } from '../types.js'
import { sendMessage, broadcastExcept, broadcast } from './broadcast.js'
import type { AccountManager } from '../auth/accounts.js'

/** Map from WebSocket to playerId for cleanup on disconnect */
const wsPlayerMap = new WeakMap<WebSocket, string>()

/** Map from WebSocket to characterId for saving on disconnect */
const wsCharacterMap = new WeakMap<WebSocket, string>()

/** Shared reference to AccountManager (set on first connection) */
let accountMgr: AccountManager | null = null

/**
 * Handle a new WebSocket connection.
 * Manages the full lifecycle: join → messages → disconnect.
 */
export function handleConnection(
  ws: WebSocket,
  _req: IncomingMessage,
  gameState: GameState,
  allClients: Set<WebSocket>,
  accounts?: AccountManager,
): void {
  if (accounts) accountMgr = accounts
  console.log('[WOL] New WebSocket connection')

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as ClientMessage
      handleMessage(ws, msg, gameState, allClients)
    } catch (err) {
      sendMessage(ws, { type: 'error', message: 'Invalid message format' })
    }
  })

  ws.on('close', () => {
    handleDisconnect(ws, gameState, allClients)
  })

  ws.on('error', (err) => {
    console.error('[WOL] WebSocket error:', err.message)
    handleDisconnect(ws, gameState, allClients)
  })
}

async function handleMessage(
  ws: WebSocket,
  msg: ClientMessage,
  gameState: GameState,
  allClients: Set<WebSocket>,
): Promise<void> {
  switch (msg.type) {
    case 'join':
      await handleJoin(ws, msg, gameState, allClients)
      break

    case 'move':
      handleMove(ws, msg.x, msg.y, msg.z, msg.rotY, gameState, allClients)
      break

    case 'chat':
      handleChat(ws, msg.message, gameState, allClients)
      break

    case 'attack':
      handleAttack(ws, msg.targetId, gameState, allClients)
      break

    case 'interact':
      handleInteract(ws, msg.targetId, gameState)
      break

    case 'accept_quest':
      handleAcceptQuest(ws, msg.questId, gameState)
      break

    case 'leave':
      handleDisconnect(ws, gameState, allClients)
      ws.close()
      break

    default:
      sendMessage(ws, { type: 'error', message: 'Unknown message type' })
  }
}

async function handleJoin(
  ws: WebSocket,
  msg: ClientMessage & { type: 'join' },
  gameState: GameState,
  allClients: Set<WebSocket>,
): Promise<void> {
  if (wsPlayerMap.has(ws)) {
    sendMessage(ws, { type: 'error', message: 'Already joined' })
    return
  }

  if (gameState.isFull()) {
    sendMessage(ws, {
      type: 'error',
      message: `Server is full (${MAX_PLAYERS}/${MAX_PLAYERS} players). Try again later.`,
    })
    ws.close()
    return
  }

  // ─── Auth-aware join (token + characterId) ────────────────────────────
  if ('token' in msg && 'characterId' in msg && accountMgr) {
    const { verifyToken } = await import('../auth/jwt.js')
    const payload = verifyToken(msg.token as string)
    if (!payload) {
      sendMessage(ws, { type: 'error', message: 'Invalid or expired token' })
      return
    }

    const character = await accountMgr.getCharacter(msg.characterId as string)
    if (!character || character.accountId !== payload.accountId) {
      sendMessage(ws, { type: 'error', message: 'Character not found or does not belong to this account' })
      return
    }

    const playerId = randomUUID()
    const player = gameState.addPlayer(playerId, character.name, {
      race: character.race,
      className: character.className,
      characterId: character.id,
      character,
    })
    wsPlayerMap.set(ws, playerId)
    wsCharacterMap.set(ws, character.id)

    console.log(`[WOL] Player joined (auth): ${character.name} [${character.race} ${character.className}] (${playerId}) [${gameState.playerCount}/${MAX_PLAYERS}]`)

    const fullState = gameState.getFullState()
    sendMessage(ws, {
      type: 'joined',
      playerId,
      username: character.name,
      race: character.race,
      className: character.className,
      level: character.level,
      characterId: character.id,
      playerCount: gameState.playerCount,
      maxPlayers: MAX_PLAYERS,
      gameState: {
        players: fullState.players,
        chat: fullState.chat,
        npcs: fullState.npcs,
        serverTime: Date.now(),
      },
      quests: gameState.getAllQuests(),
      playerQuests: gameState.getPlayerQuests(playerId),
    })

    broadcastExcept(allClients, ws, {
      type: 'player_joined',
      player,
    })
    return
  }

  // ─── Legacy join (username only, no auth) ─────────────────────────────
  const username = 'username' in msg ? (msg as { username: string }).username : undefined
  const trimmed = username?.trim()
  if (!trimmed || trimmed.length < 2 || trimmed.length > 16) {
    sendMessage(ws, { type: 'error', message: 'Username must be 2-16 characters' })
    return
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    sendMessage(ws, {
      type: 'error',
      message: 'Username can only contain letters, numbers, and underscores',
    })
    return
  }

  const playerId = randomUUID()
  const player = gameState.addPlayer(playerId, trimmed)
  wsPlayerMap.set(ws, playerId)

  console.log(`[WOL] Player joined (legacy): ${trimmed} (${playerId}) [${gameState.playerCount}/${MAX_PLAYERS}]`)

  const fullState = gameState.getFullState()
  sendMessage(ws, {
    type: 'joined',
    playerId,
    username: trimmed,
    race: player.race,
    className: player.className,
    level: player.level,
    playerCount: gameState.playerCount,
    maxPlayers: MAX_PLAYERS,
    gameState: {
      players: fullState.players,
      chat: fullState.chat,
      npcs: fullState.npcs,
      serverTime: Date.now(),
    },
    quests: gameState.getAllQuests(),
    playerQuests: gameState.getPlayerQuests(playerId),
  })

  broadcastExcept(allClients, ws, {
    type: 'player_joined',
    player,
  })
}

function handleMove(
  ws: WebSocket,
  x: number,
  y: number,
  z: number,
  rotY: number,
  gameState: GameState,
  allClients: Set<WebSocket>,
): void {
  const playerId = wsPlayerMap.get(ws)
  if (!playerId) {
    sendMessage(ws, { type: 'error', message: 'Not joined' })
    return
  }

  gameState.updatePosition(playerId, x, y, z, rotY)

  // Check reach quest objectives after position update
  const reachUpdates = gameState.getReachQuestUpdates(playerId)
  for (const update of reachUpdates) {
    sendMessage(ws, {
      type: 'quest_progress',
      questId: update.questId,
      objectiveIndex: update.objectiveIndex,
      current: update.current,
      required: update.required,
    })

    // Check if quest is now complete
    const completion = gameState.checkQuestCompletion(playerId, update.questId)
    if (completion) {
      sendMessage(ws, {
        type: 'quest_complete',
        questId: update.questId,
        rewards: completion.rewards,
      })

      // Check level up
      const levelUp = gameState.checkLevelUp(playerId)
      if (levelUp) {
        broadcast(allClients, {
          type: 'level_up',
          playerId,
          newLevel: levelUp.newLevel,
          newMaxHealth: levelUp.newMaxHealth,
        })
      }
    }
  }
}

function handleChat(
  ws: WebSocket,
  message: string,
  gameState: GameState,
  allClients: Set<WebSocket>,
): void {
  const playerId = wsPlayerMap.get(ws)
  if (!playerId) {
    sendMessage(ws, { type: 'error', message: 'Not joined' })
    return
  }

  const chatMsg = gameState.addChatMessage(playerId, message)
  if (!chatMsg) {
    sendMessage(ws, { type: 'error', message: 'Invalid message (empty or too long, max 200 chars)' })
    return
  }

  for (const client of allClients) {
    if (client.readyState === client.OPEN) {
      sendMessage(client, { type: 'chat', message: chatMsg })
    }
  }
}

function handleAttack(
  ws: WebSocket,
  targetId: string,
  gameState: GameState,
  allClients: Set<WebSocket>,
): void {
  const playerId = wsPlayerMap.get(ws)
  if (!playerId) {
    sendMessage(ws, { type: 'error', message: 'Not joined' })
    return
  }

  const result = gameState.attackNPC(playerId, targetId)
  if (!result) return // Invalid attack (out of range, dead, etc.)

  // Broadcast damage to all clients
  broadcast(allClients, {
    type: 'damage',
    targetId,
    damage: result.damage,
    remainingHealth: result.npc.health ?? 0,
    attackerId: playerId,
  })

  if (result.killed) {
    // Broadcast NPC death
    broadcast(allClients, {
      type: 'npc_died',
      npcId: targetId,
      killerId: playerId,
    })

    // Check kill quest progress (trackKill was already called in attackNPC)
    // We need to get the updates that were tracked
    const quests = gameState.getPlayerQuests(playerId)
    for (const pq of quests) {
      if (pq.completed) continue
      // Send current progress for all kill objectives
      const quest = gameState.getAllQuests().find((q) => q.id === pq.questId)
      if (!quest) continue
      for (let i = 0; i < quest.objectives.length; i++) {
        if (quest.objectives[i].type === 'kill') {
          sendMessage(ws, {
            type: 'quest_progress',
            questId: pq.questId,
            objectiveIndex: i,
            current: pq.progress[i] ?? 0,
            required: quest.objectives[i].count,
          })
        }
      }

      // Check if quest is now complete
      const completion = gameState.checkQuestCompletion(playerId, pq.questId)
      if (completion) {
        sendMessage(ws, {
          type: 'quest_complete',
          questId: pq.questId,
          rewards: completion.rewards,
        })

        // Check level up
        const levelUp = gameState.checkLevelUp(playerId)
        if (levelUp) {
          broadcast(allClients, {
            type: 'level_up',
            playerId,
            newLevel: levelUp.newLevel,
            newMaxHealth: levelUp.newMaxHealth,
          })
        }
      }
    }
  } else {
    // NPC retaliates
    const retaliation = gameState.npcRetaliate(playerId, targetId)
    if (retaliation) {
      broadcast(allClients, {
        type: 'player_damage',
        playerId,
        damage: retaliation.damage,
        remainingHealth: gameState.getPlayer(playerId)?.health ?? 0,
        sourceId: targetId,
      })

      if (retaliation.playerDied) {
        broadcast(allClients, {
          type: 'player_died',
          playerId,
        })
      }
    }
  }
}

function handleInteract(
  ws: WebSocket,
  targetId: string,
  gameState: GameState,
): void {
  const playerId = wsPlayerMap.get(ws)
  if (!playerId) {
    sendMessage(ws, { type: 'error', message: 'Not joined' })
    return
  }

  const result = gameState.interactNPC(playerId, targetId)
  if (!result) return

  sendMessage(ws, {
    type: 'dialogue',
    npcId: result.npc.id,
    npcName: result.npc.name,
    lines: result.npc.dialogue,
    questId: result.quest?.id,
  })

  if (result.quest) {
    sendMessage(ws, {
      type: 'quest_available',
      quest: result.quest,
    })
  }
}

function handleAcceptQuest(
  ws: WebSocket,
  questId: string,
  gameState: GameState,
): void {
  const playerId = wsPlayerMap.get(ws)
  if (!playerId) {
    sendMessage(ws, { type: 'error', message: 'Not joined' })
    return
  }

  const accepted = gameState.acceptQuest(playerId, questId)
  if (!accepted) {
    sendMessage(ws, { type: 'error', message: 'Quest already accepted or invalid' })
    return
  }

  // Send confirmation + updated quest list to this player
  sendMessage(ws, { type: 'quest_accepted', questId })
  sendMessage(ws, { type: 'quest_update', quests: gameState.getPlayerQuests(playerId) })
}

function handleDisconnect(
  ws: WebSocket,
  gameState: GameState,
  allClients: Set<WebSocket>,
): void {
  const playerId = wsPlayerMap.get(ws)
  if (!playerId) return

  const player = gameState.getPlayer(playerId)
  const username = player?.username ?? 'unknown'

  // Save character data before removing player
  const characterId = wsCharacterMap.get(ws)
  if (characterId && player && accountMgr) {
    accountMgr.updateCharacter(characterId, {  // fire-and-forget async
      x: player.x,
      y: player.y,
      z: player.z,
      rotY: player.rotY,
      health: player.health,
      maxHealth: player.maxHealth,
      xp: player.xp,
      gold: player.gold,
      level: player.level,
    })
    console.log(`[WOL] Saved character data for ${username} (${characterId})`)
  }

  gameState.removePlayer(playerId)
  wsPlayerMap.delete(ws)
  wsCharacterMap.delete(ws)

  console.log(`[WOL] Player left: ${username} (${playerId}) [${gameState.playerCount}/${MAX_PLAYERS}]`)

  broadcastExcept(allClients, ws, {
    type: 'player_left',
    playerId,
  })
}
