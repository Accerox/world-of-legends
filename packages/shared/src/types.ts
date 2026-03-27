// ─── Player ───────────────────────────────────────────────────────────────────

export interface PlayerState {
  id: string
  username: string
  x: number
  y: number
  z: number
  rotY: number
  lastUpdate: number
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  username: string
  message: string
  timestamp: number
}

// ─── Game State ───────────────────────────────────────────────────────────────

export interface GameState {
  players: PlayerState[]
  chat: ChatMessage[]
  serverTime: number
}

// ─── WebSocket Protocol — Client → Server ─────────────────────────────────────

export type ClientMessage =
  | { type: 'join'; username: string }
  | { type: 'move'; x: number; y: number; z: number; rotY: number }
  | { type: 'chat'; message: string }
  | { type: 'leave' }

// ─── WebSocket Protocol — Server → Client ─────────────────────────────────────

export type ServerMessage =
  | { type: 'joined'; playerId: string; username: string; gameState: GameState }
  | { type: 'state'; data: { players: PlayerState[]; chat: ChatMessage[] } }
  | { type: 'player_joined'; player: PlayerState }
  | { type: 'player_left'; playerId: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'error'; message: string }

// ─── Legacy types (kept for backward compat) ─────────────────────────────────

export interface JoinRequest {
  username: string
}

export interface JoinResponse {
  playerId: string
  username: string
  gameState: GameState
}

export interface TickRequest {
  x: number
  y: number
  z: number
  rotY: number
}

export interface TickResponse {
  players: PlayerState[]
  chat: ChatMessage[]
  serverTime: number
}

export interface ChatSendRequest {
  message: string
}

// ─── Session (server-side) ────────────────────────────────────────────────────

export interface SessionData {
  playerId: string
  username: string
  joinedAt: number
}

// ─── Player Record (server-side in-memory) ───────────────────────────────────

export interface PlayerRecord {
  x: number
  y: number
  z: number
  rotY: number
  username: string
  lastUpdate: number
}
