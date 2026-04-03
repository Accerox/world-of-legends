/**
 * Procedural animations for HVGirl model.
 * Creates Run, Jump, Attack, and Death animations by manipulating skeleton bones.
 * These are created at runtime since the GLB only has Idle, Walking, WalkingBack, Samba.
 */

import { Scene } from '@babylonjs/core/scene'
import { Animation } from '@babylonjs/core/Animations/animation'
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup'
import { Skeleton } from '@babylonjs/core/Bones/skeleton'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'

const FPS = 30

function quatFromEuler(x: number, y: number, z: number): Quaternion {
  return Quaternion.FromEulerAngles(x, y, z)
}

/**
 * Create a Running animation — exaggerated Walking with wider arm swing and longer strides.
 */
function createRunAnimation(skeleton: Skeleton, scene: Scene, playerId: string): AnimationGroup {
  const group = new AnimationGroup(`Running_${playerId}`, scene)
  const totalFrames = 20 // Shorter cycle = faster feel

  const bones: Record<string, number> = {}
  skeleton.bones.forEach((b, i) => { bones[b.name] = i })

  // Helper to add rotation keyframes to a bone
  const addBoneRotation = (boneName: string, keyframes: { frame: number; value: Quaternion }[]) => {
    const bone = skeleton.bones.find(b => b.name === boneName)
    if (!bone) return
    const anim = new Animation(`run_${boneName}_${playerId}`, 'rotationQuaternion', FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CYCLE)
    anim.setKeys(keyframes)
    group.addTargetedAnimation(anim, bone.getTransformNode()!)
  }

  // Hips — slight vertical bounce and forward tilt
  addBoneRotation('mixamorig:Hips', [
    { frame: 0, value: quatFromEuler(0.15, 0, 0) },
    { frame: 5, value: quatFromEuler(0.1, 0, 0.03) },
    { frame: 10, value: quatFromEuler(0.15, 0, 0) },
    { frame: 15, value: quatFromEuler(0.1, 0, -0.03) },
    { frame: 20, value: quatFromEuler(0.15, 0, 0) },
  ])

  // Spine — lean forward
  addBoneRotation('mixamorig:Spine', [
    { frame: 0, value: quatFromEuler(0.1, 0, 0) },
    { frame: 10, value: quatFromEuler(0.12, 0, 0) },
    { frame: 20, value: quatFromEuler(0.1, 0, 0) },
  ])

  // Left leg — big stride forward/back
  addBoneRotation('mixamorig:LeftUpLeg', [
    { frame: 0, value: quatFromEuler(-0.8, 0, 0) },   // Forward
    { frame: 10, value: quatFromEuler(0.5, 0, 0) },    // Back
    { frame: 20, value: quatFromEuler(-0.8, 0, 0) },
  ])
  addBoneRotation('mixamorig:LeftLeg', [
    { frame: 0, value: quatFromEuler(0.3, 0, 0) },
    { frame: 5, value: quatFromEuler(1.5, 0, 0) },     // Knee bent high
    { frame: 10, value: quatFromEuler(0.1, 0, 0) },
    { frame: 15, value: quatFromEuler(0.4, 0, 0) },
    { frame: 20, value: quatFromEuler(0.3, 0, 0) },
  ])

  // Right leg — opposite phase
  addBoneRotation('mixamorig:RightUpLeg', [
    { frame: 0, value: quatFromEuler(0.5, 0, 0) },    // Back
    { frame: 10, value: quatFromEuler(-0.8, 0, 0) },   // Forward
    { frame: 20, value: quatFromEuler(0.5, 0, 0) },
  ])
  addBoneRotation('mixamorig:RightLeg', [
    { frame: 0, value: quatFromEuler(0.1, 0, 0) },
    { frame: 5, value: quatFromEuler(0.4, 0, 0) },
    { frame: 10, value: quatFromEuler(0.3, 0, 0) },
    { frame: 15, value: quatFromEuler(1.5, 0, 0) },    // Knee bent high
    { frame: 20, value: quatFromEuler(0.1, 0, 0) },
  ])

  // Arms — big swing opposite to legs
  addBoneRotation('mixamorig:LeftArm', [
    { frame: 0, value: quatFromEuler(0.6, 0, 0.3) },   // Back
    { frame: 10, value: quatFromEuler(-0.8, 0, 0.3) },  // Forward
    { frame: 20, value: quatFromEuler(0.6, 0, 0.3) },
  ])
  addBoneRotation('mixamorig:LeftForeArm', [
    { frame: 0, value: quatFromEuler(-0.3, 0, 0) },
    { frame: 10, value: quatFromEuler(-1.0, 0, 0) },
    { frame: 20, value: quatFromEuler(-0.3, 0, 0) },
  ])
  addBoneRotation('mixamorig:RightArm', [
    { frame: 0, value: quatFromEuler(-0.8, 0, -0.3) },  // Forward
    { frame: 10, value: quatFromEuler(0.6, 0, -0.3) },   // Back
    { frame: 20, value: quatFromEuler(-0.8, 0, -0.3) },
  ])
  addBoneRotation('mixamorig:RightForeArm', [
    { frame: 0, value: quatFromEuler(-1.0, 0, 0) },
    { frame: 10, value: quatFromEuler(-0.3, 0, 0) },
    { frame: 20, value: quatFromEuler(-1.0, 0, 0) },
  ])

  group.normalize(0, totalFrames)
  return group
}

/**
 * Create a Jump animation — crouch, launch, air pose, land.
 */
function createJumpAnimation(skeleton: Skeleton, scene: Scene, playerId: string): AnimationGroup {
  const group = new AnimationGroup(`Jump_${playerId}`, scene)
  const totalFrames = 30

  const addBoneRotation = (boneName: string, keyframes: { frame: number; value: Quaternion }[]) => {
    const bone = skeleton.bones.find(b => b.name === boneName)
    if (!bone) return
    const anim = new Animation(`jump_${boneName}_${playerId}`, 'rotationQuaternion', FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT)
    anim.setKeys(keyframes)
    group.addTargetedAnimation(anim, bone.getTransformNode()!)
  }

  // Hips — crouch then extend
  addBoneRotation('mixamorig:Hips', [
    { frame: 0, value: quatFromEuler(0, 0, 0) },       // Neutral
    { frame: 5, value: quatFromEuler(0.2, 0, 0) },     // Crouch
    { frame: 10, value: quatFromEuler(-0.1, 0, 0) },   // Launch — lean back
    { frame: 20, value: quatFromEuler(0.05, 0, 0) },   // Air
    { frame: 28, value: quatFromEuler(0.15, 0, 0) },   // Land crouch
    { frame: 30, value: quatFromEuler(0, 0, 0) },      // Recover
  ])

  // Legs — bend for crouch, extend in air
  for (const side of ['Left', 'Right']) {
    addBoneRotation(`mixamorig:${side}UpLeg`, [
      { frame: 0, value: quatFromEuler(0, 0, 0) },
      { frame: 5, value: quatFromEuler(-0.5, 0, 0) },   // Crouch
      { frame: 10, value: quatFromEuler(0.1, 0, 0) },    // Extend
      { frame: 20, value: quatFromEuler(-0.2, 0, 0) },   // Air — slight tuck
      { frame: 28, value: quatFromEuler(-0.4, 0, 0) },   // Land
      { frame: 30, value: quatFromEuler(0, 0, 0) },
    ])
    addBoneRotation(`mixamorig:${side}Leg`, [
      { frame: 0, value: quatFromEuler(0, 0, 0) },
      { frame: 5, value: quatFromEuler(1.0, 0, 0) },    // Crouch — knees bent
      { frame: 10, value: quatFromEuler(0.1, 0, 0) },   // Extend
      { frame: 20, value: quatFromEuler(0.3, 0, 0) },   // Air
      { frame: 28, value: quatFromEuler(0.8, 0, 0) },   // Land absorb
      { frame: 30, value: quatFromEuler(0, 0, 0) },
    ])
  }

  // Arms — raise up during jump
  const armSpread = 0.5
  addBoneRotation('mixamorig:LeftArm', [
    { frame: 0, value: quatFromEuler(0, 0, armSpread) },
    { frame: 10, value: quatFromEuler(-0.5, 0, 1.2) },  // Arms up
    { frame: 20, value: quatFromEuler(-0.3, 0, 1.0) },  // Air
    { frame: 30, value: quatFromEuler(0, 0, armSpread) },
  ])
  addBoneRotation('mixamorig:RightArm', [
    { frame: 0, value: quatFromEuler(0, 0, -armSpread) },
    { frame: 10, value: quatFromEuler(-0.5, 0, -1.2) },
    { frame: 20, value: quatFromEuler(-0.3, 0, -1.0) },
    { frame: 30, value: quatFromEuler(0, 0, -armSpread) },
  ])

  group.normalize(0, totalFrames)
  return group
}

/**
 * Create an Attack animation — wind up, swing, recover.
 */
function createAttackAnimation(skeleton: Skeleton, scene: Scene, playerId: string): AnimationGroup {
  const group = new AnimationGroup(`Attack_${playerId}`, scene)
  const totalFrames = 25

  const addBoneRotation = (boneName: string, keyframes: { frame: number; value: Quaternion }[]) => {
    const bone = skeleton.bones.find(b => b.name === boneName)
    if (!bone) return
    const anim = new Animation(`attack_${boneName}_${playerId}`, 'rotationQuaternion', FPS, Animation.ANIMATIONTYPE_QUATERNION, Animation.ANIMATIONLOOPMODE_CONSTANT)
    anim.setKeys(keyframes)
    group.addTargetedAnimation(anim, bone.getTransformNode()!)
  }

  // Spine — twist for swing
  addBoneRotation('mixamorig:Spine', [
    { frame: 0, value: quatFromEuler(0, 0, 0) },
    { frame: 5, value: quatFromEuler(0, 0.4, 0) },     // Wind up — twist right
    { frame: 12, value: quatFromEuler(0.1, -0.5, 0) },  // Swing — twist left
    { frame: 20, value: quatFromEuler(0, -0.1, 0) },
    { frame: 25, value: quatFromEuler(0, 0, 0) },
  ])

  // Right arm — big swing
  addBoneRotation('mixamorig:RightArm', [
    { frame: 0, value: quatFromEuler(0, 0, -0.3) },
    { frame: 5, value: quatFromEuler(-1.5, 0.5, -0.5) },  // Wind up — arm back and up
    { frame: 10, value: quatFromEuler(-0.3, -0.8, -0.3) }, // Swing down
    { frame: 15, value: quatFromEuler(0.3, -0.3, -0.2) },  // Follow through
    { frame: 25, value: quatFromEuler(0, 0, -0.3) },
  ])
  addBoneRotation('mixamorig:RightForeArm', [
    { frame: 0, value: quatFromEuler(0, 0, 0) },
    { frame: 5, value: quatFromEuler(-1.2, 0, 0) },     // Bent back
    { frame: 10, value: quatFromEuler(-0.2, 0, 0) },    // Extended
    { frame: 25, value: quatFromEuler(0, 0, 0) },
  ])

  // Left arm — guard position
  addBoneRotation('mixamorig:LeftArm', [
    { frame: 0, value: quatFromEuler(0, 0, 0.3) },
    { frame: 5, value: quatFromEuler(-0.5, -0.3, 0.5) },
    { frame: 12, value: quatFromEuler(-0.3, 0.2, 0.4) },
    { frame: 25, value: quatFromEuler(0, 0, 0.3) },
  ])

  // Lunge forward slightly
  addBoneRotation('mixamorig:Hips', [
    { frame: 0, value: quatFromEuler(0, 0, 0) },
    { frame: 5, value: quatFromEuler(0, 0.2, 0) },
    { frame: 12, value: quatFromEuler(0.15, -0.2, 0) },  // Lunge
    { frame: 25, value: quatFromEuler(0, 0, 0) },
  ])

  group.normalize(0, totalFrames)
  return group
}

/**
 * Create all procedural animations for a character instance.
 */
export function createProceduralAnimations(
  skeleton: Skeleton,
  scene: Scene,
  playerId: string,
): Record<string, AnimationGroup> {
  return {
    'Running': createRunAnimation(skeleton, scene, playerId),
    'Jump': createJumpAnimation(skeleton, scene, playerId),
    'Attack': createAttackAnimation(skeleton, scene, playerId),
  }
}
