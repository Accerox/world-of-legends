/**
 * Sound system for World of Legends.
 *
 * - Ambient sounds: music, birds, waves (loop, volume based on location)
 * - SFX: footsteps, attack, death, levelup, chat ping
 * - Footsteps sync with walking animation (400ms walk, 250ms run)
 * - Waves volume increases near water (low terrain height)
 * - All sounds start muted, unmute on first user interaction (browser policy)
 * - Generated sounds (footsteps, attack, chat ping) use Web Audio API
 */

interface SoundConfig {
  src: string
  loop: boolean
  volume: number
  category: 'music' | 'ambient' | 'sfx'
}

export class SoundManager {
  private audioCtx: AudioContext | null = null
  private sounds: Map<string, HTMLAudioElement> = new Map()
  private enabled = true
  private musicVolume = 0.15
  private sfxVolume = 0.5
  private ambientVolume = 0.3

  // Footstep timer
  private footstepInterval: number | null = null
  private isWalking = false
  private isRunning = false

  // Track ambient state
  private ambientStarted = false

  // Music oscillators (for muting)
  private musicOscillators: OscillatorNode[] = []
  private musicGain: GainNode | null = null

  private musicStarted = false

  constructor() {
    // Create AudioContext on first user interaction (browser requirement)
    const initAudio = () => {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext()
        // Start music if ambient was already requested
        if (this.ambientStarted && !this.musicStarted) {
          this.startAmbientMusic()
        }
      }
      document.removeEventListener('click', initAudio)
      document.removeEventListener('keydown', initAudio)
    }
    document.addEventListener('click', initAudio)
    document.addEventListener('keydown', initAudio)
  }

  /**
   * Preload all audio files from public/audio/.
   */
  async init(): Promise<void> {
    const files: Record<string, SoundConfig> = {
      'birds': { src: '/audio/birds.mp3', loop: true, volume: this.ambientVolume, category: 'ambient' },
      'waves': { src: '/audio/waves.mp3', loop: true, volume: 0, category: 'ambient' }, // Volume controlled by proximity
      'death': { src: '/audio/death.mp3', loop: false, volume: this.sfxVolume, category: 'sfx' },
      'levelup': { src: '/audio/levelup.mp3', loop: false, volume: this.sfxVolume, category: 'sfx' },
    }

    for (const [name, config] of Object.entries(files)) {
      const audio = new Audio(config.src)
      audio.loop = config.loop
      audio.volume = config.volume
      audio.preload = 'auto'
      this.sounds.set(name, audio)
    }

    console.log('[WOL:Audio] Sound system initialized')
  }

  // ─── Ambient Controls ───────────────────────────────────────────────────────

  /**
   * Start ambient sounds (call after user enters the world).
   * Safe to call multiple times — only starts once.
   */
  startAmbient(): void {
    if (!this.enabled) return
    this.ambientStarted = true
    this.sounds.get('birds')?.play().catch(() => {})
    this.sounds.get('waves')?.play().catch(() => {})
    this.startAmbientMusic()
    console.log('[WOL:Audio] Ambient sounds started')
  }

  /** Ambient music removed — was annoying single-note drone */
  private startAmbientMusic(): void {
    // No-op: ambient music disabled
  }

  /**
   * Update waves volume based on player terrain height.
   * Lower terrain = closer to water = louder waves.
   *
   * @param terrainHeight - Height of terrain at player position
   */
  /**
   * Update waves volume based on player position.
   * Uses distance from island center — closer to edge = closer to ocean = louder waves.
   * 
   * @param playerX - Player X position
   * @param playerZ - Player Z position  
   * @param islandRadius - Radius of the island (default 95)
   */
  updatePosition(playerX: number, playerZ: number, islandRadius: number = 95): void {
    const waves = this.sounds.get('waves')
    if (waves) {
      // Distance from center of island
      const distFromCenter = Math.sqrt(playerX * playerX + playerZ * playerZ)
      // How close to the edge (0 = center, 1 = edge)
      const edgeProximity = distFromCenter / islandRadius
      // Only audible when close to the edge (>70% of radius)
      const vol = edgeProximity > 0.7
        ? Math.min(1, (edgeProximity - 0.7) / 0.3) * this.ambientVolume * 0.6
        : 0
      waves.volume = vol
    }
  }

  // ─── Footsteps ──────────────────────────────────────────────────────────────

  /**
   * Start playing footstep sounds at intervals matching walk/run speed.
   *
   * @param running - If true, faster footstep interval (250ms vs 400ms)
   */
  startWalking(running: boolean = false): void {
    if (this.isWalking && this.isRunning === running) return
    this.stopWalking()
    this.isWalking = true
    this.isRunning = running
    const interval = running ? 250 : 400 // ms between steps
    // Play first step immediately
    this.playFootstep()
    this.footstepInterval = window.setInterval(() => {
      this.playFootstep()
    }, interval)
  }

  /**
   * Stop footstep sounds.
   */
  stopWalking(): void {
    if (this.footstepInterval) {
      clearInterval(this.footstepInterval)
      this.footstepInterval = null
    }
    this.isWalking = false
    this.isRunning = false
  }

  /**
   * Generate a single footstep sound using Web Audio API.
   * Short low-frequency thump with slight randomization.
   */
  private playFootstep(): void {
    if (!this.audioCtx || !this.enabled) return
    const ctx = this.audioCtx

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    // Soft low-frequency thump with random variation
    const baseFreq = 60 + Math.random() * 30
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(this.sfxVolume * 0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  }

  // ─── Generated SFX ──────────────────────────────────────────────────────────

  /**
   * Play attack/hit sound — white noise burst + low thump.
   */
  playAttack(): void {
    if (!this.audioCtx || !this.enabled) return
    const ctx = this.audioCtx

    // White noise burst for impact
    const bufferSize = Math.floor(ctx.sampleRate * 0.1)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(this.sfxVolume * 0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)

    // Add a low thump for body
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.frequency.setValueAtTime(150, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.08)
    oscGain.gain.setValueAtTime(this.sfxVolume * 0.3, ctx.currentTime)
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)

    source.connect(gain)
    gain.connect(ctx.destination)
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)

    source.start()
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  }

  /**
   * Play chat notification — soft two-tone ping.
   */
  playChatPing(): void {
    if (!this.audioCtx || !this.enabled) return
    const ctx = this.audioCtx

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    // Two-tone ping: 880Hz then 1100Hz
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.05)
    gain.gain.setValueAtTime(this.sfxVolume * 0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  }

  // ─── Preloaded SFX ─────────────────────────────────────────────────────────

  /**
   * Play a preloaded sound effect by name.
   *
   * @param name - Sound name: 'death', 'levelup'
   */
  playSFX(name: string): void {
    const audio = this.sounds.get(name)
    if (audio && this.enabled) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    }
  }

  // ─── Toggle / State ─────────────────────────────────────────────────────────

  /**
   * Toggle all sound on/off.
   */
  toggle(): void {
    this.enabled = !this.enabled
    if (!this.enabled) {
      // Mute everything — suspend AudioContext to kill ALL Web Audio sounds
      this.sounds.forEach((s) => s.pause())
      this.stopWalking()
      this.audioCtx?.suspend()
    } else {
      // Unmute — resume AudioContext
      this.audioCtx?.resume()
      if (this.ambientStarted) this.startAmbient()
    }
    console.log(`[WOL:Audio] Sound ${this.enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Whether sound is currently muted.
   */
  get isMuted(): boolean {
    return !this.enabled
  }
}
