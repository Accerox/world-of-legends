// ─── Races & Classes ──────────────────────────────────────────────────────────

export const RACES = [
  'human', 'prismari', 'forjado', 'umbralis', 'draconid', 'sylvani', 'titan', 'kitsune',
] as const
export type Race = (typeof RACES)[number]

export const CLASSES = [
  'guardian', 'paladin', 'weaver', 'medium', 'berserker', 'stalker', 'monk', 'channeler', 'archer', 'chronomancer',
] as const
export type ClassName = (typeof CLASSES)[number]

// ─── Account & Character ──────────────────────────────────────────────────────

export interface Account {
  id: string
  email: string
  passwordHash: string
  createdAt: number
  lastLogin: number
}

export interface Character {
  id: string
  accountId: string
  name: string
  race: Race
  className: ClassName
  level: number
  xp: number
  gold: number
  health: number
  maxHealth: number
  x: number
  y: number
  z: number
  rotY: number
  createdAt: number
  playTime: number
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface PlayerState {
  id: string
  username: string
  x: number
  y: number
  z: number
  rotY: number
  lastUpdate: number
  health: number
  maxHealth: number
  xp: number
  gold: number
  level: number
  race: Race
  className: ClassName
  characterId?: string
  isDead?: boolean
  respawnAt?: number
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  username: string
  message: string
  timestamp: number
}

// ─── NPC ──────────────────────────────────────────────────────────────────────

export interface NPC {
  id: string
  name: string
  type: 'quest_giver' | 'merchant' | 'enemy'
  x: number
  y: number
  z: number
  rotY: number
  dialogue: string[]
  questId?: string
  health?: number
  maxHealth?: number
  respawnTime?: number
  isDead?: boolean
  diedAt?: number
}

// ─── Quest ────────────────────────────────────────────────────────────────────

export interface QuestObjective {
  type: 'kill' | 'reach' | 'interact'
  target: string
  count: number
  description: string
}

export interface Quest {
  id: string
  name: string
  description: string
  objectives: QuestObjective[]
  rewards: { xp: number; gold: number }
  giverNpcId: string
}

export interface PlayerQuestState {
  questId: string
  accepted: boolean
  progress: Record<number, number>
  completed: boolean
}

// ─── Game State ───────────────────────────────────────────────────────────────

export interface GameState {
  players: PlayerState[]
  chat: ChatMessage[]
  npcs: NPC[]
  serverTime: number
}

// ─── WebSocket Protocol — Client → Server ─────────────────────────────────────

export type ClientMessage =
  | { type: 'join'; username: string }
  | { type: 'join'; token: string; characterId: string }
  | { type: 'move'; x: number; y: number; z: number; rotY: number }
  | { type: 'chat'; message: string }
  | { type: 'leave' }
  | { type: 'attack'; targetId: string }
  | { type: 'interact'; targetId: string }
  | { type: 'accept_quest'; questId: string }

// ─── WebSocket Protocol — Server → Client ─────────────────────────────────────

export type ServerMessage =
  | { type: 'joined'; playerId: string; username: string; race: Race; className: ClassName; level: number; characterId?: string; playerCount: number; maxPlayers: number; gameState: GameState; quests: Quest[]; playerQuests: PlayerQuestState[] }
  | { type: 'state'; data: { players: PlayerState[]; chat: ChatMessage[]; npcs: NPC[] } }
  | { type: 'player_joined'; player: PlayerState }
  | { type: 'player_left'; playerId: string }
  | { type: 'chat'; message: ChatMessage }
  | { type: 'error'; message: string }
  | { type: 'damage'; targetId: string; damage: number; remainingHealth: number; attackerId: string }
  | { type: 'npc_died'; npcId: string; killerId: string }
  | { type: 'player_damage'; playerId: string; damage: number; remainingHealth: number; sourceId: string }
  | { type: 'player_died'; playerId: string }
  | { type: 'player_respawn'; playerId: string; x: number; y: number; z: number; health: number }
  | { type: 'npc_respawn'; npcId: string; health: number }
  | { type: 'quest_accepted'; questId: string }
  | { type: 'quest_update'; quests: PlayerQuestState[] }
  | { type: 'quest_progress'; questId: string; objectiveIndex: number; current: number; required: number }
  | { type: 'quest_complete'; questId: string; rewards: { xp: number; gold: number } }
  | { type: 'level_up'; playerId: string; newLevel: number; newMaxHealth: number }
  | { type: 'dialogue'; npcId: string; npcName: string; lines: string[]; questId?: string }
  | { type: 'quest_available'; quest: Quest }

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
