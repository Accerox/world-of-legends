/**
 * Account & Character management using Cloudflare D1.
 */

import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { d1Query, d1Execute } from './d1-client.js'
import { signToken } from './jwt.js'
import type { Account, Character } from '../types.js'

const SALT_ROUNDS = 10
const MAX_CHARACTERS_PER_ACCOUNT = 5

const RACE_HEALTH: Record<string, number> = {
  human: 100, prismari: 90, forjado: 130, umbralis: 80,
  draconid: 110, sylvani: 85, titan: 130, kitsune: 75,
}

function randomSpawn(): { x: number; y: number; z: number } {
  const angle = Math.random() * Math.PI * 2
  const dist = 5 + Math.random() * 20
  return { x: Math.cos(angle) * dist, y: 5, z: Math.sin(angle) * dist }
}

function sanitizeAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    email: row.email as string,
    createdAt: row.created_at as number,
    lastLogin: row.last_login as number,
  } as Account
}

function rowToCharacter(row: Record<string, unknown>): Character {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    name: row.name as string,
    race: row.race as Character['race'],
    className: row.class_name as Character['className'],
    level: row.level as number,
    xp: row.xp as number,
    gold: row.gold as number,
    health: row.health as number,
    maxHealth: row.max_health as number,
    x: row.x as number,
    y: row.y as number,
    z: row.z as number,
    rotY: row.rot_y as number,
    createdAt: row.created_at as number,
    playTime: row.play_time as number,
  }
}

export class AccountManager {
  async register(email: string, password: string): Promise<{ account: Account; token: string }> {
    email = email.toLowerCase().trim()
    const existing = await d1Query('SELECT id FROM account WHERE email = ?', [email])
    if (existing.length > 0) throw new Error('Email already registered')

    const id = randomUUID()
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const now = Date.now()

    await d1Execute(
      'INSERT INTO account (id, email, password_hash, created_at, last_login) VALUES (?, ?, ?, ?, ?)',
      [id, email, passwordHash, now, now]
    )

    const account: Account = { id, email, createdAt: now, lastLogin: now } as Account
    const token = signToken(id)
    console.log(`[WOL:Auth] Registered: ${email}`)
    return { account, token }
  }

  async login(email: string, password: string): Promise<{ account: Account; token: string }> {
    email = email.toLowerCase().trim()
    const rows = await d1Query('SELECT * FROM account WHERE email = ?', [email])
    if (rows.length === 0) throw new Error('Invalid email or password')

    const row = rows[0]
    const valid = await bcrypt.compare(password, row.password_hash as string)
    if (!valid) throw new Error('Invalid email or password')

    const now = Date.now()
    await d1Execute('UPDATE account SET last_login = ? WHERE id = ?', [now, row.id])

    const account = sanitizeAccount({ ...row, last_login: now })
    const token = signToken(account.id)
    console.log(`[WOL:Auth] Login: ${email}`)
    return { account, token }
  }

  async getAccount(accountId: string): Promise<Account | null> {
    const rows = await d1Query('SELECT * FROM account WHERE id = ?', [accountId])
    if (rows.length === 0) return null
    return sanitizeAccount(rows[0])
  }

  async createCharacter(accountId: string, data: { name: string; race: string; className: string }): Promise<Character> {
    const existing = await d1Query('SELECT id FROM character WHERE account_id = ?', [accountId])
    if (existing.length >= MAX_CHARACTERS_PER_ACCOUNT) {
      throw new Error(`Maximum ${MAX_CHARACTERS_PER_ACCOUNT} characters per account`)
    }

    const nameCheck = await d1Query('SELECT id FROM character WHERE name = ?', [data.name])
    if (nameCheck.length > 0) throw new Error('Character name already taken')

    const id = randomUUID()
    const now = Date.now()
    const spawn = randomSpawn()
    const maxHealth = RACE_HEALTH[data.race] || 100

    await d1Execute(
      `INSERT INTO character (id, account_id, name, race, class_name, level, xp, gold, health, max_health, x, y, z, rot_y, created_at, play_time)
       VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?, ?, ?, 0, ?, 0)`,
      [id, accountId, data.name, data.race, data.className, maxHealth, maxHealth, spawn.x, spawn.y, spawn.z, now]
    )

    const character: Character = {
      id, accountId, name: data.name, race: data.race as Character['race'], className: data.className as Character['className'],
      level: 1, xp: 0, gold: 0, health: maxHealth, maxHealth,
      x: spawn.x, y: spawn.y, z: spawn.z, rotY: 0, createdAt: now, playTime: 0,
    }
    console.log(`[WOL:Char] Created: ${data.name} (${data.race} ${data.className})`)
    return character
  }

  async getCharacters(accountId: string): Promise<Character[]> {
    const rows = await d1Query('SELECT * FROM character WHERE account_id = ? ORDER BY created_at DESC', [accountId])
    return rows.map(rowToCharacter)
  }

  async getCharacter(characterId: string): Promise<Character | null> {
    const rows = await d1Query('SELECT * FROM character WHERE id = ?', [characterId])
    if (rows.length === 0) return null
    return rowToCharacter(rows[0])
  }

  async updateCharacter(characterId: string, updates: Partial<Character>): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.x !== undefined) { fields.push('x = ?'); values.push(updates.x) }
    if (updates.y !== undefined) { fields.push('y = ?'); values.push(updates.y) }
    if (updates.z !== undefined) { fields.push('z = ?'); values.push(updates.z) }
    if (updates.rotY !== undefined) { fields.push('rot_y = ?'); values.push(updates.rotY) }
    if (updates.health !== undefined) { fields.push('health = ?'); values.push(updates.health) }
    if (updates.maxHealth !== undefined) { fields.push('max_health = ?'); values.push(updates.maxHealth) }
    if (updates.xp !== undefined) { fields.push('xp = ?'); values.push(updates.xp) }
    if (updates.gold !== undefined) { fields.push('gold = ?'); values.push(updates.gold) }
    if (updates.level !== undefined) { fields.push('level = ?'); values.push(updates.level) }
    if (updates.playTime !== undefined) { fields.push('play_time = ?'); values.push(updates.playTime) }

    if (fields.length === 0) return
    values.push(characterId)
    await d1Execute(`UPDATE character SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async deleteCharacter(characterId: string, accountId: string): Promise<boolean> {
    const result = await d1Execute('DELETE FROM character WHERE id = ? AND account_id = ?', [characterId, accountId])
    return result.changes > 0
  }

  async saveAll(): Promise<void> {
    // No-op — D1 writes are immediate
  }
}
