/**
 * Display all 8 race models as statues in a circle on the island.
 */

import { Scene } from '@babylonjs/core/scene'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { getHeightAtPosition } from './island.js'
import '@babylonjs/loaders/glTF'

interface RaceDisplay {
  name: string
  file: string
  scale: number
}

const RACES: RaceDisplay[] = [
  { name: 'Human', file: 'human-rigged.glb', scale: 1.5 },
  { name: 'Prismari', file: 'prismari-rigged.glb', scale: 1.5 },
  { name: 'Forjado', file: 'forjado-rigged.glb', scale: 1.5 },
  { name: 'Umbralis', file: 'umbralis-rigged.glb', scale: 1.5 },
  { name: 'Draconid', file: 'draconid-rigged.glb', scale: 1.5 },
  { name: 'Sylvani', file: 'sylvani-rigged.glb', scale: 1.5 },
  { name: 'Titan', file: 'titan-rigged.glb', scale: 1.5 },
  { name: 'Kitsune', file: 'kitsune-rigged.glb', scale: 1.5 },
]

export async function createStatue(scene: Scene): Promise<void> {
  const centerX = 0
  const centerZ = -15
  const radius = 12
  const pedestalMat = new StandardMaterial('pedestalMat', scene)
  pedestalMat.diffuseColor = new Color3(0.5, 0.48, 0.45)
  pedestalMat.specularColor = new Color3(0.2, 0.2, 0.2)

  const nameMat = new StandardMaterial('nameMat', scene)
  nameMat.diffuseColor = new Color3(0.7, 0.55, 0.1)

  for (let i = 0; i < RACES.length; i++) {
    const race = RACES[i]
    const angle = (i / RACES.length) * Math.PI * 2
    const x = centerX + Math.cos(angle) * radius
    const z = centerZ + Math.sin(angle) * radius
    const terrainY = getHeightAtPosition(x, z)

    // Pedestal
    const pedestal = MeshBuilder.CreateCylinder(`pedestal_${race.name}`, {
      height: 0.8,
      diameterTop: 1.4,
      diameterBottom: 1.8,
      tessellation: 8,
    }, scene)
    pedestal.position = new Vector3(x, terrainY + 0.4, z)
    pedestal.material = pedestalMat

    try {
      const result = await SceneLoader.ImportMeshAsync('', '/models/races/', race.file, scene)
      const root = result.meshes[0]
      root.scaling = new Vector3(race.scale, race.scale, race.scale)
      root.position = new Vector3(x, terrainY + 0.8, z)
      // Face center of circle
      root.rotation.y = -angle + Math.PI

      // Play idle-like animation if available (first animation group)
      if (result.animationGroups.length > 0) {
        result.animationGroups.forEach(ag => ag.stop())
        // Play the first animation slowly as idle
        result.animationGroups[0].start(true, 0.5)
      }

      console.log(`[WOL] Statue loaded: ${race.name}`)
    } catch (e) {
      console.warn(`[WOL] Failed to load ${race.name}:`, e)
    }
  }

  console.log('[WOL] All race statues loaded')
}
