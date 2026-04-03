import type { PlayerState, ChatMessage, GameState, ServerMessage, NPC, Quest, PlayerQuestState, ClientMessage } from '../types.js'

/**
 * Callbacks for network events.
 */
export interface NetworkCallbacks {
  onStateUpdate: (state: { players: PlayerState[]; chat: ChatMessage[]; npcs: NPC[] }) => void
  onChatMessage: (msg: ChatMessage) => void
  onPlayerJoined: (player: PlayerState) => void
  onPlayerLeft: (id: string) => void
  onDisconnect: () => void
  // Combat events
  onDamage: (data: { targetId: string; damage: number; remainingHealth: number; attackerId: string }) => void
  onNpcDied: (data: { npcId: string; killerId: string }) => void
  onPlayerDamage: (data: { playerId: string; damage: number; remainingHealth: number; sourceId: string }) => void
  onPlayerDied: (data: { playerId: string }) => void
  onPlayerRespawn: (data: { playerId: string; x: number; y: number; z: number; health: number }) => void
  onNpcRespawn: (data: { npcId: string; health: number }) => void
   // Quest events
  onQuestAccepted: (data: { questId: string }) => void
  onQuestUpdate: (data: { quests: any[] }) => void
  onQuestProgress: (data: { questId: string; objectiveIndex: number; current: number; required: number }) => void
  onQuestComplete: (data: { questId: string; rewards: { xp: number; gold: number } }) => void
  onLevelUp: (data: { playerId: string; newLevel: number; newMaxHealth: number }) => void
  // Dialogue events
  onDialogue: (data: { npcId: string; npcName: string; lines: string[]; questId?: string }) => void
  onQuestAvailable: (data: { quest: Quest }) => void
}

/**
 * Join response from the server.
 */
export interface JoinResult {
  playerId: string
  username: string
  race: string
  className: string
  level: number
  characterId?: string
  playerCount: number
  maxPlayers: number
  gameState: GameState
  quests: Quest[]
  playerQuests: PlayerQuestState[]
}

/**
 * Network client for communicating with the WOL server via WebSocket.
 * Replaces the old HTTP polling approach with persistent WebSocket connection.
 */
export class NetworkClient {
  private ws: WebSocket | null = null
  private callbacks: Partial<NetworkCallbacks> = {}
  private _playerId: string = ''

  /**
   * Connect to the server and join the game.
   * Supports both legacy (username) and auth (token + characterId) modes.
   */
  connect(serverUrl: string, tokenOrUsername: string, characterId?: string): Promise<JoinResult> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(serverUrl)
      } catch (err) {
        reject(new Error('Failed to create WebSocket connection'))
        return
      }

      const timeout = setTimeout(() => {
        this.ws?.close()
        reject(new Error('Connection timed out'))
      }, 10_000)

      this.ws.onopen = () => {
        // Send join message once connected
        if (characterId) {
          // Auth mode: send token + characterId
          this.ws!.send(JSON.stringify({ type: 'join', token: tokenOrUsername, characterId }))
        } else {
          // Legacy mode: send username
          this.ws!.send(JSON.stringify({ type: 'join', username: tokenOrUsername }))
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage

          switch (msg.type) {
            case 'joined':
              clearTimeout(timeout)
              this._playerId = msg.playerId
              resolve({
                playerId: msg.playerId,
                username: msg.username,
                race: msg.race ?? 'human',
                className: msg.className ?? 'guardian',
                level: msg.level ?? 1,
                characterId: msg.characterId,
                playerCount: msg.playerCount,
                maxPlayers: msg.maxPlayers,
                gameState: msg.gameState,
                quests: msg.quests ?? [],
                playerQuests: msg.playerQuests ?? [],
              })
              break

            case 'state':
              this.callbacks.onStateUpdate?.(msg.data)
              break

            case 'chat':
              this.callbacks.onChatMessage?.(msg.message)
              break

            case 'player_joined':
              this.callbacks.onPlayerJoined?.(msg.player)
              break

            case 'player_left':
              this.callbacks.onPlayerLeft?.(msg.playerId)
              break

            // ─── Combat events ──────────────────────────────────────────────
            case 'damage':
              this.callbacks.onDamage?.({ targetId: msg.targetId, damage: msg.damage, remainingHealth: msg.remainingHealth, attackerId: msg.attackerId })
              break

            case 'npc_died':
              this.callbacks.onNpcDied?.({ npcId: msg.npcId, killerId: msg.killerId })
              break

            case 'player_damage':
              this.callbacks.onPlayerDamage?.({ playerId: msg.playerId, damage: msg.damage, remainingHealth: msg.remainingHealth, sourceId: msg.sourceId })
              break

            case 'player_died':
              this.callbacks.onPlayerDied?.({ playerId: msg.playerId })
              break

            case 'player_respawn':
              this.callbacks.onPlayerRespawn?.({ playerId: msg.playerId, x: msg.x, y: msg.y, z: msg.z, health: msg.health })
              break

            case 'npc_respawn':
              this.callbacks.onNpcRespawn?.({ npcId: msg.npcId, health: msg.health })
              break

            // ─── Quest events ───────────────────────────────────────────────
            case 'quest_accepted':
              this.callbacks.onQuestAccepted?.({ questId: msg.questId })
              break

            case 'quest_update':
              this.callbacks.onQuestUpdate?.({ quests: msg.quests })
              break

            case 'quest_progress':
              this.callbacks.onQuestProgress?.({ questId: msg.questId, objectiveIndex: msg.objectiveIndex, current: msg.current, required: msg.required })
              break

            case 'quest_complete':
              this.callbacks.onQuestComplete?.({ questId: msg.questId, rewards: msg.rewards })
              break

            case 'level_up':
              this.callbacks.onLevelUp?.({ playerId: msg.playerId, newLevel: msg.newLevel, newMaxHealth: msg.newMaxHealth })
              break

            // ─── Dialogue events ────────────────────────────────────────────
            case 'dialogue':
              this.callbacks.onDialogue?.({ npcId: msg.npcId, npcName: msg.npcName, lines: msg.lines, questId: msg.questId })
              break

            case 'quest_available':
              this.callbacks.onQuestAvailable?.({ quest: msg.quest })
              break

            case 'error':
              // If we haven't joined yet, reject the promise
              if (!this._playerId) {
                clearTimeout(timeout)
                reject(new Error(msg.message))
              } else {
                console.warn('[WOL] Server error:', msg.message)
              }
              break
          }
        } catch (err) {
          console.warn('[WOL] Failed to parse server message:', err)
        }
      }

      this.ws.onerror = () => {
        clearTimeout(timeout)
        if (!this._playerId) {
          reject(new Error('Connection failed'))
        }
      }

      this.ws.onclose = () => {
        clearTimeout(timeout)
        if (this._playerId) {
          this.callbacks.onDisconnect?.()
        } else {
          reject(new Error('Connection closed'))
        }
      }
    })
  }

  /**
   * Set event callbacks. Call after connect() resolves.
   */
  setCallbacks(callbacks: Partial<NetworkCallbacks>): void {
    this.callbacks = callbacks
  }

  /**
   * Send position update to the server.
   * WebSocket is cheap — no request limit like HTTP polling.
   */
  sendPosition(x: number, y: number, z: number, rotY: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'move', x, y, z, rotY }))
    }
  }

  /**
   * Send a chat message.
   */
  sendChat(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat', message }))
    }
  }

  /**
   * Send an attack command targeting an NPC or entity.
   */
  sendAttack(targetId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'attack', targetId }))
    }
  }

  /**
   * Send an interact command (talk to NPC).
   */
  sendInteract(targetId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interact', targetId }))
    }
  }

  /**
   * Send a quest accept command.
   */
  sendAcceptQuest(questId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'accept_quest', questId }))
    }
  }

  /**
   * Send a raw client message (for extensibility).
   */
  sendRaw(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'leave' }))
      }
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Alias for disconnect (backward compat with old API).
   */
  leave(): void {
    this.disconnect()
  }

  get currentPlayerId(): string {
    return this._playerId
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
