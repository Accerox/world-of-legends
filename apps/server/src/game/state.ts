import { randomUUID } from 'crypto'
import type { PlayerState, ChatMessage } from '../types.js'

const MAX_CHAT = 100
const PLAYER_TIMEOUT_MS = 30_000 // 30 seconds — auto-cleanup for disconnected players

/**
 * In-memory game state.
 * Manages all players and chat messages. Single instance per server.
 */
export class GameState {
  private players = new Map<string, PlayerState>()
  private chat: ChatMessage[] = []

  // ─── Players ──────────────────────────────────────────────────────────────

  addPlayer(id: string, username: string): PlayerState {
    // Spawn at random position on the island (center area)
    const spawnX = (Math.random() - 0.5) * 40 // -20 to 20
    const spawnZ = (Math.random() - 0.5) * 40
    const spawnY = 5 // Will be adjusted client-side to terrain height

    const player: PlayerState = {
      id,
      username,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      rotY: 0,
      lastUpdate: Date.now(),
    }

    this.players.set(id, player)
    return player
  }

  removePlayer(id: string): void {
    this.players.delete(id)
  }

  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id)
  }

  updatePosition(id: string, x: number, y: number, z: number, rotY: number): void {
    const player = this.players.get(id)
    if (!player) return

    // Clamp position values to prevent cheating / garbage data
    player.x = clamp(x, -250, 250)
    player.y = clamp(y, -10, 100)
    player.z = clamp(z, -250, 250)
    player.rotY = rotY ?? 0
    player.lastUpdate = Date.now()
  }

  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values())
  }

  get playerCount(): number {
    return this.players.size
  }

  // ─── Chat ─────────────────────────────────────────────────────────────────

  addChatMessage(playerId: string, message: string): ChatMessage | null {
    const player = this.players.get(playerId)
    if (!player) return null

    const trimmed = message.trim()
    if (!trimmed || trimmed.length === 0) return null
    if (trimmed.length > 200) return null

    const chatMsg: ChatMessage = {
      id: randomUUID(),
      username: player.username,
      message: trimmed.slice(0, 200),
      timestamp: Date.now(),
    }

    this.chat.push(chatMsg)

    // Keep only last MAX_CHAT messages
    if (this.chat.length > MAX_CHAT) {
      this.chat = this.chat.slice(-MAX_CHAT)
    }

    return chatMsg
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chat]
  }

  // ─── Full State ───────────────────────────────────────────────────────────

  getFullState(): { players: PlayerState[]; chat: ChatMessage[] } {
    return {
      players: this.getAllPlayers(),
      chat: this.getChatHistory(),
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  /**
   * Remove players whose lastUpdate is older than PLAYER_TIMEOUT_MS.
   * Returns the IDs of removed players.
   */
  cleanup(): string[] {
    const now = Date.now()
    const removed: string[] = []

    for (const [id, player] of this.players) {
      if (now - player.lastUpdate > PLAYER_TIMEOUT_MS) {
        this.players.delete(id)
        removed.push(id)
        console.log(`[WOL] Cleaned up stale player: ${player.username} (${id})`)
      }
    }

    return removed
  }
}

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0
  return Math.max(min, Math.min(max, value))
}
