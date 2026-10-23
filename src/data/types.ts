export type ZoneId = 'desk' | 'server' | 'pantry' | 'corridor';
export type Rarity = 'N' | 'R' | 'SR' | 'SSR';
export type Behavior = 'freeze' | 'loop' | 'grow' | 'charge' | 'split' | 'mimic';
export type SpriteKey = 'beetle' | 'ghost' | 'spider' | 'blob' | 'moth' | 'worm';
export type SootheAction = 'coffee' | 'duck' | 'praise' | 'pet';
export type Quality = 'perfect' | 'good' | 'miss';
export type PhaseIndex = 0 | 1 | 2 | 3;

export interface BugDef {
  id: string;
  no: number;
  name: string;
  en: string;
  rarity: Rarity;
  sprite: SpriteKey;
  color: string;
  zone: ZoneId;
  behavior: Behavior;
  desc: string;
  hint: string;
  perkName: string;
  perkDesc: string;
  intro: string;
  lines: Record<SootheAction | 'tamed', string>;
  spawn: { x: number; y: number };
  wanderRadius: number;
  patrol?: Array<{ x: number; y: number }>;
}

export interface SaveState {
  version: 1;
  caught: Record<string, boolean>;
  tamed: Record<string, boolean>;
  moods: Record<string, number>;
  perfect: Record<string, boolean>;
  coffeeBrewed: boolean;
}
