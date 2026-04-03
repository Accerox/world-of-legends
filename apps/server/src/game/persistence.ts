import { readFileSync, writeFileSync, existsSync } from 'fs'

const SAVE_FILE = process.env.WOL_SAVE_FILE || '/tmp/wol-player-data.json'

export interface SavedPlayer {
  username: string
  x: number
  y: number
  z: number
  rotY: number
  lastSeen: number
}

/**
 * Load saved player data from disk.
 * Returns a Map keyed by username (lowercase) for case-insensitive lookup.
 */
export function loadPlayerData(): Map<string, SavedPlayer> {
  try {
    if (existsSync(SAVE_FILE)) {
      const data = JSON.parse(readFileSync(SAVE_FILE, 'utf-8'))
      const map = new Map<string, SavedPlayer>(Object.entries(data))
      console.log(`[WOL] Loaded ${map.size} saved player(s) from ${SAVE_FILE}`)
      return map
    }
  } catch (e) {
    console.error('[WOL] Failed to load player data:', e)
  }
  return new Map()
}

/**
 * Save all player data to disk.
 */
export function savePlayerData(players: Map<string, SavedPlayer>): void {
  try {
    const obj = Object.fromEntries(players)
    writeFileSync(SAVE_FILE, JSON.stringify(obj, null, 2))
    console.log(`[WOL] Saved ${players.size} player(s) to ${SAVE_FILE}`)
  } catch (e) {
    console.error('[WOL] Failed to save player data:', e)
  }
}
