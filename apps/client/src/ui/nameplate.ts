import { Scene } from '@babylonjs/core/scene'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture'
import { TextBlock } from '@babylonjs/gui/2D/controls/textBlock'
import { Rectangle } from '@babylonjs/gui/2D/controls/rectangle'
import { Control } from '@babylonjs/gui/2D/controls/control'

// Shared fullscreen UI for all nameplates
let sharedUI: AdvancedDynamicTexture | null = null

/**
 * Create a nameplate (username label) above a player mesh.
 * Uses BabylonJS GUI AdvancedDynamicTexture in fullscreen mode.
 */
export function createNameplate(
  scene: Scene,
  mesh: Mesh,
  username: string,
): void {
  // Create shared UI if not exists
  if (!sharedUI) {
    sharedUI = AdvancedDynamicTexture.CreateFullscreenUI('nameplateUI', true, scene)
  }

  // Background rectangle
  const rect = new Rectangle(`nameplate_bg_${mesh.name}`)
  rect.width = '120px'
  rect.height = '24px'
  rect.cornerRadius = 6
  rect.color = 'transparent'
  rect.background = 'rgba(0, 0, 0, 0.5)'
  rect.thickness = 0
  sharedUI.addControl(rect)

  // Username text
  const text = new TextBlock(`nameplate_text_${mesh.name}`, username)
  text.color = '#ffd700'
  text.fontSize = 13
  text.fontFamily = 'Segoe UI, sans-serif'
  text.fontWeight = '600'
  rect.addControl(text)

  // Link to mesh (floats above the avatar)
  rect.linkWithMesh(mesh)
  rect.linkOffsetY = -60 // Pixels above the mesh center
}

/**
 * Dispose the shared nameplate UI (call on cleanup).
 */
export function disposeNameplates(): void {
  if (sharedUI) {
    sharedUI.dispose()
    sharedUI = null
  }
}
