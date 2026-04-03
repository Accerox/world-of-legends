/**
 * Combat UI — target frame, player HP/XP bars, attack button, damage numbers, death screen.
 *
 * All HTML-based (not Babylon GUI) — appended to document body.
 */

export class CombatUI {
  // ─── Target frame (top center) ──────────────────────────────────────────────
  private targetFrame: HTMLDivElement
  private targetName: HTMLDivElement
  private targetHealthFill: HTMLDivElement

  // ─── Player stats (bottom left) ─────────────────────────────────────────────
  private playerFrame: HTMLDivElement
  private hpFill: HTMLDivElement
  private hpText: HTMLDivElement
  private xpFill: HTMLDivElement
  private levelText: HTMLDivElement
  private goldText: HTMLDivElement

  // ─── Attack button (bottom right) ───────────────────────────────────────────
  private attackBtn: HTMLDivElement

  // ─── Death screen ───────────────────────────────────────────────────────────
  private deathScreen: HTMLDivElement
  private deathCountdown: HTMLDivElement

  // ─── Damage numbers container ───────────────────────────────────────────────
  private damageContainer: HTMLDivElement

  constructor() {
    this.injectStyles()

    // ─── Target frame ─────────────────────────────────────────────────────────
    this.targetFrame = document.createElement('div')
    this.targetFrame.id = 'combat-target-frame'
    this.targetFrame.style.cssText = `
      position: fixed; top: 60px; left: 50%; transform: translateX(-50%);
      width: 220px; background: rgba(0,0,0,0.8); border: 1px solid rgba(255,100,100,0.4);
      border-radius: 8px; padding: 8px 12px; color: white;
      font-family: 'Segoe UI', sans-serif; z-index: 40; display: none;
    `

    this.targetName = document.createElement('div')
    this.targetName.style.cssText = 'color: #ff6666; font-weight: 700; font-size: 0.9rem; margin-bottom: 4px; text-align: center;'
    this.targetFrame.appendChild(this.targetName)

    const targetHealthBar = document.createElement('div')
    targetHealthBar.style.cssText = 'width: 100%; height: 10px; background: #333; border-radius: 4px; overflow: hidden;'
    this.targetFrame.appendChild(targetHealthBar)

    this.targetHealthFill = document.createElement('div')
    this.targetHealthFill.style.cssText = 'width: 100%; height: 100%; background: #44cc44; border-radius: 4px; transition: width 0.2s ease;'
    targetHealthBar.appendChild(this.targetHealthFill)

    document.body.appendChild(this.targetFrame)

    // ─── Player stats frame ───────────────────────────────────────────────────
    this.playerFrame = document.createElement('div')
    this.playerFrame.id = 'combat-player-frame'
    this.playerFrame.style.cssText = `
      position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
      width: 260px; background: rgba(0,0,0,0.75); border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px; padding: 10px 14px; color: white;
      font-family: 'Segoe UI', sans-serif; z-index: 40;
    `

    // Level + Gold row
    const topRow = document.createElement('div')
    topRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.8rem;'
    this.playerFrame.appendChild(topRow)

    this.levelText = document.createElement('div')
    this.levelText.style.cssText = 'color: #ffd700; font-weight: 700;'
    this.levelText.textContent = 'Lv.1'
    topRow.appendChild(this.levelText)

    this.goldText = document.createElement('div')
    this.goldText.style.cssText = 'color: #ffd700;'
    this.goldText.textContent = '💰 0'
    topRow.appendChild(this.goldText)

    // HP bar
    const hpRow = document.createElement('div')
    hpRow.style.cssText = 'margin-bottom: 4px;'
    this.playerFrame.appendChild(hpRow)

    const hpLabel = document.createElement('div')
    hpLabel.style.cssText = 'font-size: 0.7rem; color: #aaa; margin-bottom: 2px;'
    hpLabel.textContent = 'HP'
    hpRow.appendChild(hpLabel)

    const hpBarBg = document.createElement('div')
    hpBarBg.style.cssText = 'width: 100%; height: 12px; background: #333; border-radius: 4px; overflow: hidden; position: relative;'
    hpRow.appendChild(hpBarBg)

    this.hpFill = document.createElement('div')
    this.hpFill.style.cssText = 'width: 100%; height: 100%; background: #44cc44; border-radius: 4px; transition: width 0.3s ease;'
    hpBarBg.appendChild(this.hpFill)

    this.hpText = document.createElement('div')
    this.hpText.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.65rem; font-weight: 600; color: white; text-shadow: 1px 1px 2px black;
    `
    this.hpText.textContent = '100/100'
    hpBarBg.appendChild(this.hpText)

    // XP bar
    const xpRow = document.createElement('div')
    this.playerFrame.appendChild(xpRow)

    const xpLabel = document.createElement('div')
    xpLabel.style.cssText = 'font-size: 0.7rem; color: #aaa; margin-bottom: 2px;'
    xpLabel.textContent = 'XP'
    xpRow.appendChild(xpLabel)

    const xpBarBg = document.createElement('div')
    xpBarBg.style.cssText = 'width: 100%; height: 8px; background: #333; border-radius: 4px; overflow: hidden;'
    xpRow.appendChild(xpBarBg)

    this.xpFill = document.createElement('div')
    this.xpFill.style.cssText = 'width: 0%; height: 100%; background: #4488ff; border-radius: 4px; transition: width 0.3s ease;'
    xpBarBg.appendChild(this.xpFill)

    document.body.appendChild(this.playerFrame)

    // ─── Attack button ────────────────────────────────────────────────────────
    this.attackBtn = document.createElement('div')
    this.attackBtn.id = 'combat-attack-btn'
    this.attackBtn.style.cssText = `
      position: fixed; bottom: 80px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: radial-gradient(circle at 40% 40%, #cc3333, #881111);
      border: 2px solid rgba(255,100,100,0.5);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; z-index: 40; user-select: none;
      font-family: 'Segoe UI', sans-serif; transition: transform 0.1s;
    `
    this.attackBtn.innerHTML = `
      <span style="font-size: 1.4rem; line-height: 1;">⚔️</span>
      <span style="font-size: 0.55rem; color: rgba(255,255,255,0.7); margin-top: -2px;">Press 1</span>
    `
    this.attackBtn.addEventListener('mousedown', () => {
      this.attackBtn.style.transform = 'scale(0.9)'
    })
    this.attackBtn.addEventListener('mouseup', () => {
      this.attackBtn.style.transform = 'scale(1)'
    })
    this.attackBtn.addEventListener('mouseleave', () => {
      this.attackBtn.style.transform = 'scale(1)'
    })
    // Prevent canvas interaction
    this.attackBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
    document.body.appendChild(this.attackBtn)

    // ─── Death screen ─────────────────────────────────────────────────────────
    this.deathScreen = document.createElement('div')
    this.deathScreen.id = 'combat-death-screen'
    this.deathScreen.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(80,0,0,0.7); display: none;
      flex-direction: column; align-items: center; justify-content: center;
      z-index: 200; font-family: 'Segoe UI', sans-serif;
    `

    const deathTitle = document.createElement('div')
    deathTitle.style.cssText = 'color: #ff4444; font-size: 3rem; font-weight: 900; text-shadow: 0 0 20px rgba(255,0,0,0.5); margin-bottom: 16px;'
    deathTitle.textContent = 'You Died!'
    this.deathScreen.appendChild(deathTitle)

    this.deathCountdown = document.createElement('div')
    this.deathCountdown.style.cssText = 'color: rgba(255,255,255,0.7); font-size: 1.1rem;'
    this.deathCountdown.textContent = 'Respawning in 5s...'
    this.deathScreen.appendChild(this.deathCountdown)

    document.body.appendChild(this.deathScreen)

    // ─── Damage numbers container ─────────────────────────────────────────────
    this.damageContainer = document.createElement('div')
    this.damageContainer.id = 'combat-damage-container'
    this.damageContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 60;'
    document.body.appendChild(this.damageContainer)
  }

  // ─── Target frame ───────────────────────────────────────────────────────────

  setTarget(name: string, health: number, maxHealth: number): void {
    this.targetFrame.style.display = 'block'
    this.targetName.textContent = name
    const pct = maxHealth > 0 ? Math.max(0, health / maxHealth * 100) : 0
    this.targetHealthFill.style.width = pct + '%'

    if (pct > 50) this.targetHealthFill.style.background = '#44cc44'
    else if (pct > 25) this.targetHealthFill.style.background = '#cccc44'
    else this.targetHealthFill.style.background = '#cc4444'
  }

  clearTarget(): void {
    this.targetFrame.style.display = 'none'
  }

  // ─── Player stats ───────────────────────────────────────────────────────────

  updatePlayerStats(hp: number, maxHp: number, xp: number, level: number, gold: number): void {
    const hpPct = maxHp > 0 ? Math.max(0, hp / maxHp * 100) : 0
    this.hpFill.style.width = hpPct + '%'
    this.hpText.textContent = `${Math.max(0, hp)}/${maxHp}`

    // HP bar color
    if (hpPct > 50) this.hpFill.style.background = '#44cc44'
    else if (hpPct > 25) this.hpFill.style.background = '#cccc44'
    else this.hpFill.style.background = '#cc4444'

    // XP bar — XP needed per level = level * 100
    const xpForLevel = level * 100
    const xpPct = xpForLevel > 0 ? ((xp % xpForLevel) / xpForLevel * 100) : 0
    this.xpFill.style.width = xpPct + '%'

    this.levelText.textContent = `Lv.${level}`
    this.goldText.textContent = `💰 ${gold}`
  }

  // ─── Damage numbers ─────────────────────────────────────────────────────────

  showDamage(amount: number, x: number, y: number, isPlayerDamage: boolean): void {
    const el = document.createElement('div')
    el.textContent = `-${amount}`
    el.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px;
      color: ${isPlayerDamage ? '#ff4444' : '#ffdd00'}; font-size: ${isPlayerDamage ? '1.3rem' : '1.5rem'}; font-weight: bold;
      text-shadow: 2px 2px 4px black; pointer-events: none; z-index: 60;
      animation: combatFloatUp 1s ease-out forwards;
    `
    this.damageContainer.appendChild(el)
    setTimeout(() => el.remove(), 1000)
  }

  // ─── Death screen ───────────────────────────────────────────────────────────

  showDeath(respawnSeconds: number): void {
    this.deathScreen.style.display = 'flex'
    let remaining = respawnSeconds
    this.deathCountdown.textContent = `Respawning in ${remaining}s...`

    const interval = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        this.deathScreen.style.display = 'none'
        clearInterval(interval)
      } else {
        this.deathCountdown.textContent = `Respawning in ${remaining}s...`
      }
    }, 1000)
  }

  hideDeath(): void {
    this.deathScreen.style.display = 'none'
  }

  // ─── Attack button ──────────────────────────────────────────────────────────

  onAttackClick(callback: () => void): void {
    this.attackBtn.addEventListener('click', callback)
  }

  // ─── CSS injection ──────────────────────────────────────────────────────────

  private injectStyles(): void {
    if (document.getElementById('combat-ui-styles')) return
    const style = document.createElement('style')
    style.id = 'combat-ui-styles'
    style.textContent = `
      @keyframes combatFloatUp {
        0% { opacity: 1; transform: translateY(0) scale(1); }
        50% { opacity: 1; transform: translateY(-30px) scale(1.1); }
        100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
      }
    `
    document.head.appendChild(style)
  }
}
