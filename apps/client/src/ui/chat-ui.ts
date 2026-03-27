/**
 * Chat UI module — handles visibility toggling and focus management.
 * The actual chat logic is in network/chat.ts.
 * This module just manages the DOM panel visibility.
 */

export function initChatUI(): void {
  const chatPanel = document.getElementById('chat-panel')!
  const chatInput = document.getElementById('chat-input') as HTMLInputElement

  // Show chat panel
  chatPanel.style.display = 'block'

  // Prevent canvas from capturing clicks on chat
  chatPanel.addEventListener('mousedown', (e) => e.stopPropagation())
  chatPanel.addEventListener('pointerdown', (e) => e.stopPropagation())

  // Focus management is handled by the controller module
  // (Enter to focus, Escape to unfocus)
}
