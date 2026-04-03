import type { NetworkClient } from '../network/client.js'
import type { Quest } from '../types.js'

/**
 * Dialogue UI — shows NPC dialogue in a panel at the bottom center of the screen.
 */

let dialoguePanel: HTMLDivElement | null = null
let currentLines: string[] = []
let currentLineIndex = 0
let currentQuestId: string | undefined
let currentQuest: Quest | undefined
let isOpen = false
let networkRef: NetworkClient | null = null

/**
 * Initialize the dialogue system.
 */
export function initDialogueUI(network: NetworkClient): void {
  networkRef = network
  createDialoguePanel()

  // Close on Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeDialogue()
    }
  })
}

function createDialoguePanel(): void {
  dialoguePanel = document.createElement('div')
  dialoguePanel.id = 'dialogue-panel'
  dialoguePanel.style.cssText = `
    position: absolute;
    bottom: 220px;
    left: 50%;
    transform: translateX(-50%);
    width: 500px;
    max-width: 90vw;
    background: rgba(0, 0, 0, 0.85);
    border: 2px solid rgba(255, 215, 0, 0.4);
    border-radius: 12px;
    padding: 16px 20px;
    color: #e0e0ff;
    font-family: 'Segoe UI', sans-serif;
    z-index: 30;
    display: none;
    pointer-events: auto;
  `

  dialoguePanel.innerHTML = `
    <div id="dialogue-npc-name" style="color: #ffd700; font-weight: 700; font-size: 1.1rem; margin-bottom: 8px;"></div>
    <div id="dialogue-text" style="font-size: 0.95rem; line-height: 1.5; margin-bottom: 12px; min-height: 40px;"></div>
    <div id="dialogue-buttons" style="display: flex; gap: 8px; justify-content: flex-end;"></div>
  `

  // Prevent clicks from going through to canvas
  dialoguePanel.addEventListener('mousedown', (e) => e.stopPropagation())
  dialoguePanel.addEventListener('pointerdown', (e) => e.stopPropagation())

  document.body.appendChild(dialoguePanel)
}

/**
 * Show dialogue from an NPC.
 */
export function showDialogue(npcName: string, lines: string[], questId?: string): void {
  if (!dialoguePanel) return

  currentLines = lines
  currentLineIndex = 0
  currentQuestId = questId
  currentQuest = undefined
  isOpen = true

  const nameEl = document.getElementById('dialogue-npc-name')!
  nameEl.textContent = npcName

  dialoguePanel.style.display = 'block'
  updateDialogueContent()
}

/**
 * Set the available quest for the current dialogue (called when quest_available message arrives).
 */
export function setAvailableQuest(quest: Quest): void {
  currentQuest = quest
}

function updateDialogueContent(): void {
  const textEl = document.getElementById('dialogue-text')!
  const buttonsEl = document.getElementById('dialogue-buttons')!

  textEl.textContent = currentLines[currentLineIndex] ?? ''

  buttonsEl.innerHTML = ''

  const isLastLine = currentLineIndex >= currentLines.length - 1

  if (!isLastLine) {
    // "Next" button
    const nextBtn = createButton('Next >', () => {
      currentLineIndex++
      updateDialogueContent()
    })
    buttonsEl.appendChild(nextBtn)
  } else {
    // Last line — show quest accept or close
    if (currentQuestId && currentQuest) {
      // Show quest details
      textEl.innerHTML = `
        ${escapeHtml(currentLines[currentLineIndex])}<br><br>
        <span style="color: #ffd700; font-weight: 600;">Quest: ${escapeHtml(currentQuest.name)}</span><br>
        <span style="color: #aaa; font-size: 0.9rem;">${escapeHtml(currentQuest.description)}</span><br>
        <span style="color: #88ff88; font-size: 0.85rem;">Rewards: ${currentQuest.rewards.xp} XP, ${currentQuest.rewards.gold} Gold</span>
      `

      const acceptBtn = createButton('Accept Quest', () => {
        if (networkRef && currentQuestId) {
          networkRef.sendRaw({ type: 'accept_quest', questId: currentQuestId })
        }
        closeDialogue()
      }, '#44aa44')
      buttonsEl.appendChild(acceptBtn)
    }

    const closeBtn = createButton('Close', () => closeDialogue())
    buttonsEl.appendChild(closeBtn)
  }
}

function createButton(text: string, onClick: () => void, bgColor: string = '#555'): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = text
  btn.style.cssText = `
    padding: 6px 16px;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 6px;
    background: ${bgColor};
    color: #fff;
    font-size: 0.9rem;
    cursor: pointer;
    font-family: 'Segoe UI', sans-serif;
  `
  btn.addEventListener('click', onClick)
  btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.8' })
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '1' })
  return btn
}

/**
 * Close the dialogue panel.
 */
export function closeDialogue(): void {
  if (dialoguePanel) {
    dialoguePanel.style.display = 'none'
  }
  isOpen = false
  currentLines = []
  currentLineIndex = 0
  currentQuestId = undefined
  currentQuest = undefined
}

/**
 * Check if dialogue is currently open.
 */
export function isDialogueOpen(): boolean {
  return isOpen
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
