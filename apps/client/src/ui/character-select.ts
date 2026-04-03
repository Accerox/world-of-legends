/**
 * Character Select Screen
 *
 * After login, shows existing characters or option to create new.
 * Returns the selected character info for joining the game world.
 */

import { showCharacterCreator } from './character-creator.js'

const API_URL = import.meta.env.VITE_API_URL || 'https://wol-api.raregames.io'
const MAX_CHARACTERS = 5

export interface CharacterInfo {
  characterId: string
  name: string
  race: string
  className: string
  level: number
}

export interface CharacterSelectResult {
  characterId: string
  race: string
  className: string
  name: string
}

interface CharacterFromAPI {
  id: string
  name: string
  race: string
  className: string
  level: number
  xp: number
  gold: number
  createdAt: number
}

/** Race display data for character cards */
const RACE_EMOJI: Record<string, string> = {
  human: '🧑', prismari: '💎', forjado: '🪨', umbralis: '👻',
  draconid: '🐉', sylvani: '🧝', titan: '⚡', kitsune: '🦊',
}

/** Class display data */
const CLASS_EMOJI: Record<string, string> = {
  guardian: '🛡️', paladin: '⚔️', weaver: '🌿', medium: '💀',
  berserker: '🪓', stalker: '🗡️', monk: '👊', channeler: '⚡',
  archer: '🏹', chronomancer: '⏳',
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Show the character select screen.
 */
export function showCharacterSelect(token: string): Promise<CharacterSelectResult> {
  return new Promise(async (resolve) => {
    const screen = document.getElementById('character-select-screen')!
    screen.style.display = 'flex'

    // ─── Fetch characters ─────────────────────────────────────────────────────
    let characters: CharacterFromAPI[] = []

    async function fetchCharacters(): Promise<void> {
      try {
        const res = await fetch(`${API_URL}/characters`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          characters = data.characters || data || []
        }
      } catch (err) {
        console.warn('[WOL] Failed to fetch characters:', err)
      }
    }

    await fetchCharacters()

    // ─── Render ───────────────────────────────────────────────────────────────
    function render() {
      if (characters.length === 0) {
        // No characters — show create prompt
        screen.innerHTML = `
          <div class="cs-box">
            <h1 class="cs-title">World of Legends</h1>
            <p class="cs-subtitle">Choose Your Hero</p>
            <div class="cs-empty">
              <p class="cs-empty-icon">⚔️</p>
              <p class="cs-empty-text">You don't have any characters yet.</p>
              <p class="cs-empty-hint">Create your first hero and begin your adventure!</p>
              <button class="cs-create-btn" id="cs-create-first">Create Your First Character</button>
            </div>
          </div>
        `
        document.getElementById('cs-create-first')!.addEventListener('click', handleCreate)
      } else {
        // Show character list
        const cardsHtml = characters.map((c) => `
          <div class="cs-card" data-id="${c.id}">
            <div class="cs-card-icon">${RACE_EMOJI[c.race] || '⚔️'}</div>
            <div class="cs-card-info">
              <div class="cs-card-name">${c.name}</div>
              <div class="cs-card-detail">
                ${capitalize(c.race)} ${capitalize(c.className)} ${CLASS_EMOJI[c.className] || ''} · Lv. ${c.level}
              </div>
            </div>
            <div class="cs-card-actions">
              <button class="cs-play-btn" data-id="${c.id}" data-race="${c.race}" data-class="${c.className}" data-name="${c.name}">Play</button>
              <button class="cs-delete-btn" data-id="${c.id}" data-name="${c.name}">Delete</button>
            </div>
          </div>
        `).join('')

        const canCreate = characters.length < MAX_CHARACTERS

        screen.innerHTML = `
          <div class="cs-box">
            <h1 class="cs-title">World of Legends</h1>
            <p class="cs-subtitle">Choose Your Hero</p>
            <div class="cs-list">
              ${cardsHtml}
            </div>
            ${canCreate ? '<button class="cs-create-btn" id="cs-create-new">+ Create New Character</button>' : '<p class="cs-max-hint">Maximum characters reached (5/5)</p>'}
            <button class="cs-logout-btn" id="cs-logout">Logout</button>
          </div>
        `

        // Play buttons
        screen.querySelectorAll<HTMLButtonElement>('.cs-play-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            screen.style.display = 'none'
            resolve({
              characterId: btn.dataset.id!,
              race: btn.dataset.race!,
              className: btn.dataset.class!,
              name: btn.dataset.name!,
            })
          })
        })

        // Delete buttons
        screen.querySelectorAll<HTMLButtonElement>('.cs-delete-btn').forEach((btn) => {
          btn.addEventListener('click', () => handleDelete(btn.dataset.id!, btn.dataset.name!))
        })

        // Create new button
        if (canCreate) {
          document.getElementById('cs-create-new')!.addEventListener('click', handleCreate)
        }

        // Logout button
        document.getElementById('cs-logout')!.addEventListener('click', () => {
          localStorage.removeItem('wol_token')
          localStorage.removeItem('wol_account_id')
          window.location.reload()
        })
      }
    }

    // ─── Create character ─────────────────────────────────────────────────────
    async function handleCreate() {
      screen.style.display = 'none'
      const result = await showCharacterCreator(token)
      // After creation, re-fetch and show select screen
      await fetchCharacters()
      screen.style.display = 'flex'

      // If we got a result, resolve immediately
      if (result) {
        screen.style.display = 'none'
        resolve(result)
        return
      }

      // Otherwise re-render the list
      render()
    }

    // ─── Delete character ─────────────────────────────────────────────────────
    async function handleDelete(characterId: string, name: string) {
      if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return

      try {
        const res = await fetch(`${API_URL}/characters/${characterId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) {
          characters = characters.filter((c) => c.id !== characterId)
          render()
        } else {
          const data = await res.json()
          alert(data.error || 'Failed to delete character')
        }
      } catch {
        alert('Network error — please try again')
      }
    }

    render()
  })
}
