import type { PlayerState, ChatMessage, GameState, ServerMessage } from '../types.js'

/**
 * Callbacks for network events.
 */
export interface NetworkCallbacks {
  onStateUpdate: (state: { players: PlayerState[]; chat: ChatMessage[] }) => void
  onChatMessage: (msg: ChatMessage) => void
  onPlayerJoined: (player: PlayerState) => void
  onPlayerLeft: (id: string) => void
  onDisconnect: () => void
}

/**
 * Join response from the server.
 */
export interface JoinResult {
  playerId: string
  username: string
  gameState: GameState
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
   */
  connect(serverUrl: string, username: string): Promise<JoinResult> {
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
        this.ws!.send(JSON.stringify({ type: 'join', username }))
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
                gameState: msg.gameState,
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
