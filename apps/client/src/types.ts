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
  NPC,
  Quest,
  QuestObjective,
  PlayerQuestState,
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
  avatar?: import('./player/avatar.js').AnimatedAvatar
  targetX: number
  targetY: number
  targetZ: number
  targetRotY: number
  lastUpdate: number
  /** Track whether the remote player was moving last frame (for animation switching) */
  wasMoving?: boolean
}

export interface GameConfig {
  wsUrl: string
  apiUrl: string
  islandSize: number
  waterSize: number
}

export const DEFAULT_CONFIG: GameConfig = {
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws',
  apiUrl: import.meta.env.VITE_API_URL || 'https://wol-api.raregames.io',
  islandSize: 200,
  waterSize: 500,
}
