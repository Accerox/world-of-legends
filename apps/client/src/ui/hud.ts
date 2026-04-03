import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { PlayerState } from '../types.js'
import type { SoundManager } from '../audio/soundManager.js'

/**
 * HUD overlay — FPS counter, player count, minimap, sound toggle.
 */
export class HUD {
  private fpsEl: HTMLElement
  private playerCountEl: HTMLElement
  private playerPosEl: HTMLElement
  private minimapCanvas: HTMLCanvasElement
  private minimapCtx: CanvasRenderingContext2D
  private engine: Engine
  private localPlayer: Mesh
  private maxPlayers: number

  constructor(engine: Engine, localPlayer: Mesh, maxPlayers: number = 50) {
    this.engine = engine
    this.localPlayer = localPlayer
    this.maxPlayers = maxPlayers
    this.fpsEl = document.getElementById('fps-counter')!
    this.playerCountEl = document.getElementById('player-count')!
    this.playerPosEl = document.getElementById('player-pos')!
    this.minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement
    this.minimapCtx = this.minimapCanvas.getContext('2d')!

    // Show HUD elements
    document.getElementById('hud')!.style.display = 'block'
    document.getElementById('chat-panel')!.style.display = 'block'
    document.getElementById('controls-hint')!.style.display = 'block'
  }

  /**
   * Create a sound toggle button in the HUD (top-right, left of minimap).
   * Click toggles sound on/off, icon changes between speaker and muted.
   */
  createSoundToggle(soundManager: SoundManager): void {
    const btn = document.createElement('button')
    btn.id = 'sound-toggle'
    btn.textContent = '\u{1F50A}' // 🔊
    btn.style.cssText = `
      position: fixed;
      top: 12px;
      right: 170px;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: white;
      font-size: 1.2rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      z-index: 30;
      pointer-events: auto;
      transition: background 0.2s;
    `
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(0, 0, 0, 0.7)'
    })
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0, 0, 0, 0.5)'
    })
    btn.addEventListener('click', () => {
      soundManager.toggle()
      btn.textContent = soundManager.isMuted ? '\u{1F507}' : '\u{1F50A}' // 🔇 or 🔊
    })
    document.body.appendChild(btn)
  }

  /**
   * Update HUD every frame.
   */
  update(remotePlayers: PlayerState[]): void {
    // FPS
    this.fpsEl.textContent = `FPS: ${this.engine.getFps().toFixed(0)}`

    // Player count (including self) with max
    const count = remotePlayers.length || 1
    this.playerCountEl.textContent = `Players: ${count}/${this.maxPlayers}`

    // Position
    const p = this.localPlayer.position
    this.playerPosEl.textContent = `Pos: ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`

    // Minimap
    this.drawMinimap(remotePlayers)
  }

  /**
   * Draw a functional 2D minimap showing island, players, and facing direction.
   */
  private drawMinimap(players: PlayerState[]): void {
    const ctx = this.minimapCtx
    const w = this.minimapCanvas.width
    const h = this.minimapCanvas.height
    const mapScale = w / 200 // 200 = island size
    const centerX = w / 2
    const centerY = h / 2

    // ─── Background ─────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(0, 15, 30, 0.85)'
    ctx.fillRect(0, 0, w, h)

    // ─── Island shape (green circle with gradient) ──────────────────────────
    const islandGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, w * 0.38,
    )
    islandGradient.addColorStop(0, 'rgba(60, 120, 50, 0.7)')
    islandGradient.addColorStop(0.6, 'rgba(45, 95, 40, 0.6)')
    islandGradient.addColorStop(0.85, 'rgba(70, 65, 45, 0.4)') // Sandy edges
    islandGradient.addColorStop(1, 'rgba(30, 60, 80, 0.2)')    // Water edge

    ctx.beginPath()
    ctx.arc(centerX, centerY, w * 0.42, 0, Math.PI * 2)
    ctx.fillStyle = islandGradient
    ctx.fill()

    // Island border
    ctx.beginPath()
    ctx.arc(centerX, centerY, w * 0.38, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(100, 150, 100, 0.3)'
    ctx.lineWidth = 1
    ctx.stroke()

    // ─── Other players (colored dots) ───────────────────────────────────────
    const localId = this.localPlayer.name.replace('avatar_', '')

    for (const p of players) {
      if (p.id === localId) continue // Skip local player, drawn separately

      const mx = centerX + p.x * mapScale
      const my = centerY + p.z * mapScale

      if (mx < 2 || mx > w - 2 || my < 2 || my > h - 2) continue

      // Red dot for other players
      ctx.beginPath()
      ctx.arc(mx, my, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#f55'
      ctx.fill()

      // Small direction line for other players
      const dirLen = 5
      const dirX = mx + Math.sin(p.rotY) * dirLen
      const dirY = my + Math.cos(p.rotY) * dirLen
      ctx.beginPath()
      ctx.moveTo(mx, my)
      ctx.lineTo(dirX, dirY)
      ctx.strokeStyle = '#f55'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ─── Local player (bright blue dot with direction) ──────────────────────
    const lx = centerX + this.localPlayer.position.x * mapScale
    const ly = centerY + this.localPlayer.position.z * mapScale

    // Glow effect
    ctx.beginPath()
    ctx.arc(lx, ly, 7, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(68, 170, 255, 0.25)'
    ctx.fill()

    // Main dot
    ctx.beginPath()
    ctx.arc(lx, ly, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#4af'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.stroke()

    // Direction indicator (line from dot showing facing)
    const dirLen = 10
    const dirX = lx + Math.sin(this.localPlayer.rotation.y) * dirLen
    const dirY = ly + Math.cos(this.localPlayer.rotation.y) * dirLen
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(dirX, dirY)
    ctx.strokeStyle = '#4af'
    ctx.lineWidth = 2
    ctx.stroke()

    // ─── Minimap border ─────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, w, h)
  }
}
