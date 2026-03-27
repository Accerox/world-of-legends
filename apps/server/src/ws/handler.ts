import type { WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import type { GameState } from '../game/state.js'
import type { ClientMessage } from '../types.js'
import { sendMessage, broadcastExcept } from './broadcast.js'

/** Map from WebSocket to playerId for cleanup on disconnect */
const wsPlayerMap = new WeakMap<WebSocket, string>()

/**
 * Handle a new WebSocket connection.
 * Manages the full lifecycle: join → messages → disconnect.
 */
export function handleConnection(
  ws: WebSocket,
  _req: IncomingMessage,
  gameState: GameState,
  allClients: Set<WebSocket>,
): void {
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

function handleMessage(
  ws: WebSocket,
  msg: ClientMessage,
  gameState: GameState,
  allClients: Set<WebSocket>,
): void {
  switch (msg.type) {
    case 'join':
      handleJoin(ws, msg.username, gameState, allClients)
      break

    case 'move':
      handleMove(ws, msg.x, msg.y, msg.z, msg.rotY, gameState)
      break

    case 'chat':
      handleChat(ws, msg.message, gameState, allClients)
      break

    case 'leave':
      handleDisconnect(ws, gameState, allClients)
      ws.close()
      break

    default:
      sendMessage(ws, { type: 'error', message: 'Unknown message type' })
  }
}

function handleJoin(
  ws: WebSocket,
  username: string,
  gameState: GameState,
  allClients: Set<WebSocket>,
): void {
  // Validate username
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

  // Check if this ws already has a player
  if (wsPlayerMap.has(ws)) {
    sendMessage(ws, { type: 'error', message: 'Already joined' })
    return
  }

  const playerId = randomUUID()
  const player = gameState.addPlayer(playerId, trimmed)
  wsPlayerMap.set(ws, playerId)

  console.log(`[WOL] Player joined: ${trimmed} (${playerId})`)

  // Send join confirmation with current game state
  const fullState = gameState.getFullState()
  sendMessage(ws, {
    type: 'joined',
    playerId,
    username: trimmed,
    gameState: {
      players: fullState.players,
      chat: fullState.chat,
      serverTime: Date.now(),
    },
  })

  // Notify other players
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
): void {
  const playerId = wsPlayerMap.get(ws)
  if (!playerId) {
    sendMessage(ws, { type: 'error', message: 'Not joined' })
    return
  }

  gameState.updatePosition(playerId, x, y, z, rotY)
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

  // Broadcast chat to all connected clients
  for (const client of allClients) {
    if (client.readyState === client.OPEN) {
      sendMessage(client, { type: 'chat', message: chatMsg })
    }
  }
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

  gameState.removePlayer(playerId)
  wsPlayerMap.delete(ws)

  console.log(`[WOL] Player left: ${username} (${playerId})`)

  // Notify other players
  broadcastExcept(allClients, ws, {
    type: 'player_left',
    playerId,
  })
}
