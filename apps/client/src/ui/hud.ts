import type { Engine } from '@babylonjs/core/Engines/engine'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { PlayerState } from '../types.js'

/**
 * HUD overlay — FPS counter, player count, minimap.
 */
export class HUD {
  private fpsEl: HTMLElement
  private playerCountEl: HTMLElement
  private playerPosEl: HTMLElement
  private minimapCanvas: HTMLCanvasElement
  private minimapCtx: CanvasRenderingContext2D
  private engine: Engine
  private localPlayer: Mesh

  constructor(engine: Engine, localPlayer: Mesh) {
    this.engine = engine
    this.localPlayer = localPlayer
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
   * Update HUD every frame.
   */
  update(remotePlayers: PlayerState[]): void {
    // FPS
    this.fpsEl.textContent = `FPS: ${this.engine.getFps().toFixed(0)}`

    // Player count (including self)
    this.playerCountEl.textContent = `Players: ${remotePlayers.length}`

    // Position
    const p = this.localPlayer.position
    this.playerPosEl.textContent = `Pos: ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`

    // Minimap
    this.drawMinimap(remotePlayers)
  }

  /**
   * Draw a simple 2D minimap showing player dots.
   */
  private drawMinimap(players: PlayerState[]): void {
    const ctx = this.minimapCtx
    const w = this.minimapCanvas.width
    const h = this.minimapCanvas.height
    const mapScale = w / 200 // 200 = island size

    // Clear
    ctx.fillStyle = 'rgba(0, 20, 40, 0.8)'
    ctx.fillRect(0, 0, w, h)

    // Island circle
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(40, 80, 40, 0.5)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(100, 150, 100, 0.3)'
    ctx.stroke()

    // Other players (red dots)
    for (const p of players) {
      const mx = w / 2 + p.x * mapScale
      const my = h / 2 + p.z * mapScale

      if (mx < 0 || mx > w || my < 0 || my > h) continue

      ctx.beginPath()
      ctx.arc(mx, my, 3, 0, Math.PI * 2)
      ctx.fillStyle = p.id === this.localPlayer.name.replace('avatar_', '')
        ? '#4af' // Local player blue
        : '#f44' // Others red
      ctx.fill()
    }

    // Local player (always centered, blue dot with direction indicator)
    const lx = w / 2 + this.localPlayer.position.x * mapScale
    const ly = h / 2 + this.localPlayer.position.z * mapScale
    ctx.beginPath()
    ctx.arc(lx, ly, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#4af'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.stroke()

    // Direction indicator
    const dirLen = 8
    const dirX = lx + Math.sin(this.localPlayer.rotation.y) * dirLen
    const dirY = ly + Math.cos(this.localPlayer.rotation.y) * dirLen
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(dirX, dirY)
    ctx.strokeStyle = '#4af'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}
