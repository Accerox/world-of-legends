import type { NPC } from '../types.js'

/**
 * Static NPC definitions for the island.
 * Y positions are set to 0 — clients will adjust to terrain height.
 */
export const ISLAND_NPCS: NPC[] = [
  // Quest givers (placed on the island)
  {
    id: 'elder_oak',
    name: 'Elder Oak',
    type: 'quest_giver',
    x: 5, y: 0, z: 10, rotY: 0,
    dialogue: [
      'Welcome, adventurer! This island holds many secrets.',
      'I sense great potential in you.',
      'Would you help me? I need someone to explore the ancient ruins to the north.',
    ],
    questId: 'explore_ruins',
  },
  {
    id: 'fisher_tom',
    name: 'Fisher Tom',
    type: 'quest_giver',
    x: -30, y: 0, z: -20, rotY: Math.PI / 4,
    dialogue: [
      "Ahoy! The fish aren't biting today...",
      'Say, could you help me gather some glowing crystals from the hilltop?',
      'I hear they attract the rare moonfish!',
    ],
    questId: 'gather_crystals',
  },
  {
    id: 'captain_silva',
    name: 'Captain Silva',
    type: 'quest_giver',
    x: 20, y: 0, z: -35, rotY: -Math.PI / 3,
    dialogue: [
      'Halt! These woods are dangerous.',
      'Wild slimes have been attacking travelers.',
      "Defeat 3 of them and I'll reward you handsomely.",
    ],
    questId: 'defeat_slimes',
  },
  {
    id: 'merchant_luna',
    name: 'Merchant Luna',
    type: 'merchant',
    x: -10, y: 0, z: 5, rotY: Math.PI,
    dialogue: [
      "Welcome to my shop! ...Well, it's more of a blanket on the ground.",
      "I don't have much to sell yet, but check back later!",
    ],
  },
  // Enemies (slimes scattered around)
  { id: 'slime_1', name: 'Green Slime', type: 'enemy', x: 40, y: 0, z: 20, rotY: 0, dialogue: [], health: 30, maxHealth: 30, respawnTime: 30 },
  { id: 'slime_2', name: 'Green Slime', type: 'enemy', x: -35, y: 0, z: 30, rotY: 0, dialogue: [], health: 30, maxHealth: 30, respawnTime: 30 },
  { id: 'slime_3', name: 'Green Slime', type: 'enemy', x: 25, y: 0, z: -15, rotY: 0, dialogue: [], health: 30, maxHealth: 30, respawnTime: 30 },
  { id: 'slime_4', name: 'Blue Slime', type: 'enemy', x: -20, y: 0, z: -40, rotY: 0, dialogue: [], health: 50, maxHealth: 50, respawnTime: 45 },
  { id: 'slime_5', name: 'Blue Slime', type: 'enemy', x: 50, y: 0, z: -30, rotY: 0, dialogue: [], health: 50, maxHealth: 50, respawnTime: 45 },
  { id: 'slime_6', name: 'Red Slime', type: 'enemy', x: 0, y: 0, z: 55, rotY: 0, dialogue: [], health: 80, maxHealth: 80, respawnTime: 60 },
]
