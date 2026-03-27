// Re-export shared types
export type {
  PlayerState,
  ChatMessage,
  GameState,
  JoinResponse,
  TickRequest,
  TickResponse,
  ChatSendRequest,
  ClientMessage,
  ServerMessage,
} from '@wol/shared'

// ─── Client-specific types ────────────────────────────────────────────────────

export interface LocalPlayer {
  id: string
  username: string
}

export interface RemotePlayerMesh {
  id: string
  username: string
  mesh: import('@babylonjs/core/Meshes/mesh').Mesh
  targetX: number
  targetY: number
  targetZ: number
  targetRotY: number
  lastUpdate: number
}

export interface GameConfig {
  wsUrl: string
  islandSize: number
  waterSize: number
}

export const DEFAULT_CONFIG: GameConfig = {
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
  islandSize: 200,
  waterSize: 500,
}
