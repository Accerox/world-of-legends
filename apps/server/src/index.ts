import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { GameState, MAX_PLAYERS } from './game/state.js'
import { handleConnection } from './ws/handler.js'
import { AccountManager } from './auth/accounts.js'
import { verifyToken } from './auth/jwt.js'

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express()
const server = createServer(app)
const gameState = new GameState()
const accounts = new AccountManager()

// ─── CORS ─────────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://192.168.0.204:5173',
      'https://wol.raregames.io',
      'https://wol-game.pages.dev',
    ],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
)

// ─── JSON body parser ─────────────────────────────────────────────────────────

app.use(express.json())

// ─── Auth middleware ──────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  accountId?: string
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.slice(7)
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  const account = await accounts.getAccount(payload.accountId)
  if (!account) {
    res.status(401).json({ error: 'Account not found' })
    return
  }

  req.accountId = payload.accountId
  next()
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

app.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const result = await accounts.register(email, password)
    res.status(201).json({ token: result.token, account: result.account })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    res.status(400).json({ error: message })
  }
})

app.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const result = await accounts.login(email, password)
    res.json({ token: result.token, account: result.account })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed'
    res.status(401).json({ error: message })
  }
})

app.get('/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const account = await accounts.getAccount(req.accountId!)
  if (!account) {
    res.status(404).json({ error: 'Account not found' })
    return
  }
  res.json({ account })
})

// ─── Character endpoints ──────────────────────────────────────────────────────

app.post('/characters', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, race, className } = req.body
    if (!name || !race || !className) {
      res.status(400).json({ error: 'name, race, and className are required' })
      return
    }

    const character = await accounts.createCharacter(req.accountId!, { name, race, className })
    res.status(201).json({ character })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Character creation failed'
    res.status(400).json({ error: message })
  }
})

app.get('/characters', requireAuth, async (req: AuthRequest, res: Response) => {
  const characters = await accounts.getCharacters(req.accountId!)
  res.json({ characters })
})

app.delete('/characters/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const charId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const deleted = await accounts.deleteCharacter(charId, req.accountId!)
  if (!deleted) {
    res.status(404).json({ error: 'Character not found or does not belong to this account' })
    return
  }
  res.json({ success: true })
})

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    players: gameState.playerCount,
    maxPlayers: MAX_PLAYERS,
    uptime: process.uptime(),
  })
})

app.get('/', (_req, res) => {
  res.json({
    name: 'World of Legends API',
    version: '0.3.0',
    status: 'online',
    protocol: 'WebSocket',
    ws: '/ws',
    health: '/health',
    auth: '/auth/register | /auth/login | /auth/me',
    characters: '/characters',
    players: `${gameState.playerCount}/${MAX_PLAYERS}`,
  })
})

// ─── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  handleConnection(ws, req, gameState, wss.clients, accounts)
})

// ─── Broadcast game state to all connected clients every 50ms (20 ticks/sec) ─

setInterval(() => {
  if (wss.clients.size === 0) return

  const state = gameState.getFullState()
  const data = JSON.stringify({ type: 'state', data: state })

  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(data)
    }
  }
}, 50)

// ─── NPC respawn + player respawn check every 1s ─────────────────────────────

setInterval(() => {
  if (wss.clients.size === 0) return

  // Check NPC respawns
  const respawnedNPCs = gameState.checkNPCRespawns()
  for (const npcId of respawnedNPCs) {
    const npc = gameState.npcs.find((n) => n.id === npcId)
    if (npc) {
      const msg = JSON.stringify({ type: 'npc_respawn', npcId, health: npc.health ?? npc.maxHealth ?? 30 })
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) {
          client.send(msg)
        }
      }
    }
  }

  // Check player respawns
  const respawnedPlayers = gameState.checkPlayerRespawns()
  for (const rp of respawnedPlayers) {
    const msg = JSON.stringify({
      type: 'player_respawn',
      playerId: rp.playerId,
      x: rp.x,
      y: rp.y,
      z: rp.z,
      health: rp.health,
    })
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(msg)
      }
    }
  }
}, 1000)

// ─── Cleanup disconnected/stale players every 5s ─────────────────────────────

setInterval(() => {
  const removed = gameState.cleanup()

  // Notify remaining clients about removed players
  if (removed.length > 0) {
    for (const playerId of removed) {
      const msg = JSON.stringify({ type: 'player_left', playerId })
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) {
          client.send(msg)
        }
      }
    }
  }
}, 5000)

// ─── Start auto-save (every 30s) ─────────────────────────────────────────────

gameState.startAutoSave()

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function gracefulShutdown(signal: string): void {
  console.log(`\n[WOL] Received ${signal}. Shutting down gracefully...`)

  // Save all player positions to disk
  gameState.saveAllToDisk()
  gameState.stopAutoSave()

  // Save account/character data
  accounts.saveAll()

  // Close all WebSocket connections
  for (const client of wss.clients) {
    client.close(1001, 'Server shutting down')
  }

  // Close the HTTP server
  server.close(() => {
    console.log('[WOL] Server closed. Goodbye!')
    process.exit(0)
  })

  // Force exit after 5 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('[WOL] Forced shutdown after timeout')
    process.exit(1)
  }, 5000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '8080', 10)

server.listen(PORT, () => {
  console.log(`[WOL] World of Legends Server v0.3.0 running on :${PORT}`)
  console.log(`[WOL] WebSocket endpoint: ws://localhost:${PORT}/ws`)
  console.log(`[WOL] Health check: http://localhost:${PORT}/health`)
  console.log(`[WOL] Auth: POST /auth/register | POST /auth/login | GET /auth/me`)
  console.log(`[WOL] Characters: POST /characters | GET /characters | DELETE /characters/:id`)
  console.log(`[WOL] Max players: ${MAX_PLAYERS}`)
  console.log(`[WOL] Auto-save: every 30s | Data: /tmp/wol-data/`)
})
