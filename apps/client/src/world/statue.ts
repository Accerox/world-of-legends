/**
 * Display race statues + animation gallery using human model.
 */

import { Scene } from '@babylonjs/core/scene'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { AssetContainer } from '@babylonjs/core/assetContainer'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { getHeightAtPosition } from './island.js'
import '@babylonjs/loaders/glTF'

const ASSETS_URL = 'https://wol-assets.lucas-i-carrizo.workers.dev'

const RACES = [
  { name: 'Human', file: 'human-rigged.glb', scale: 1.5 },
  { name: 'Prismari', file: 'prismari-rigged.glb', scale: 1.5 },
  { name: 'Forjado', file: 'forjado-rigged.glb', scale: 1.5 },
  { name: 'Umbralis', file: 'umbralis-rigged.glb', scale: 1.5 },
  { name: 'Draconid', file: 'draconid-rigged.glb', scale: 1.5 },
  { name: 'Sylvani', file: 'sylvani-rigged.glb', scale: 1.5 },
  { name: 'Titan', file: 'titan-rigged.glb', scale: 1.5 },
  { name: 'Kitsune', file: 'kitsune-rigged.glb', scale: 1.5 },
]

const ANIM_GALLERY = [
  { file: 'idle.glb', name: 'Idle', label: 'Idle' },
  { file: 'attack.glb', name: 'Attack', label: 'Attack' },
  { file: 'doublecombo.glb', name: 'DoubleCombo', label: 'Double Combo' },
  { file: 'jump.glb', name: 'Jump', label: 'Jump' },
  { file: 'dance.glb', name: 'Dance', label: 'Dance' },
  { file: 'walkback.glb', name: 'WalkBack', label: 'Walk Back' },
  { file: 'death.glb', name: 'Death', label: 'Death' },
  { file: 'hitreaction.glb', name: 'HitReaction', label: 'Hit Reaction' },
  { file: 'spellcast.glb', name: 'SpellCast', label: 'Spell Cast' },
  { file: 'block.glb', name: 'Block', label: 'Block' },
  { file: 'dodge.glb', name: 'Dodge', label: 'Dodge' },
  { file: 'victory.glb', name: 'Victory', label: 'Victory' },
]

export async function createStatue(scene: Scene): Promise<void> {
  const pedestalMat = new StandardMaterial('pedestalMat', scene)
  pedestalMat.diffuseColor = new Color3(0.5, 0.48, 0.45)

  const labelMat = new StandardMaterial('labelMat', scene)
  labelMat.diffuseColor = new Color3(0.15, 0.15, 0.2)

  // ─── Race statues in a circle ─────────────────────────────────────────
  const raceCenter = { x: 0, z: -15 }
  const raceRadius = 12

  for (let i = 0; i < RACES.length; i++) {
    const race = RACES[i]
    const angle = (i / RACES.length) * Math.PI * 2
    const x = raceCenter.x + Math.cos(angle) * raceRadius
    const z = raceCenter.z + Math.sin(angle) * raceRadius
    const terrainY = getHeightAtPosition(x, z)

    const pedestal = MeshBuilder.CreateCylinder(`ped_race_${race.name}`, { height: 0.8, diameterTop: 1.4, diameterBottom: 1.8, tessellation: 8 }, scene)
    pedestal.position = new Vector3(x, terrainY + 0.4, z)
    pedestal.material = pedestalMat

    try {
      const result = await SceneLoader.ImportMeshAsync('', `${ASSETS_URL}/models/races/`, race.file, scene)
      const root = result.meshes[0]
      root.scaling = new Vector3(race.scale, race.scale, race.scale)
      root.position = new Vector3(x, terrainY + 0.8, z)
      root.rotation.y = -angle + Math.PI
      if (result.animationGroups.length > 0) {
        result.animationGroups.forEach(ag => ag.stop())
        result.animationGroups[0].start(true, 0.5)
      }
    } catch (e) { console.warn(`[WOL] Statue failed: ${race.name}`, e) }
  }

  // ─── Animation gallery — human model with each animation ──────────────
  const galleryCenter = { x: 25, z: 25 }
  const gallerySpacing = 4

  // Load human rigged model as container for cloning
  let humanContainer: AssetContainer | null = null
  try {
    humanContainer = await SceneLoader.LoadAssetContainerAsync(
      `${ASSETS_URL}/models/races/`, 'human-rigged.glb', scene
    )
  } catch (e) {
    console.warn('[WOL] Failed to load human model for gallery:', e)
    return
  }

  const cols = 4
  for (let i = 0; i < ANIM_GALLERY.length; i++) {
    const anim = ANIM_GALLERY[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = galleryCenter.x + col * gallerySpacing
    const z = galleryCenter.z + row * gallerySpacing
    const terrainY = getHeightAtPosition(x, z)

    // Pedestal
    const pedestal = MeshBuilder.CreateCylinder(`ped_anim_${anim.name}`, { height: 0.6, diameterTop: 1.2, diameterBottom: 1.5, tessellation: 8 }, scene)
    pedestal.position = new Vector3(x, terrainY + 0.3, z)
    pedestal.material = pedestalMat

    try {
      // Load the animation file (contains model + animation)
      const animResult = await SceneLoader.ImportMeshAsync('', `${ASSETS_URL}/models/animations/`, anim.file, scene)
      const root = animResult.meshes[0]
      root.scaling = new Vector3(1.0, 1.0, 1.0)
      root.position = new Vector3(x, terrainY + 0.6, z)
      root.rotation.y = Math.PI // Face the viewer

      // Play the animation in loop
      if (animResult.animationGroups.length > 0) {
        animResult.animationGroups.forEach(ag => ag.stop())
        const ag = animResult.animationGroups[0]
        ag.start(true, 1.0)
      }

      console.log(`[WOL] Gallery: ${anim.label}`)
    } catch (e) {
      console.warn(`[WOL] Gallery failed: ${anim.label}`, e)
    }
  }

  console.log('[WOL] Animation gallery loaded')
}
