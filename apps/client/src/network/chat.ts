import type { ChatMessage } from '../types.js'
import type { NetworkClient } from './client.js'

const MAX_DISPLAYED_MESSAGES = 30

/**
 * Chat system — manages chat messages and UI interaction.
 */
export class ChatSystem {
  private messages: ChatMessage[] = []
  private messagesDiv: HTMLElement
  private inputEl: HTMLInputElement
  private sendBtn: HTMLElement
  private network: NetworkClient

  constructor(network: NetworkClient) {
    this.network = network
    this.messagesDiv = document.getElementById('chat-messages')!
    this.inputEl = document.getElementById('chat-input') as HTMLInputElement
    this.sendBtn = document.getElementById('chat-send')!

    this.setupListeners()
  }

  private setupListeners(): void {
    // Send on button click
    this.sendBtn.addEventListener('click', () => this.send())

    // Send on Enter key
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.send()
      }
    })
  }

  /**
   * Send the current input as a chat message.
   */
  private send(): void {
    const text = this.inputEl.value.trim()
    if (!text) return

    this.inputEl.value = ''
    this.network.sendChat(text)
  }

  /**
   * Add a single message received from the server (WebSocket push).
   */
  addMessage(msg: ChatMessage): void {
    // Deduplicate by ID
    if (this.messages.some((m) => m.id === msg.id)) return
    this.messages.push(msg)

    // Trim to max
    if (this.messages.length > MAX_DISPLAYED_MESSAGES) {
      this.messages = this.messages.slice(-MAX_DISPLAYED_MESSAGES)
    }

    this.render()
  }

  /**
   * Add multiple messages (for batch updates from state sync).
   */
  addMessages(newMessages: ChatMessage[]): void {
    for (const msg of newMessages) {
      // Deduplicate by ID
      if (this.messages.some((m) => m.id === msg.id)) continue
      this.messages.push(msg)
    }

    // Trim to max
    if (this.messages.length > MAX_DISPLAYED_MESSAGES) {
      this.messages = this.messages.slice(-MAX_DISPLAYED_MESSAGES)
    }

    this.render()
  }

  /**
   * Add a system message (join/leave notifications, etc.).
   */
  addSystemMessage(text: string): void {
    this.messages.push({
      id: `sys_${Date.now()}`,
      username: '',
      message: text,
      timestamp: Date.now(),
    })
    this.render()
  }

  /**
   * Render messages to the DOM.
   */
  private render(): void {
    this.messagesDiv.innerHTML = this.messages
      .map((msg) => {
        if (!msg.username) {
          // System message
          return `<div class="msg"><span class="system">${escapeHtml(msg.message)}</span></div>`
        }
        return `<div class="msg"><span class="name">${escapeHtml(msg.username)}:</span> ${escapeHtml(msg.message)}</div>`
      })
      .join('')

    // Auto-scroll to bottom
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight
  }

  /**
   * Load initial chat history.
   */
  loadHistory(messages: ChatMessage[]): void {
    this.messages = messages.slice(-MAX_DISPLAYED_MESSAGES)
    this.render()
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
