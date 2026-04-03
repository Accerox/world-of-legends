import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup'
import { AssetContainer } from '@babylonjs/core/assetContainer'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import '@babylonjs/loaders/glTF' // CRITICAL: side-effect import for GLB loading

// ─── Assets URL for race-specific models ──────────────────────────────────────
const ASSETS_URL = 'https://wol-assets.lucas-i-carrizo.workers.dev'

// ─── Cached asset containers per race (loaded once, instantiated per player) ──
const assetContainers: Map<string, AssetContainer> = new Map()
const extraAnimContainers: Map<string, AssetContainer[]> = new Map()
const loadingPromises: Map<string, Promise<void>> = new Map()

// ─── Fallback: cached default model ──────────────────────────────────────────
let fallbackContainer: AssetContainer | null = null
let fallbackLoadingPromise: Promise<void> | null = null

/**
 * Animated avatar returned by createAnimatedAvatar.
 *
 * Architecture:
 *   root (TransformNode) — game-logic node, same convention as old capsule
 *     └── modelPivot (TransformNode) — visual offset (rotation.y = Math.PI, scaling)
 *           └── GLB model meshes + skeleton
 *
 * The `root` node is what the controller, camera, and network use for
 * position/rotation. It behaves identically to the old capsule Mesh.
 */
export interface AnimatedAvatar {
  root: TransformNode
  playIdle: () => void
  playWalk: () => void
  playRun: () => void
  playWalkBack: () => void
  playStrafeLeft: () => void
  playStrafeRight: () => void
  playJump: () => void
  playAttack: () => void
  playDance: () => void
  stopAll: () => void
  dispose: () => void
  setVisualYaw: (angle: number) => void
}

/**
 * Load the fallback character GLB (local /models/character.glb).
 */
async function ensureFallbackLoaded(scene: Scene): Promise<AssetContainer> {
  if (fallbackContainer) return fallbackContainer
  if (fallbackLoadingPromise) {
    await fallbackLoadingPromise
    return fallbackContainer!
  }

  fallbackLoadingPromise = (async () => {
    console.log('[WOL] Loading fallback character model...')
    fallbackContainer = await SceneLoader.LoadAssetContainerAsync(
      '/models/',
      'character.glb',
      scene,
    )
    console.log('[WOL] Fallback character model loaded')
  })()
  await fallbackLoadingPromise
  return fallbackContainer!
}

/**
 * Load a race-specific model from R2 into an AssetContainer.
 * Falls back to the default character.glb if the race model fails to load.
 */
async function ensureRaceModelLoaded(scene: Scene, race: string): Promise<AssetContainer> {
  // Check cache
  const cached = assetContainers.get(race)
  if (cached) return cached

  // Check if already loading
  const existing = loadingPromises.get(race)
  if (existing) {
    await existing
    return assetContainers.get(race) || await ensureFallbackLoaded(scene)
  }

  // Start loading from R2 — load rigged model + walk/run animations
  const promise = (async () => {
    try {
      const baseUrl = `${ASSETS_URL}/models/races/`
      console.log(`[WOL] Loading race model: ${race} from ${baseUrl}`)
      
      // Load main rigged model
      const container = await SceneLoader.LoadAssetContainerAsync(
        baseUrl,
        `${race}-rigged.glb`,
        scene,
      )
      
      // Rename the rigged model's animation to RigIdle (it's just a static pose)
      for (const ag of container.animationGroups) {
        ag.name = 'RigIdle'
      }

      // Load shared animations from R2 (same skeleton, reusable across all races)
      const animBaseUrl = `${ASSETS_URL}/models/animations/`
      const sharedAnims: [string, string][] = [
        ['idle.glb', 'Idle'],
        ['walkback.glb', 'WalkingBack'],
        ['jump.glb', 'Jump'],
        ['attack.glb', 'Attack'],
        ['doublecombo.glb', 'DoubleCombo'],
        ['dance.glb', 'Dance'],
        ['death.glb', 'Death'],
        ['hitreaction.glb', 'HitReaction'],
        ['spellcast.glb', 'SpellCast'],
        ['block.glb', 'Block'],
        ['dodge.glb', 'Dodge'],
        ['victory.glb', 'Victory'],
      ]

      // Also load race-specific walk and run
      const raceAnims: [string, string][] = [
        [`${baseUrl}${race}-walk.glb`, 'Walking'],
        [`${baseUrl}${race}-run.glb`, 'Running'],
      ]

      const extras: AssetContainer[] = []
      
      // Load shared animations
      for (const [file, name] of sharedAnims) {
        try {
          const ac = await SceneLoader.LoadAssetContainerAsync(animBaseUrl, file, scene)
          for (const ag of ac.animationGroups) ag.name = name
          extras.push(ac)
        } catch { console.log(`[WOL] No shared anim: ${name}`) }
      }

      // Load race-specific walk/run
      for (const [url, name] of raceAnims) {
        try {
          const parts = url.split('/')
          const file = parts.pop()!
          const base = parts.join('/') + '/'
          const ac = await SceneLoader.LoadAssetContainerAsync(base, file, scene)
          for (const ag of ac.animationGroups) ag.name = name
          extras.push(ac)
        } catch { console.log(`[WOL] No race anim: ${name}`) }
      }
      
      assetContainers.set(race, container)
      extraAnimContainers.set(race, extras)
      console.log(`[WOL] Race model loaded: ${race} (${extras.length} animations)`)
    } catch (err) {
      console.warn(`[WOL] Failed to load race model for ${race}, using fallback:`, err)
      const fb = await ensureFallbackLoaded(scene)
      assetContainers.set(race, fb)
    }
  })()

  loadingPromises.set(race, promise)
  await promise
  return assetContainers.get(race) || await ensureFallbackLoaded(scene)
}

/**
 * Create an animated 3D avatar for a player.
 *
 * Uses AssetContainer.instantiateModelsToScene() which is the Babylon.js
 * recommended way to clone animated models — it properly duplicates meshes,
 * skeletons, and animation groups per instance.
 *
 * @param scene - The Babylon.js scene
 * @param playerId - Unique player identifier
 * @param race - Race identifier for model selection (default: 'human')
 * @param isLocal - Whether this is the local player
 */
export async function createAnimatedAvatar(
  scene: Scene,
  playerId: string,
  race: string = 'human',
  isLocal: boolean = false,
): Promise<AnimatedAvatar> {
  const container = await ensureRaceModelLoaded(scene, race)

  // ─── Create the game-logic root node ────────────────────────────────────────
  // This node has the same position/rotation convention as the old capsule mesh.
  // The controller, camera, and network code all operate on this node.
  const root = new TransformNode(`avatar_root_${playerId}`, scene)

  // ─── Create a visual pivot for the model ────────────────────────────────────
  // The HVGirl model faces -Z by default. We rotate the pivot 180 degrees so
  // the model visually faces the same direction as the old capsule's forward (+Z
  // in the controller's convention: forward = sin(rotY), cos(rotY)).
  const modelPivot = new TransformNode(`avatar_pivot_${playerId}`, scene)
  modelPivot.parent = root
  
  // Detect model type by race — Meshy models are ~1.8 units tall, HVGirl is ~8 units
  const isMeshyModel = race !== '_fallback'
  const SCALE = isMeshyModel ? 1.0 : 0.1
  modelPivot.scaling = new Vector3(SCALE, SCALE, SCALE)
  modelPivot.position.y = 0

  // ─── Instantiate the model ──────────────────────────────────────────────────
  // instantiateModelsToScene creates a full clone: meshes + skeleton + animation groups
  const instance = container.instantiateModelsToScene(
    (name) => `${name}_${playerId}`,
    false, // don't clone materials — share them across instances
  )

  // Parent the instantiated model root under our visual pivot
  const modelRoot = instance.rootNodes[0] as TransformNode
  modelRoot.parent = modelPivot

  // ─── Build animation lookup ─────────────────────────────────────────────────
  const anims: Record<string, AnimationGroup> = {}
  
  // Add animations from the main model instance
  for (const ag of instance.animationGroups) {
    let baseName = ag.name.replace(`_${playerId}`, '')
    const lower = baseName.toLowerCase()
    if (lower.includes('walk')) baseName = 'Walking'
    else if (lower.includes('run')) baseName = 'Running'
    else if (lower.includes('idle') || lower.includes('clip0')) baseName = 'Idle'
    else if (lower.includes('back')) baseName = 'WalkingBack'
    else if (lower.includes('samba') || lower.includes('dance')) baseName = 'Samba'
    anims[baseName] = ag
    ag.stop()
  }
  
  // Instantiate extra animation containers (walk, run) and retarget to this model's skeleton
  const extras = extraAnimContainers.get(race) || []
  for (const extraContainer of extras) {
    const extraInstance = extraContainer.instantiateModelsToScene(
      (name) => `${name}_extra_${playerId}`,
      false,
    )
    // Hide the extra model meshes — we only want the animations
    for (const node of extraInstance.rootNodes) {
      node.setEnabled(false)
    }
    // Add the animation groups — they target the same bone names
    for (const ag of extraInstance.animationGroups) {
      let baseName = ag.name.replace(`_extra_${playerId}`, '')
      const lower = baseName.toLowerCase()
      if (lower.includes('walk')) baseName = 'Walking'
      else if (lower.includes('run')) baseName = 'Running'
      
      // Retarget: replace animation targets with our model's bones
      if (instance.skeletons.length > 0) {
        const skeleton = instance.skeletons[0]
        for (const targetedAnim of ag.targetedAnimations) {
          const boneName = targetedAnim.target?.name?.replace(`_extra_${playerId}`, `_${playerId}`)
          const bone = skeleton.bones.find(b => b.getTransformNode()?.name === boneName)
          if (bone) {
            targetedAnim.target = bone.getTransformNode()
          }
        }
      }
      
      anims[baseName] = ag
      ag.stop()
    }
  }
  
  console.log(`[WOL] Avatar animations for ${playerId}:`, Object.keys(anims))

  let currentAnim = ''
  let isRunningAnim = false
  let isJumping = false
  let isAttacking = false
  let isDancing = false
  let bounceTime = 0
  let jumpTime = 0
  let attackTime = 0
  let danceTime = 0

  // Get first available animation as fallback
  const fallbackAnim = Object.keys(anims)[0] || ''

  const playAnim = (name: string, loop: boolean = true, speedRatio: number = 1.0) => {
    if (currentAnim === name + speedRatio) return
    for (const a of Object.values(anims)) a.stop()
    // Try exact name, then fallback to first available animation
    const ag = anims[name] || anims[fallbackAnim]
    if (ag) {
      ag.speedRatio = speedRatio
      ag.start(loop)
      currentAnim = name + speedRatio
    }
  }

  const avatar: AnimatedAvatar = {
    root,

    // HVGirl animations: Idle, Walking, WalkingBack, Samba
    // Run = Walking at 2x speed + lean forward
    // Jump/Attack = visual effects on the pivot (no bone manipulation)
    playIdle: () => { isRunningAnim = false; isAttacking = false; isDancing = false; playAnim('Idle', true, 1.0) },
    playWalk: () => { isRunningAnim = false; isAttacking = false; isDancing = false; playAnim('Walking', true, 1.0) },
    playRun: () => { isRunningAnim = true; isAttacking = false; isDancing = false; playAnim('Running', true, 1.0) },
    playWalkBack: () => { isRunningAnim = false; isAttacking = false; isDancing = false; playAnim('Walking', true, -0.8) },
    playStrafeLeft: () => { isRunningAnim = false; isAttacking = false; isDancing = false; playAnim('Walking', true, 1.0) },
    playStrafeRight: () => { isRunningAnim = false; isAttacking = false; isDancing = false; playAnim('Walking', true, 1.0) },
    playJump: () => { 
      isRunningAnim = false; isAttacking = false; isDancing = false; jumpTime = 0; isJumping = true
      playAnim('Jump', false, 1.5)
      // Return to idle after jump animation ends
      const jumpAg = anims['Jump'] || anims[fallbackAnim]
      if (jumpAg) {
        jumpAg.onAnimationGroupEndObservable.addOnce(() => {
          isJumping = false
          playAnim('Idle', true, 1.0)
        })
      }
    },
    playAttack: () => { 
      isRunningAnim = false; isDancing = false; isAttacking = true; attackTime = 0
      playAnim('Attack', false, 1.5)
      // Return to idle after attack animation ends
      const attackAg = anims['Attack'] || anims[fallbackAnim]
      if (attackAg) {
        attackAg.onAnimationGroupEndObservable.addOnce(() => {
          isAttacking = false
          playAnim('Idle', true, 1.0)
        })
      }
    },
    playDance: () => { isRunningAnim = false; isAttacking = false; isDancing = true; danceTime = 0; playAnim('Dance', true, 1.0) },

    setVisualYaw: (angle: number) => {
      // Smoothly rotate the model pivot to show movement direction
      // This doesn't affect the game-logic root rotation
      const diff = angle - modelPivot.rotation.y
      modelPivot.rotation.y += diff * 0.2
    },

    stopAll: () => {
      for (const a of Object.values(anims)) a.stop()
    },

    dispose: () => {
      for (const a of Object.values(anims)) a.dispose()
      // Dispose all instantiated meshes
      for (const node of instance.rootNodes) {
        node.dispose(false, true)
      }
      // Dispose skeletons
      for (const skel of instance.skeletons) {
        skel.dispose()
      }
      modelPivot.dispose()
      root.dispose()
    },
  }

  const BASE_Y = 0

  // Visual effects on the PIVOT (not bones) — safe, no deformation
  scene.registerBeforeRender(() => {
    let targetLeanX = 0
    let targetY = BASE_Y
    let targetScaleY = SCALE
    let targetScaleXZ = SCALE

    if (isAttacking) {
      attackTime += 0.08
      if (attackTime < 0.5) {
        targetLeanX = -0.2
      } else if (attackTime < 1.0) {
        targetLeanX = 0.05
      } else {
        isAttacking = false
      }
    } else if (isDancing) {
      // Dance: bob up and down + rotate
      danceTime += 0.1
      targetY = BASE_Y + Math.abs(Math.sin(danceTime * 2)) * 0.15
      targetScaleY = SCALE * (1 + Math.sin(danceTime * 4) * 0.03)
      targetScaleXZ = SCALE * (1 - Math.sin(danceTime * 4) * 0.015)
      modelPivot.rotation.y += 0.03 // Slow spin
    } else if (!isRunningAnim && !isJumping && !isAttacking) {
      // Idle breathing effect — gentle scale pulse
      bounceTime += 0.02
      targetScaleY = SCALE * (1 + Math.sin(bounceTime) * 0.008)
      targetScaleXZ = SCALE * (1 - Math.sin(bounceTime) * 0.004)
    }
    
    if (isJumping) {
      jumpTime += 0.04
      if (jumpTime < 0.3) {
        // Crouch — squash
        targetScaleY = SCALE * 0.85
        targetScaleXZ = SCALE * 1.1
      } else if (jumpTime < 0.8) {
        // Air — stretch
        targetScaleY = SCALE * 1.1
        targetScaleXZ = SCALE * 0.95
        targetLeanX = -0.05
      } else if (jumpTime < 1.2) {
        // Land — squash again
        targetScaleY = SCALE * 0.9
        targetScaleXZ = SCALE * 1.05
      } else {
        isJumping = false
      }
    } else if (isRunningAnim) {
      bounceTime += 0.2
      targetLeanX = -0.1 // Lean forward
      targetY = BASE_Y + Math.abs(Math.sin(bounceTime)) * 0.04
    } else {
      bounceTime = 0
    }

    modelPivot.rotation.x += (targetLeanX - modelPivot.rotation.x) * 0.2
    modelPivot.position.y += (targetY - modelPivot.position.y) * 0.2
    modelPivot.scaling.y += (targetScaleY - modelPivot.scaling.y) * 0.2
    modelPivot.scaling.x += (targetScaleXZ - modelPivot.scaling.x) * 0.2
    modelPivot.scaling.z += (targetScaleXZ - modelPivot.scaling.z) * 0.2
  })

  // Start with idle animation
  console.log(`[WOL] Starting idle. Available anims:`, Object.keys(anims), 'Fallback:', fallbackAnim)
  avatar.playIdle()

  return avatar
}
