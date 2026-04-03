/**
 * Quest Tracker UI — right-side panel showing active quests and objectives.
 *
 * HTML-based (not Babylon GUI) — appended to document body.
 */

import type { PlayerQuestState, Quest } from '../types.js'

/** Resolved quest state with name and objective descriptions for display. */
export interface DisplayQuest {
  questId: string
  name: string
  completed: boolean
  objectives: Array<{
    description: string
    current: number
    required: number
  }>
}

export class QuestTrackerUI {
  private container: HTMLDivElement
  private questList: HTMLDivElement
  private questDefs: Map<string, Quest> = new Map()

  constructor() {
    this.container = document.createElement('div')
    this.container.id = 'quest-tracker'
    this.container.style.cssText = `
      position: fixed; top: 80px; right: 12px; width: 250px;
      background: rgba(0,0,0,0.6); border-radius: 8px; padding: 12px;
      color: white; font-family: 'Segoe UI', sans-serif; z-index: 30;
      font-size: 0.85rem; pointer-events: none;
    `

    const title = document.createElement('div')
    title.textContent = '📜 Quests'
    title.style.cssText = 'color: #ffd700; font-weight: bold; margin-bottom: 8px; font-size: 0.95rem;'
    this.container.appendChild(title)

    this.questList = document.createElement('div')
    this.container.appendChild(this.questList)
    document.body.appendChild(this.container)
  }

  /**
   * Register quest definitions (called once at join with the full quest list).
   */
  setQuestDefinitions(quests: Quest[]): void {
    this.questDefs.clear()
    for (const q of quests) {
      this.questDefs.set(q.id, q)
    }
  }

  /**
   * Update the quest tracker from player quest state.
   * Resolves quest names and objective descriptions from registered definitions.
   */
  update(playerQuests: PlayerQuestState[]): void {
    this.questList.innerHTML = ''

    // Only show accepted quests
    const active = playerQuests.filter((q) => q.accepted)

    if (active.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = 'color: #888; font-style: italic;'
      empty.textContent = 'No active quests. Talk to NPCs!'
      this.questList.appendChild(empty)
      return
    }

    for (const pq of active) {
      const def = this.questDefs.get(pq.questId)
      if (!def) continue

      const div = document.createElement('div')
      div.style.cssText = 'margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;'

      // Quest name
      const name = document.createElement('div')
      name.textContent = pq.completed ? `✅ ${def.name}` : `📋 ${def.name}`
      name.style.cssText = `font-weight: 600; color: ${pq.completed ? '#4ade80' : '#fff'}; margin-bottom: 4px;`
      div.appendChild(name)

      // Objectives
      for (let i = 0; i < def.objectives.length; i++) {
        const obj = def.objectives[i]
        const current = pq.progress[i] ?? 0
        const required = obj.count
        const done = current >= required

        const objDiv = document.createElement('div')
        objDiv.textContent = `${done ? '✓' : '○'} ${obj.description} (${current}/${required})`
        objDiv.style.cssText = `color: ${done ? '#4ade80' : '#aaa'}; margin-left: 8px; font-size: 0.8rem;`
        div.appendChild(objDiv)
      }

      this.questList.appendChild(div)
    }
  }

  /**
   * Show a quest completion popup in the center of the screen.
   */
  showCompletion(questName: string, xp: number, gold: number): void {
    const popup = document.createElement('div')
    popup.style.cssText = `
      position: fixed; top: 30%; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.9); border: 2px solid #ffd700; border-radius: 12px;
      padding: 24px 40px; color: #ffd700; font-size: 1.3rem; font-weight: bold;
      text-align: center; z-index: 100; pointer-events: none;
      animation: combatFloatUp 3s ease-out forwards;
    `
    popup.innerHTML = `
      Quest Complete!<br>
      <span style="font-size:1rem;color:white">${this.escapeHtml(questName)}</span><br>
      <span style="font-size:0.9rem;color:#4ade80">+${xp} XP &nbsp; +${gold} Gold</span>
    `
    document.body.appendChild(popup)
    setTimeout(() => popup.remove(), 3000)
  }

  /**
   * Show a level-up notification.
   */
  showLevelUp(newLevel: number): void {
    const popup = document.createElement('div')
    popup.style.cssText = `
      position: fixed; top: 25%; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.9); border: 2px solid #4488ff; border-radius: 12px;
      padding: 20px 36px; color: #4488ff; font-size: 1.5rem; font-weight: bold;
      text-align: center; z-index: 100; pointer-events: none;
      animation: combatFloatUp 3s ease-out forwards;
    `
    popup.textContent = `⬆️ Level Up! Lv.${newLevel}`
    document.body.appendChild(popup)
    setTimeout(() => popup.remove(), 3000)
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
