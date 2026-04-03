import type { Quest } from '../types.js'

/**
 * Quest definitions for the island.
 */
export const QUESTS: Quest[] = [
  {
    id: 'explore_ruins',
    name: 'The Ancient Ruins',
    description: 'Elder Oak wants you to explore the ruins at the top of the hill.',
    objectives: [
      { type: 'reach', target: 'hilltop', count: 1, description: 'Reach the hilltop ruins' },
    ],
    rewards: { xp: 50, gold: 10 },
    giverNpcId: 'elder_oak',
  },
  {
    id: 'gather_crystals',
    name: 'Moonfish Bait',
    description: 'Fisher Tom needs 3 glowing crystals from the hilltop.',
    objectives: [
      { type: 'reach', target: 'crystal_1', count: 1, description: 'Find crystal near the big tree' },
      { type: 'reach', target: 'crystal_2', count: 1, description: 'Find crystal by the rocks' },
      { type: 'reach', target: 'crystal_3', count: 1, description: 'Find crystal at the peak' },
    ],
    rewards: { xp: 75, gold: 15 },
    giverNpcId: 'fisher_tom',
  },
  {
    id: 'defeat_slimes',
    name: 'Slime Menace',
    description: 'Captain Silva wants you to defeat 3 slimes threatening the travelers.',
    objectives: [
      { type: 'kill', target: 'slime', count: 3, description: 'Defeat 3 slimes' },
    ],
    rewards: { xp: 100, gold: 25 },
    giverNpcId: 'captain_silva',
  },
]

/**
 * Named locations for reach-type quest objectives.
 * Each location has a center (x, z) and a radius.
 */
export const QUEST_LOCATIONS: Record<string, { x: number; z: number; radius: number }> = {
  hilltop: { x: 0, z: 0, radius: 8 },
  crystal_1: { x: 15, z: 10, radius: 5 },
  crystal_2: { x: -10, z: 15, radius: 5 },
  crystal_3: { x: 3, z: -5, radius: 5 },
}
