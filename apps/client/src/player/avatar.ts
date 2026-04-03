import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup'
import { AssetContainer } from '@babylonjs/core/assetContainer'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import '@babylonjs/loaders/glTF'

const ASSETS_URL = 'https://wol-assets.lucas-i-carrizo.workers.dev'

// Cache loaded containers
const containerCache: Map<string, AssetContainer> = new Map()

async function loadContainer(scene: Scene, url: string, file: string): Promise<AssetContainer | null> {
  const key = url + file
  if (containerCache.has(key)) return containerCache.get(key)!
  try {
    const c = await SceneLoader.LoadAssetContainerAsync(url, file, scene)
    containerCache.set(key, c)
    return c
  } catch (e) {
    console.warn(`[WOL] Failed to load: ${url}${file}`, e)
    return null
  }
}

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

export async function createAnimatedAvatar(
  scene: Scene,
  playerId: string,
  race: string = 'human',
  isLocal: boolean = false,
): Promise<AnimatedAvatar> {
  const root = new TransformNode(`avatar_root_${playerId}`, scene)
  const modelPivot = new TransformNode(`avatar_pivot_${playerId}`, scene)
  modelPivot.parent = root
  modelPivot.rotation.y = Math.PI // Meshy/Mixamo models face -Z, rotate to match game +Z forward

  // Load all animation GLBs — each has its own model + animation
  const raceUrl = `${ASSETS_URL}/models/races/`
  const animUrl = `${ASSETS_URL}/models/animations/`

  // Standard animation sources — each is a complete model+animation GLB
  const animSources: { name: string; url: string; file: string; loop: boolean; speed: number }[] = [
    { name: 'Walking', url: raceUrl, file: `${race}-walk.glb`, loop: true, speed: 1.0 },
    { name: 'Running', url: raceUrl, file: `${race}-run.glb`, loop: true, speed: 1.0 },
    { name: 'WalkingBack', url: raceUrl, file: `${race}-walk.glb`, loop: true, speed: -1.0 },
    { name: 'Attack', url: animUrl, file: 'attack.glb', loop: false, speed: 1.5 },
    { name: 'Dance', url: animUrl, file: 'dance.glb', loop: true, speed: 1.0 },
    { name: 'Death', url: animUrl, file: 'death.glb', loop: false, speed: 1.0 },
    { name: 'SpellCast', url: animUrl, file: 'spellcast.glb', loop: false, speed: 1.0 },
    { name: 'Block', url: animUrl, file: 'block.glb', loop: false, speed: 1.0 },
    { name: 'Victory', url: animUrl, file: 'victory.glb', loop: false, speed: 1.0 },
  ]

  // Each "slot" is an instantiated model with its animation
  interface AnimSlot {
    rootNode: TransformNode
    animGroup: AnimationGroup | null
    loop: boolean
    speed: number
  }

  const slots: Map<string, AnimSlot> = new Map()
  let currentSlot: string = ''

  // ─── Special Idle slot: race model + idle animation retargeted ───────────────
  // Load the race model (correct appearance) and the idle animation (from shared GLB).
  // Since all Meshy models share the same 24-bone Mixamo skeleton, the animation
  // from idle.glb can be applied directly to the race model's skeleton.
  const raceContainer = await loadContainer(scene, raceUrl, `${race}-rigged.glb`)
  const idleAnimContainer = await loadContainer(scene, animUrl, 'idle.glb')

  if (raceContainer) {
    const raceInstance = raceContainer.instantiateModelsToScene(
      (name) => `${name}_Idle_${playerId}`,
      false,
    )
    const raceRoot = raceInstance.rootNodes[0] as TransformNode
    raceRoot.parent = modelPivot
    raceRoot.scaling = new Vector3(1, 1, 1)
    raceRoot.setEnabled(false)

    // Try to retarget idle animation onto the race model's skeleton
    let idleAnim: AnimationGroup | null = null
    if (idleAnimContainer) {
      // Instantiate idle.glb just to get its animation group
      const idleInstance = idleAnimContainer.instantiateModelsToScene(
        (name) => `${name}_IdleAnim_${playerId}`,
        false,
      )
      const idleAnimGroup = idleInstance.animationGroups[0] || null

      if (idleAnimGroup) {
        // Clone the animation and retarget it to the race model's skeleton bones
        // Both use the same Mixamo bone names, so we match by name
        const cloned = idleAnimGroup.clone(`idle_retarget_${playerId}`)

        // Map animation targets from idle model bones to race model bones by name
        const raceBones = new Map<string, TransformNode>()
        raceRoot.getChildTransformNodes(false).forEach((node) => {
          // Strip the instance suffix to get the base bone name
          const baseName = node.name.replace(`_Idle_${playerId}`, '')
          raceBones.set(baseName, node)
        })

        // Retarget animation channels, stripping scale channels.
        // idle.glb has baked Hips scale=1.176 from a different Mixamo source
        // character, causing a 17.6% size increase if applied to race models.
        // Mixamo doesn't use scale for actual animation — it's purely compensatory.
        for (let i = cloned.targetedAnimations.length - 1; i >= 0; i--) {
          const ta = cloned.targetedAnimations[i]

          // Remove scale channels to prevent size mismatch
          if (ta.animation.targetProperty === 'scaling') {
            cloned.targetedAnimations.splice(i, 1)
            continue
          }

          const targetName = (ta.target as TransformNode).name?.replace(`_IdleAnim_${playerId}`, '') || ''
          const raceTarget = raceBones.get(targetName)
          if (raceTarget) {
            ta.target = raceTarget
          }
        }

        idleAnim = cloned
        idleAnim.stop()

        // Hide the idle model instance (we only needed its animation)
        for (const node of idleInstance.rootNodes) {
          (node as TransformNode).dispose(false, true)
        }
        idleAnimGroup.dispose()
      }
    }

    slots.set('Idle', {
      rootNode: raceRoot,
      animGroup: idleAnim,
      loop: true,
      speed: 1.0,
    })
  }

  // ─── Standard animation slots ───────────────────────────────────────────────
  for (const src of animSources) {
    const container = await loadContainer(scene, src.url, src.file)
    if (!container) continue

    const instance = container.instantiateModelsToScene(
      (name) => `${name}_${src.name}_${playerId}`,
      false,
    )

    const instRoot = instance.rootNodes[0] as TransformNode
    instRoot.parent = modelPivot
    // Force uniform scale across all animation models to prevent size changes
    instRoot.scaling = new Vector3(1, 1, 1)
    instRoot.setEnabled(false) // Hidden by default

    const ag = instance.animationGroups[0] || null
    if (ag) ag.stop()

    slots.set(src.name, {
      rootNode: instRoot,
      animGroup: ag,
      loop: src.loop,
      speed: src.speed,
    })
  }

  // Fallback: if no Idle loaded, use first available
  if (!slots.has('Idle') && slots.size > 0) {
    const first = slots.entries().next().value
    if (first) slots.set('Idle', first[1])
  }

  console.log(`[WOL] Avatar ${playerId}: ${slots.size} animation slots loaded:`, [...slots.keys()])

  // Switch animation: hide current model, show new model, play its animation
  const switchTo = (name: string) => {
    if (currentSlot === name) return
    const newSlot = slots.get(name) || slots.get('Idle')
    if (!newSlot) return

    // Hide current
    const oldSlot = slots.get(currentSlot)
    if (oldSlot) {
      oldSlot.rootNode.setEnabled(false)
      oldSlot.animGroup?.stop()
    }

    // Show new
    newSlot.rootNode.setEnabled(true)
    if (newSlot.animGroup) {
      const absSpeed = Math.abs(newSlot.speed)
      newSlot.animGroup.speedRatio = absSpeed

      if (newSlot.speed < 0) {
        // Reverse playback: start from end frame, play toward start frame
        const from = newSlot.animGroup.to
        const to = newSlot.animGroup.from
        newSlot.animGroup.start(newSlot.loop, absSpeed, from, to)
      } else {
        newSlot.animGroup.start(newSlot.loop)
      }

      // For non-looping animations, return to idle when done
      if (!newSlot.loop) {
        newSlot.animGroup.onAnimationGroupEndObservable.addOnce(() => {
          switchTo('Idle')
        })
      }
    }
    currentSlot = name
  }

  const avatar: AnimatedAvatar = {
    root,
    playIdle: () => switchTo('Idle'),
    playWalk: () => switchTo('Walking'),
    playRun: () => switchTo('Running'),
    playWalkBack: () => switchTo('WalkingBack'),
    playStrafeLeft: () => switchTo('Walking'),
    playStrafeRight: () => switchTo('Walking'),
    playJump: () => { /* no-op: physics handles jump visually, keep current animation */ },
    playAttack: () => switchTo('Attack'),
    playDance: () => switchTo('Dance'),

    setVisualYaw: (angle: number) => {
      // angle is relative offset (0=forward, PI/4=diagonal, etc.)
      // modelPivot base is Math.PI (to flip -Z facing models to +Z)
      // so target = PI + angle
      const target = Math.PI + angle
      const diff = target - modelPivot.rotation.y
      modelPivot.rotation.y += diff * 0.2
    },

    stopAll: () => {
      for (const [, slot] of slots) {
        slot.rootNode.setEnabled(false)
        slot.animGroup?.stop()
      }
    },

    dispose: () => {
      for (const [, slot] of slots) {
        slot.animGroup?.dispose()
        slot.rootNode.dispose(false, true)
      }
      modelPivot.dispose()
      root.dispose()
    },
  }

  // Start with idle
  switchTo('Idle')

  return avatar
}
