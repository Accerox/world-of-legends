import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { GameState } from './game/state.js'
import { handleConnection } from './ws/handler.js'

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express()
const server = createServer(app)
const gameState = new GameState()

// ─── CORS ─────────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://wol.raregames.io',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400,
  }),
)

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    players: gameState.playerCount,
    uptime: process.uptime(),
  })
})

app.get('/', (_req, res) => {
  res.json({
    name: 'World of Legends API',
    version: '0.1.0',
    status: 'online',
    protocol: 'WebSocket',
    ws: '/ws',
    health: '/health',
  })
})

// ─── WebSocket server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws, req) => {
  handleConnection(ws, req, gameState, wss.clients)
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

// ─── Start server ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '8080', 10)

server.listen(PORT, () => {
  console.log(`[WOL] World of Legends Server running on :${PORT}`)
  console.log(`[WOL] WebSocket endpoint: ws://localhost:${PORT}/ws`)
  console.log(`[WOL] Health check: http://localhost:${PORT}/health`)
})
