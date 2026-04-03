/**
 * Character Creator Screen
 *
 * Full character creation flow:
 *   Step 1: Choose Race (8 options with descriptions + stat bars)
 *   Step 2: Choose Class (10 options with role badges + synergy indicators)
 *   Step 3: Name your character
 *   Step 4: Confirm and create
 *
 * POST /characters (Authorization: Bearer token) { name, race, className }
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://wol-api.raregames.io'

export interface CharacterCreatorResult {
  characterId: string
  race: string
  className: string
  name: string
}

// ─── Race Data ────────────────────────────────────────────────────────────────

interface RaceData {
  id: string
  name: string
  emoji: string
  desc: string
  stats: { str: number; agi: number; int: number; spi: number; vit: number }
}

const RACES: RaceData[] = [
  { id: 'human', name: 'Human', emoji: '🧑', desc: 'Versatile and adaptive, connected to Nexus', stats: { str: 10, agi: 10, int: 10, spi: 10, vit: 10 } },
  { id: 'prismari', name: 'Prismari', emoji: '💎', desc: 'Crystalline beings of light and energy', stats: { str: 7, agi: 9, int: 13, spi: 12, vit: 9 } },
  { id: 'forjado', name: 'Forjado', emoji: '🪨', desc: 'Stone and metal giants of Materion', stats: { str: 13, agi: 7, int: 8, spi: 8, vit: 14 } },
  { id: 'umbralis', name: 'Umbralis', emoji: '👻', desc: 'Shadow spirits between life and death', stats: { str: 9, agi: 10, int: 11, spi: 13, vit: 7 } },
  { id: 'draconid', name: 'Draconid', emoji: '🐉', desc: 'Dragon-blooded warriors of Energis', stats: { str: 12, agi: 9, int: 10, spi: 8, vit: 11 } },
  { id: 'sylvani', name: 'Sylvani', emoji: '🧝', desc: 'Elven weavers of the Entramado', stats: { str: 8, agi: 13, int: 11, spi: 10, vit: 8 } },
  { id: 'titan', name: 'Titan', emoji: '⚡', desc: 'Heroic giants echoing the Archetypes', stats: { str: 14, agi: 6, int: 8, spi: 7, vit: 15 } },
  { id: 'kitsune', name: 'Kitsune', emoji: '🦊', desc: 'Trickster fox spirits of Mentus', stats: { str: 7, agi: 14, int: 12, spi: 11, vit: 6 } },
]

// ─── Class Data ───────────────────────────────────────────────────────────────

interface ClassData {
  id: string
  name: string
  role: string
  emoji: string
  desc: string
}

const CLASSES: ClassData[] = [
  { id: 'guardian', name: 'Guardian', role: 'Tank', emoji: '🛡️', desc: 'Unbreakable defender of allies' },
  { id: 'paladin', name: 'Paladin', role: 'Tank/Healer', emoji: '⚔️', desc: 'Holy warrior with healing powers' },
  { id: 'weaver', name: 'Weaver', role: 'Healer', emoji: '🌿', desc: 'Master healer of the Entramado' },
  { id: 'medium', name: 'Medium', role: 'Healer/DPS', emoji: '💀', desc: 'Channels life and death energies' },
  { id: 'berserker', name: 'Berserker', role: 'Melee DPS', emoji: '🪓', desc: 'Unstoppable fury in combat' },
  { id: 'stalker', name: 'Stalker', role: 'Melee DPS', emoji: '🗡️', desc: 'Shadow assassin, strike and vanish' },
  { id: 'monk', name: 'Monk', role: 'Melee/Tank/Healer', emoji: '👊', desc: 'Martial artist, master of chi' },
  { id: 'channeler', name: 'Channeler', role: 'Ranged DPS', emoji: '⚡', desc: 'Elemental mage of destruction' },
  { id: 'archer', name: 'Archer', role: 'Ranged DPS', emoji: '🏹', desc: 'Precise marksman and tracker' },
  { id: 'chronomancer', name: 'Chronomancer', role: 'Ranged/Support', emoji: '⏳', desc: 'Time manipulator, unique to WOL' },
]

// ─── Race → Class synergy map ─────────────────────────────────────────────────

const SYNERGY: Record<string, string[]> = {
  human: ['guardian', 'paladin', 'berserker', 'channeler', 'chronomancer'],
  prismari: ['channeler', 'chronomancer', 'weaver', 'medium'],
  forjado: ['guardian', 'paladin', 'berserker', 'monk'],
  umbralis: ['medium', 'stalker', 'chronomancer', 'channeler'],
  draconid: ['berserker', 'guardian', 'channeler', 'paladin'],
  sylvani: ['weaver', 'archer', 'stalker', 'monk'],
  titan: ['guardian', 'berserker', 'paladin', 'monk'],
  kitsune: ['stalker', 'archer', 'channeler', 'chronomancer'],
}

// ─── Role color map ───────────────────────────────────────────────────────────

function getRoleBadgeColor(role: string): string {
  if (role.includes('Tank')) return '#4a9eff'
  if (role.includes('Healer')) return '#4aff7a'
  if (role.includes('Melee')) return '#ff4a4a'
  if (role.includes('Ranged')) return '#ff9f4a'
  return '#aaa'
}

// ─── Stat bar HTML ────────────────────────────────────────────────────────────

function statBarHtml(label: string, value: number, maxVal: number = 15): string {
  const pct = Math.min(100, (value / maxVal) * 100)
  const color = pct > 70 ? '#ffd700' : pct > 50 ? '#88aaff' : '#888'
  return `
    <div class="cc-stat-row">
      <span class="cc-stat-label">${label}</span>
      <div class="cc-stat-bar-bg">
        <div class="cc-stat-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="cc-stat-value">${value}</span>
    </div>
  `
}

/**
 * Show the character creator screen.
 */
export function showCharacterCreator(token: string): Promise<CharacterCreatorResult | null> {
  return new Promise((resolve) => {
    const screen = document.getElementById('character-creator-screen')!
    screen.style.display = 'flex'

    let step = 1
    let selectedRace: string | null = null
    let selectedClass: string | null = null
    let characterName = ''

    // ─── Render ─────────────────────────────────────────────────────────────
    function render() {
      switch (step) {
        case 1: renderRaceSelect(); break
        case 2: renderClassSelect(); break
        case 3: renderNameInput(); break
        case 4: renderConfirm(); break
      }
    }

    // ─── Step 1: Race Selection ─────────────────────────────────────────────
    function renderRaceSelect() {
      const raceCards = RACES.map((r) => {
        const isSelected = selectedRace === r.id
        return `
          <div class="cc-race-card ${isSelected ? 'selected' : ''}" data-race="${r.id}">
            <div class="cc-race-emoji">${r.emoji}</div>
            <div class="cc-race-name">${r.name}</div>
            <div class="cc-race-desc">${r.desc}</div>
            <div class="cc-stats">
              ${statBarHtml('STR', r.stats.str)}
              ${statBarHtml('AGI', r.stats.agi)}
              ${statBarHtml('INT', r.stats.int)}
              ${statBarHtml('SPI', r.stats.spi)}
              ${statBarHtml('VIT', r.stats.vit)}
            </div>
          </div>
        `
      }).join('')

      screen.innerHTML = `
        <div class="cc-box">
          <div class="cc-header">
            <h1 class="cc-title">Choose Your Race</h1>
            <p class="cc-step">Step 1 of 4</p>
          </div>
          <div class="cc-progress">
            <div class="cc-progress-fill" style="width:25%"></div>
          </div>
          <div class="cc-race-grid">
            ${raceCards}
          </div>
          <div class="cc-nav">
            <button class="cc-back-btn" id="cc-back">Cancel</button>
            <button class="cc-next-btn ${selectedRace ? '' : 'disabled'}" id="cc-next" ${selectedRace ? '' : 'disabled'}>Next: Choose Class</button>
          </div>
        </div>
      `

      // Race card clicks
      screen.querySelectorAll<HTMLDivElement>('.cc-race-card').forEach((card) => {
        card.addEventListener('click', () => {
          selectedRace = card.dataset.race!
          render()
        })
      })

      document.getElementById('cc-back')!.addEventListener('click', () => {
        screen.style.display = 'none'
        resolve(null)
      })

      if (selectedRace) {
        document.getElementById('cc-next')!.addEventListener('click', () => {
          step = 2
          render()
        })
      }
    }

    // ─── Step 2: Class Selection ────────────────────────────────────────────
    function renderClassSelect() {
      const synergies = SYNERGY[selectedRace!] || []

      const classCards = CLASSES.map((c) => {
        const isSelected = selectedClass === c.id
        const isSynergy = synergies.includes(c.id)
        return `
          <div class="cc-class-card ${isSelected ? 'selected' : ''}" data-class="${c.id}">
            <div class="cc-class-top">
              <span class="cc-class-emoji">${c.emoji}</span>
              <span class="cc-class-name">${c.name}</span>
              ${isSynergy ? '<span class="cc-synergy">★</span>' : ''}
            </div>
            <div class="cc-class-role" style="color:${getRoleBadgeColor(c.role)}">${c.role}</div>
            <div class="cc-class-desc">${c.desc}</div>
          </div>
        `
      }).join('')

      const raceData = RACES.find((r) => r.id === selectedRace)!

      screen.innerHTML = `
        <div class="cc-box">
          <div class="cc-header">
            <h1 class="cc-title">Choose Your Class</h1>
            <p class="cc-step">Step 2 of 4 · ${raceData.emoji} ${raceData.name}</p>
          </div>
          <div class="cc-progress">
            <div class="cc-progress-fill" style="width:50%"></div>
          </div>
          <p class="cc-synergy-hint">★ = Recommended for ${raceData.name}</p>
          <div class="cc-class-grid">
            ${classCards}
          </div>
          <div class="cc-nav">
            <button class="cc-back-btn" id="cc-back">Back</button>
            <button class="cc-next-btn ${selectedClass ? '' : 'disabled'}" id="cc-next" ${selectedClass ? '' : 'disabled'}>Next: Name</button>
          </div>
        </div>
      `

      // Class card clicks
      screen.querySelectorAll<HTMLDivElement>('.cc-class-card').forEach((card) => {
        card.addEventListener('click', () => {
          selectedClass = card.dataset.class!
          render()
        })
      })

      document.getElementById('cc-back')!.addEventListener('click', () => {
        step = 1
        render()
      })

      if (selectedClass) {
        document.getElementById('cc-next')!.addEventListener('click', () => {
          step = 3
          render()
        })
      }
    }

    // ─── Step 3: Name Input ─────────────────────────────────────────────────
    function renderNameInput() {
      const raceData = RACES.find((r) => r.id === selectedRace)!
      const classData = CLASSES.find((c) => c.id === selectedClass)!

      screen.innerHTML = `
        <div class="cc-box">
          <div class="cc-header">
            <h1 class="cc-title">Name Your Hero</h1>
            <p class="cc-step">Step 3 of 4 · ${raceData.emoji} ${raceData.name} ${classData.emoji} ${classData.name}</p>
          </div>
          <div class="cc-progress">
            <div class="cc-progress-fill" style="width:75%"></div>
          </div>
          <div class="cc-name-section">
            <div class="cc-name-preview">${raceData.emoji}</div>
            <input type="text" id="cc-name-input" class="cc-name-input" placeholder="Enter character name..." maxlength="16" autocomplete="off" value="${characterName}" />
            <p class="cc-name-hint">2-16 characters, letters, numbers, and underscores only</p>
            <p class="cc-error" id="cc-name-error"></p>
          </div>
          <div class="cc-nav">
            <button class="cc-back-btn" id="cc-back">Back</button>
            <button class="cc-next-btn" id="cc-next">Next: Confirm</button>
          </div>
        </div>
      `

      const nameInput = document.getElementById('cc-name-input') as HTMLInputElement
      const nameError = document.getElementById('cc-name-error')!

      setTimeout(() => nameInput.focus(), 50)

      document.getElementById('cc-back')!.addEventListener('click', () => {
        characterName = nameInput.value.trim()
        step = 2
        render()
      })

      function goNext() {
        const name = nameInput.value.trim()
        if (!name || name.length < 2) {
          nameError.textContent = 'Name must be at least 2 characters'
          return
        }
        if (name.length > 16) {
          nameError.textContent = 'Name must be 16 characters or less'
          return
        }
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
          nameError.textContent = 'Only letters, numbers, and underscores allowed'
          return
        }
        characterName = name
        step = 4
        render()
      }

      document.getElementById('cc-next')!.addEventListener('click', goNext)
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') goNext()
      })
    }

    // ─── Step 4: Confirm ────────────────────────────────────────────────────
    function renderConfirm() {
      const raceData = RACES.find((r) => r.id === selectedRace)!
      const classData = CLASSES.find((c) => c.id === selectedClass)!

      screen.innerHTML = `
        <div class="cc-box">
          <div class="cc-header">
            <h1 class="cc-title">Confirm Your Hero</h1>
            <p class="cc-step">Step 4 of 4</p>
          </div>
          <div class="cc-progress">
            <div class="cc-progress-fill" style="width:100%"></div>
          </div>
          <div class="cc-confirm-card">
            <div class="cc-confirm-emoji">${raceData.emoji}</div>
            <div class="cc-confirm-name">${characterName}</div>
            <div class="cc-confirm-detail">${raceData.name} ${classData.name} ${classData.emoji}</div>
            <div class="cc-confirm-role">${classData.role}</div>
            <div class="cc-confirm-stats">
              ${statBarHtml('STR', raceData.stats.str)}
              ${statBarHtml('AGI', raceData.stats.agi)}
              ${statBarHtml('INT', raceData.stats.int)}
              ${statBarHtml('SPI', raceData.stats.spi)}
              ${statBarHtml('VIT', raceData.stats.vit)}
            </div>
          </div>
          <p class="cc-error" id="cc-create-error"></p>
          <div class="cc-nav">
            <button class="cc-back-btn" id="cc-back">Back</button>
            <button class="cc-create-final-btn" id="cc-create">Create Character</button>
          </div>
        </div>
      `

      document.getElementById('cc-back')!.addEventListener('click', () => {
        step = 3
        render()
      })

      document.getElementById('cc-create')!.addEventListener('click', handleCreate)
    }

    // ─── Create character API call ──────────────────────────────────────────
    async function handleCreate() {
      const createBtn = document.getElementById('cc-create') as HTMLButtonElement
      const errorEl = document.getElementById('cc-create-error')!

      createBtn.disabled = true
      createBtn.textContent = 'Creating...'
      errorEl.textContent = ''

      try {
        const res = await fetch(`${API_URL}/characters`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: characterName,
            race: selectedRace,
            className: selectedClass,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          errorEl.textContent = data.error || 'Failed to create character'
          createBtn.disabled = false
          createBtn.textContent = 'Create Character'
          return
        }

        screen.style.display = 'none'
        resolve({
          characterId: data.id || data.characterId,
          race: selectedRace!,
          className: selectedClass!,
          name: characterName,
        })
      } catch (err) {
        errorEl.textContent = 'Network error — please try again'
        createBtn.disabled = false
        createBtn.textContent = 'Create Character'
      }
    }

    render()
  })
}
