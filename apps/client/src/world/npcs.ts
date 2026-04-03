import { Scene } from '@babylonjs/core/scene'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { StackPanel } from '@babylonjs/gui/2D/controls/stackPanel'
import { Control } from '@babylonjs/gui/2D/controls/control'
import type { NPC } from '../types.js'
import { getHeightAtPosition } from './island.js'

/** Shared fullscreen UI for NPC labels */
let npcUI: AdvancedDynamicTexture | null = null

interface NPCMeshData {
  id: string
  root: TransformNode
  bodyMesh: Mesh
  labelContainer: Rectangle
  healthBar?: Rectangle
  healthFill?: Rectangle
  npcData: NPC
}

const npcMeshes = new Map<string, NPCMeshData>()

/**
 * Get or create the shared NPC UI layer.
 */
function getUI(scene: Scene): AdvancedDynamicTexture {
  if (!npcUI) {
    npcUI = AdvancedDynamicTexture.CreateFullscreenUI('npcUI', true, scene)
  }
  return npcUI
}

/**
 * Create or update all NPC meshes from server state.
 */
export function updateNPCs(scene: Scene, npcs: NPC[]): void {
  const activeIds = new Set<string>()

  for (const npc of npcs) {
    activeIds.add(npc.id)

    let data = npcMeshes.get(npc.id)

    if (!data) {
      // Create new NPC mesh
      data = createNPCMesh(scene, npc)
      npcMeshes.set(npc.id, data)
    }

    // Update NPC state
    data.npcData = npc

    // Set position (use terrain height)
    const terrainY = getHeightAtPosition(npc.x, npc.z)
    data.root.position.x = npc.x
    data.root.position.z = npc.z

    if (npc.type === 'enemy') {
      // Slimes sit on the ground
      data.root.position.y = terrainY + 0.4
    } else {
      // NPCs stand on the ground
      data.root.position.y = terrainY + 0.7
    }

    data.root.rotation = new Vector3(0, npc.rotY, 0)

    // Handle dead/alive state for enemies
    if (npc.type === 'enemy') {
      if (npc.isDead) {
        data.bodyMesh.scaling = new Vector3(1, 0.1, 1)
        const mat = data.bodyMesh.material as StandardMaterial
        if (mat) {
          mat.diffuseColor = new Color3(0.3, 0.3, 0.3)
          mat.alpha = 0.5
        }
        data.labelContainer.isVisible = false
      } else {
        data.bodyMesh.scaling = new Vector3(1, 1, 1)
        // Restore color
        const mat = data.bodyMesh.material as StandardMaterial
        if (mat) {
          mat.alpha = 1
          if (npc.name.includes('Green')) mat.diffuseColor = new Color3(0.2, 0.8, 0.2)
          else if (npc.name.includes('Blue')) mat.diffuseColor = new Color3(0.2, 0.4, 0.9)
          else if (npc.name.includes('Red')) mat.diffuseColor = new Color3(0.9, 0.2, 0.2)
        }
        data.labelContainer.isVisible = true
      }

      // Update health bar
      if (data.healthFill && npc.health !== undefined && npc.maxHealth !== undefined && npc.maxHealth > 0) {
        const pct = Math.max(0, npc.health / npc.maxHealth)
        data.healthFill.width = `${Math.round(pct * 60)}px`
        if (pct > 0.5) data.healthFill.background = '#44cc44'
        else if (pct > 0.25) data.healthFill.background = '#cccc44'
        else data.healthFill.background = '#cc4444'
      }
    }
  }

  // Remove NPCs that are no longer in server state
  for (const [id, data] of npcMeshes) {
    if (!activeIds.has(id)) {
      data.root.dispose()
      data.labelContainer.dispose()
      npcMeshes.delete(id)
    }
  }
}

/**
 * Create a mesh for an NPC based on its type.
 */
function createNPCMesh(scene: Scene, npc: NPC): NPCMeshData {
  const root = new TransformNode(`npc_root_${npc.id}`, scene)
  const ui = getUI(scene)

  let bodyMesh: Mesh
  let healthBar: Rectangle | undefined
  let healthFill: Rectangle | undefined

  if (npc.type === 'enemy') {
    // Slime: squashed sphere (wider than tall)
    bodyMesh = MeshBuilder.CreateSphere(
      `npc_body_${npc.id}`,
      { diameter: 1.2, segments: 12 },
      scene,
    )
    bodyMesh.scaling = new Vector3(1, 0.6, 1)

    const mat = new StandardMaterial(`npc_mat_${npc.id}`, scene)
    if (npc.name.includes('Green')) {
      mat.diffuseColor = new Color3(0.2, 0.8, 0.2)
      mat.emissiveColor = new Color3(0.05, 0.15, 0.05)
    } else if (npc.name.includes('Blue')) {
      mat.diffuseColor = new Color3(0.2, 0.4, 0.9)
      mat.emissiveColor = new Color3(0.05, 0.08, 0.2)
    } else if (npc.name.includes('Red')) {
      mat.diffuseColor = new Color3(0.9, 0.2, 0.2)
      mat.emissiveColor = new Color3(0.2, 0.05, 0.05)
    } else {
      mat.diffuseColor = new Color3(0.5, 0.8, 0.3)
    }
    mat.specularColor = new Color3(0.4, 0.4, 0.4)
    bodyMesh.material = mat

    // Eyes for slime (two small white spheres)
    const eyeL = MeshBuilder.CreateSphere(`npc_eyeL_${npc.id}`, { diameter: 0.2 }, scene)
    const eyeR = MeshBuilder.CreateSphere(`npc_eyeR_${npc.id}`, { diameter: 0.2 }, scene)
    const eyeMat = new StandardMaterial(`npc_eyeMat_${npc.id}`, scene)
    eyeMat.diffuseColor = new Color3(1, 1, 1)
    eyeMat.emissiveColor = new Color3(0.3, 0.3, 0.3)
    eyeL.material = eyeMat
    eyeR.material = eyeMat
    eyeL.position = new Vector3(-0.2, 0.15, 0.4)
    eyeR.position = new Vector3(0.2, 0.15, 0.4)
    eyeL.parent = bodyMesh
    eyeR.parent = bodyMesh

  } else if (npc.type === 'quest_giver') {
    // Quest giver: taller capsule (green)
    bodyMesh = MeshBuilder.CreateCylinder(
      `npc_body_${npc.id}`,
      { height: 1.6, diameter: 0.7, tessellation: 12 },
      scene,
    )
    const mat = new StandardMaterial(`npc_mat_${npc.id}`, scene)
    mat.diffuseColor = new Color3(0.2, 0.7, 0.3)
    mat.specularColor = new Color3(0.2, 0.2, 0.2)
    bodyMesh.material = mat

    // Head
    const head = MeshBuilder.CreateSphere(`npc_head_${npc.id}`, { diameter: 0.55, segments: 8 }, scene)
    head.position.y = 1.1
    head.material = mat
    head.parent = bodyMesh

    // Yellow "!" floating above
    const excl = MeshBuilder.CreateCylinder(
      `npc_excl_${npc.id}`,
      { height: 0.4, diameterTop: 0.08, diameterBottom: 0.12, tessellation: 6 },
      scene,
    )
    const exclMat = new StandardMaterial(`npc_exclMat_${npc.id}`, scene)
    exclMat.diffuseColor = new Color3(1, 0.85, 0)
    exclMat.emissiveColor = new Color3(0.5, 0.4, 0)
    excl.material = exclMat
    excl.position.y = 1.8
    excl.parent = bodyMesh

    // Dot under the "!"
    const dot = MeshBuilder.CreateSphere(`npc_dot_${npc.id}`, { diameter: 0.12 }, scene)
    dot.material = exclMat
    dot.position.y = 1.5
    dot.parent = bodyMesh

  } else {
    // Merchant: taller capsule (purple)
    bodyMesh = MeshBuilder.CreateCylinder(
      `npc_body_${npc.id}`,
      { height: 1.6, diameter: 0.7, tessellation: 12 },
      scene,
    )
    const mat = new StandardMaterial(`npc_mat_${npc.id}`, scene)
    mat.diffuseColor = new Color3(0.6, 0.2, 0.8)
    mat.specularColor = new Color3(0.2, 0.2, 0.2)
    bodyMesh.material = mat

    // Head
    const head = MeshBuilder.CreateSphere(`npc_head_${npc.id}`, { diameter: 0.55, segments: 8 }, scene)
    head.position.y = 1.1
    head.material = mat
    head.parent = bodyMesh

    // Bag icon (small box)
    const bag = MeshBuilder.CreateBox(`npc_bag_${npc.id}`, { size: 0.3 }, scene)
    const bagMat = new StandardMaterial(`npc_bagMat_${npc.id}`, scene)
    bagMat.diffuseColor = new Color3(0.8, 0.6, 0.2)
    bagMat.emissiveColor = new Color3(0.2, 0.15, 0.05)
    bag.material = bagMat
    bag.position.y = 1.7
    bag.parent = bodyMesh
  }

  bodyMesh.parent = root

  // ─── Label (nameplate + health bar) ─────────────────────────────────────

  const labelContainer = new Rectangle(`npc_label_${npc.id}`)
  labelContainer.width = '80px'
  labelContainer.adaptHeightToChildren = true
  labelContainer.color = 'transparent'
  labelContainer.background = 'transparent'
  labelContainer.thickness = 0
  ui.addControl(labelContainer)

  const stack = new StackPanel(`npc_stack_${npc.id}`)
  stack.isVertical = true
  labelContainer.addControl(stack)

  // Name text
  const nameText = new TextBlock(`npc_name_${npc.id}`, npc.name)
  nameText.color = npc.type === 'enemy' ? '#ff6666' : npc.type === 'quest_giver' ? '#66ff66' : '#cc88ff'
  nameText.fontSize = 11
  nameText.fontFamily = 'Segoe UI, sans-serif'
  nameText.fontWeight = '600'
  nameText.height = '16px'
  nameText.textWrapping = true
  stack.addControl(nameText)

  // Health bar for enemies
  if (npc.type === 'enemy') {
    healthBar = new Rectangle(`npc_hpBg_${npc.id}`)
    healthBar.width = '60px'
    healthBar.height = '6px'
    healthBar.background = '#333'
    healthBar.color = '#555'
    healthBar.thickness = 1
    healthBar.cornerRadius = 2
    healthBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER
    stack.addControl(healthBar)

    healthFill = new Rectangle(`npc_hpFill_${npc.id}`)
    healthFill.width = '60px'
    healthFill.height = '6px'
    healthFill.background = '#44cc44'
    healthFill.color = 'transparent'
    healthFill.thickness = 0
    healthFill.cornerRadius = 2
    healthFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT
    healthBar.addControl(healthFill)
  }

  // Link label to the root transform node's body mesh
  labelContainer.linkWithMesh(bodyMesh)
  labelContainer.linkOffsetY = npc.type === 'enemy' ? -40 : -70

  return {
    id: npc.id,
    root,
    bodyMesh,
    labelContainer,
    healthBar,
    healthFill,
    npcData: npc,
  }
}

/**
 * Get the NPC mesh data for a given NPC ID.
 */
export function getNPCMeshData(npcId: string): NPCMeshData | undefined {
  return npcMeshes.get(npcId)
}

/**
 * Get all NPC mesh data entries.
 */
export function getAllNPCMeshData(): Map<string, NPCMeshData> {
  return npcMeshes
}

/**
 * Dispose all NPC meshes and UI.
 */
export function disposeNPCs(): void {
  for (const data of npcMeshes.values()) {
    data.root.dispose()
    data.labelContainer.dispose()
  }
  npcMeshes.clear()
  if (npcUI) {
    npcUI.dispose()
    npcUI = null
  }
}
