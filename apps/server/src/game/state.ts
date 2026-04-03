import { randomUUID } from 'crypto'
import type { PlayerState, ChatMessage, NPC, PlayerQuestState, Quest, Race, ClassName, Character } from '../types.js'
import { loadPlayerData, savePlayerData } from './persistence.js'
import type { SavedPlayer } from './persistence.js'
import { ISLAND_NPCS } from './npcs.js'
import { QUESTS, QUEST_LOCATIONS } from './quests.js'

export const MAX_PLAYERS = 50
const MAX_CHAT = 100
const PLAYER_TIMEOUT_MS = 30_000 // 30 seconds — auto-cleanup for disconnected players
const AUTO_SAVE_INTERVAL_MS = 30_000 // 30 seconds
const PLAYER_RESPAWN_MS = 5_000 // 5 seconds
const XP_PER_LEVEL = 100

/**
 * In-memory game state.
 * Manages all players, NPCs, quests, combat, and chat messages.
 */
export class GameState {
  private players = new Map<string, PlayerState>()
  private chat: ChatMessage[] = []
  private savedData: Map<string, SavedPlayer>
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null

  /** Live NPC state (mutable copy of ISLAND_NPCS) */
  npcs: NPC[]

  /** Per-player quest progress: playerId -> quest states */
  private playerQuests = new Map<string, PlayerQuestState[]>()

  constructor() {
    this.savedData = loadPlayerData()
    // Deep-clone NPC definitions so we can mutate health/isDead
    this.npcs = ISLAND_NPCS.map((npc) => ({ ...npc }))
  }

  // ─── Capacity ─────────────────────────────────────────────────────────────

  isFull(): boolean {
    return this.players.size >= MAX_PLAYERS
  }

  // ─── Players ──────────────────────────────────────────────────────────────

  addPlayer(id: string, username: string, opts?: {
    race?: Race
    className?: ClassName
    characterId?: string
    character?: Character
  }): PlayerState {
    const race: Race = opts?.race ?? 'human'
    const className: ClassName = opts?.className ?? 'guardian'
    const characterId = opts?.characterId
    const character = opts?.character

    let spawnX: number
    let spawnY: number
    let spawnZ: number
    let spawnRotY: number
    let health: number
    let maxHealth: number
    let xp: number
    let gold: number
    let level: number

    // If we have a character, restore from character data
    if (character) {
      spawnX = character.x
      spawnY = character.y
      spawnZ = character.z
      spawnRotY = character.rotY
      health = character.health
      maxHealth = character.maxHealth
      xp = character.xp
      gold = character.gold
      level = character.level
      console.log(`[WOL] Restored character ${character.name}: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`)
    } else {
      // Legacy fallback: check old saved data by username
      const savedKey = username.toLowerCase()
      const saved = this.savedData.get(savedKey)

      if (saved) {
        spawnX = saved.x
        spawnY = saved.y
        spawnZ = saved.z
        spawnRotY = saved.rotY
        console.log(`[WOL] Restored position for ${username}: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`)
      } else {
        spawnX = (Math.random() - 0.5) * 40
        spawnZ = (Math.random() - 0.5) * 40
        spawnY = 5
        spawnRotY = 0
      }
      health = 100
      maxHealth = 100
      xp = 0
      gold = 0
      level = 1
    }

    const player: PlayerState = {
      id,
      username,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      rotY: spawnRotY,
      lastUpdate: Date.now(),
      health,
      maxHealth,
      xp,
      gold,
      level,
      race,
      className,
      characterId,
    }

    this.players.set(id, player)

    // Initialize empty quest state for this player
    if (!this.playerQuests.has(id)) {
      this.playerQuests.set(id, [])
    }

    return player
  }

  removePlayer(id: string): void {
    const player = this.players.get(id)
    if (player) {
      this.savePlayerPosition(player)
    }
    this.players.delete(id)
    this.playerQuests.delete(id)
  }

  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id)
  }

  updatePosition(id: string, x: number, y: number, z: number, rotY: number): void {
    const player = this.players.get(id)
    if (!player) return
    if (player.isDead) return // Can't move while dead

    player.x = clamp(x, -250, 250)
    player.y = clamp(y, -10, 100)
    player.z = clamp(z, -250, 250)
    player.rotY = rotY ?? 0
    player.lastUpdate = Date.now()

    // Check reach-type quest objectives
    this.checkReachObjectives(id)
  }

  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values())
  }

  get playerCount(): number {
    return this.players.size
  }

  // ─── NPC Combat ───────────────────────────────────────────────────────────

  /**
   * Player attacks an NPC enemy.
   * Returns damage dealt, or null if attack is invalid.
   */
  attackNPC(playerId: string, targetId: string): { damage: number; killed: boolean; npc: NPC } | null {
    const player = this.players.get(playerId)
    if (!player || player.isDead) return null

    const npc = this.npcs.find((n) => n.id === targetId)
    if (!npc || npc.type !== 'enemy' || npc.isDead) return null

    // Check distance (must be within 3 units)
    const dx = player.x - npc.x
    const dz = player.z - npc.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > 5) return null  // 5 units melee range

    // Deal 10-15 random damage
    const damage = 10 + Math.floor(Math.random() * 6)
    npc.health = Math.max(0, (npc.health ?? 0) - damage)

    const killed = npc.health <= 0
    if (killed) {
      npc.isDead = true
      npc.diedAt = Date.now()

      // Track kill for quest progress
      this.trackKill(playerId, npc)
    }

    return { damage, killed, npc }
  }

  /**
   * NPC retaliates against the player.
   * Returns damage dealt, or null if player is dead.
   */
  npcRetaliate(playerId: string, npcId: string): { damage: number; playerDied: boolean } | null {
    const player = this.players.get(playerId)
    if (!player || player.isDead) return null

    const npc = this.npcs.find((n) => n.id === npcId)
    if (!npc || npc.isDead) return null

    // Enemy deals 5-10 damage back
    const damage = 5 + Math.floor(Math.random() * 6)
    player.health = Math.max(0, player.health - damage)

    const playerDied = player.health <= 0
    if (playerDied) {
      player.isDead = true
      player.respawnAt = Date.now() + PLAYER_RESPAWN_MS
    }

    return { damage, playerDied }
  }

  /**
   * Check and respawn dead NPCs whose respawn time has elapsed.
   * Returns IDs of respawned NPCs.
   */
  checkNPCRespawns(): string[] {
    const now = Date.now()
    const respawned: string[] = []

    for (const npc of this.npcs) {
      if (npc.isDead && npc.diedAt && npc.respawnTime) {
        if (now - npc.diedAt >= npc.respawnTime * 1000) {
          npc.isDead = false
          npc.diedAt = undefined
          npc.health = npc.maxHealth ?? 30
          respawned.push(npc.id)
          console.log(`[WOL] NPC respawned: ${npc.name} (${npc.id})`)
        }
      }
    }

    return respawned
  }

  /**
   * Check and respawn dead players whose respawn time has elapsed.
   * Returns respawned player data.
   */
  checkPlayerRespawns(): { playerId: string; x: number; y: number; z: number; health: number }[] {
    const now = Date.now()
    const respawned: { playerId: string; x: number; y: number; z: number; health: number }[] = []

    for (const player of this.players.values()) {
      if (player.isDead && player.respawnAt && now >= player.respawnAt) {
        player.isDead = false
        player.respawnAt = undefined
        player.health = player.maxHealth
        // Respawn at island center
        player.x = 0
        player.y = 5
        player.z = 0
        respawned.push({
          playerId: player.id,
          x: player.x,
          y: player.y,
          z: player.z,
          health: player.health,
        })
        console.log(`[WOL] Player respawned: ${player.username}`)
      }
    }

    return respawned
  }

  // ─── NPC Interaction ──────────────────────────────────────────────────────

  /**
   * Player interacts with an NPC (talk).
   * Returns dialogue lines and quest info, or null if invalid.
   */
  interactNPC(playerId: string, targetId: string): { npc: NPC; quest?: Quest } | null {
    const player = this.players.get(playerId)
    if (!player || player.isDead) return null

    const npc = this.npcs.find((n) => n.id === targetId)
    if (!npc || npc.isDead) return null
    if (npc.type === 'enemy') return null // Can't talk to enemies

    // Check distance (must be within 5 units)
    const dx = player.x - npc.x
    const dz = player.z - npc.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist > 5) return null

    let quest: Quest | undefined
    if (npc.questId) {
      quest = QUESTS.find((q) => q.id === npc.questId)
    }

    return { npc, quest }
  }

  // ─── Quests ───────────────────────────────────────────────────────────────

  getPlayerQuests(playerId: string): PlayerQuestState[] {
    return this.playerQuests.get(playerId) ?? []
  }

  getAllQuests(): Quest[] {
    return QUESTS
  }

  /**
   * Player accepts a quest.
   * Returns true if accepted, false if already accepted or invalid.
   */
  acceptQuest(playerId: string, questId: string): boolean {
    const player = this.players.get(playerId)
    if (!player) return false

    const quest = QUESTS.find((q) => q.id === questId)
    if (!quest) return false

    const quests = this.playerQuests.get(playerId) ?? []

    // Check if already accepted
    if (quests.some((q) => q.questId === questId)) return false

    const progress: Record<number, number> = {}
    for (let i = 0; i < quest.objectives.length; i++) {
      progress[i] = 0
    }

    quests.push({
      questId,
      accepted: true,
      progress,
      completed: false,
    })

    this.playerQuests.set(playerId, quests)
    console.log(`[WOL] ${player.username} accepted quest: ${quest.name}`)
    return true
  }

  /**
   * Track a kill for quest progress.
   * Returns quest progress updates.
   */
  private trackKill(playerId: string, npc: NPC): { questId: string; objectiveIndex: number; current: number; required: number }[] {
    const quests = this.playerQuests.get(playerId) ?? []
    const updates: { questId: string; objectiveIndex: number; current: number; required: number }[] = []

    for (const pq of quests) {
      if (pq.completed) continue

      const quest = QUESTS.find((q) => q.id === pq.questId)
      if (!quest) continue

      for (let i = 0; i < quest.objectives.length; i++) {
        const obj = quest.objectives[i]
        if (obj.type !== 'kill') continue

        // Check if the killed NPC matches the objective target
        // Match by NPC id prefix (e.g., 'slime' matches 'slime_1', 'slime_2', etc.)
        if (npc.id.startsWith(obj.target)) {
          pq.progress[i] = Math.min((pq.progress[i] ?? 0) + 1, obj.count)
          updates.push({
            questId: pq.questId,
            objectiveIndex: i,
            current: pq.progress[i],
            required: obj.count,
          })
        }
      }
    }

    return updates
  }

  /**
   * Get kill-related quest progress updates for a player after a kill.
   * Called from handler after attackNPC kills an enemy.
   */
  getKillQuestUpdates(playerId: string, npc: NPC): { questId: string; objectiveIndex: number; current: number; required: number }[] {
    return this.trackKill(playerId, npc)
  }

  /**
   * Check reach-type quest objectives for a player at their current position.
   * Returns quest progress updates.
   */
  private checkReachObjectives(playerId: string): { questId: string; objectiveIndex: number; current: number; required: number }[] {
    const player = this.players.get(playerId)
    if (!player) return []

    const quests = this.playerQuests.get(playerId) ?? []
    const updates: { questId: string; objectiveIndex: number; current: number; required: number }[] = []

    for (const pq of quests) {
      if (pq.completed) continue

      const quest = QUESTS.find((q) => q.id === pq.questId)
      if (!quest) continue

      for (let i = 0; i < quest.objectives.length; i++) {
        const obj = quest.objectives[i]
        if (obj.type !== 'reach') continue
        if ((pq.progress[i] ?? 0) >= obj.count) continue // Already completed

        const loc = QUEST_LOCATIONS[obj.target]
        if (!loc) continue

        const dx = player.x - loc.x
        const dz = player.z - loc.z
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist <= loc.radius) {
          pq.progress[i] = obj.count
          updates.push({
            questId: pq.questId,
            objectiveIndex: i,
            current: pq.progress[i],
            required: obj.count,
          })
        }
      }
    }

    return updates
  }

  /**
   * Check if a quest is fully completed and award rewards.
   * Returns completed quest info or null.
   */
  checkQuestCompletion(playerId: string, questId: string): { quest: Quest; rewards: { xp: number; gold: number } } | null {
    const player = this.players.get(playerId)
    if (!player) return null

    const quests = this.playerQuests.get(playerId) ?? []
    const pq = quests.find((q) => q.questId === questId)
    if (!pq || pq.completed) return null

    const quest = QUESTS.find((q) => q.id === questId)
    if (!quest) return null

    // Check all objectives are met
    for (let i = 0; i < quest.objectives.length; i++) {
      if ((pq.progress[i] ?? 0) < quest.objectives[i].count) {
        return null // Not all objectives met
      }
    }

    // Quest complete!
    pq.completed = true

    // Award rewards
    player.xp += quest.rewards.xp
    player.gold += quest.rewards.gold

    console.log(`[WOL] ${player.username} completed quest: ${quest.name} (+${quest.rewards.xp} XP, +${quest.rewards.gold} gold)`)

    return { quest, rewards: quest.rewards }
  }

  /**
   * Check if player should level up.
   * Returns new level info or null.
   */
  checkLevelUp(playerId: string): { newLevel: number; newMaxHealth: number } | null {
    const player = this.players.get(playerId)
    if (!player) return null

    const expectedLevel = Math.floor(player.xp / XP_PER_LEVEL) + 1
    if (expectedLevel > player.level) {
      player.level = expectedLevel
      player.maxHealth = 100 + (player.level - 1) * 10
      player.health = player.maxHealth // Full heal on level up
      console.log(`[WOL] ${player.username} leveled up to ${player.level}!`)
      return { newLevel: player.level, newMaxHealth: player.maxHealth }
    }

    return null
  }

  /**
   * Get reach quest updates for a player (called from handler after position update).
   */
  getReachQuestUpdates(playerId: string): { questId: string; objectiveIndex: number; current: number; required: number }[] {
    return this.checkReachObjectives(playerId)
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

    if (this.chat.length > MAX_CHAT) {
      this.chat = this.chat.slice(-MAX_CHAT)
    }

    return chatMsg
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chat]
  }

  // ─── Full State ───────────────────────────────────────────────────────────

  getFullState(): { players: PlayerState[]; chat: ChatMessage[]; npcs: NPC[] } {
    return {
      players: this.getAllPlayers(),
      chat: this.getChatHistory(),
      npcs: this.npcs.map((npc) => ({ ...npc })),
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  cleanup(): string[] {
    const now = Date.now()
    const removed: string[] = []

    for (const [id, player] of this.players) {
      if (now - player.lastUpdate > PLAYER_TIMEOUT_MS) {
        this.savePlayerPosition(player)
        this.players.delete(id)
        this.playerQuests.delete(id)
        removed.push(id)
        console.log(`[WOL] Cleaned up stale player: ${player.username} (${id})`)
      }
    }

    return removed
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  private savePlayerPosition(player: PlayerState): void {
    const key = player.username.toLowerCase()
    this.savedData.set(key, {
      username: player.username,
      x: player.x,
      y: player.y,
      z: player.z,
      rotY: player.rotY,
      lastSeen: Date.now(),
    })
  }

  saveAllToDisk(): void {
    for (const player of this.players.values()) {
      this.savePlayerPosition(player)
    }
    savePlayerData(this.savedData)
  }

  startAutoSave(): void {
    if (this.autoSaveTimer) return
    this.autoSaveTimer = setInterval(() => {
      if (this.players.size > 0) {
        this.saveAllToDisk()
      }
    }, AUTO_SAVE_INTERVAL_MS)
    console.log(`[WOL] Auto-save enabled (every ${AUTO_SAVE_INTERVAL_MS / 1000}s)`)
  }

  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0
  return Math.max(min, Math.min(max, value))
}
