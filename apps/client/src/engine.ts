import { Engine } from '@babylonjs/core/Engines/engine'
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine'

/**
 * Create a Babylon.js engine with WebGPU support, falling back to WebGL.
 * Returns Engine type — WebGPUEngine extends AbstractEngine but not Engine directly,
 * so we cast via `unknown` for the return type.
 */
export async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  try {
    const webGPUSupported = await WebGPUEngine.IsSupportedAsync
    if (webGPUSupported) {
      const engine = new WebGPUEngine(canvas, {
        adaptToDeviceRatio: true,
        antialias: true,
      })
      await engine.initAsync()
      console.log('[WOL] Using WebGPU renderer')
      return engine as unknown as Engine
    }
  } catch (e) {
    console.warn('[WOL] WebGPU init failed, falling back to WebGL:', e)
  }

  console.log('[WOL] Using WebGL renderer')
  return new Engine(canvas, true, {
    adaptToDeviceRatio: true,
    antialias: true,
  })
}
