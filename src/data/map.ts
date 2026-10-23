import type { ZoneId } from './types';

export const TILE = 32;
export const MAP_W = 48;
export const MAP_H = 30;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

export interface ZoneDef {
  id: ZoneId;
  name: string;
  en: string;
  accent: string;
  rect: { x: number; y: number; w: number; h: number };
}

export const ZONES: ZoneDef[] = [
  { id: 'desk', name: '工位区', en: 'DESK ZONE', accent: '#7bffb2', rect: { x: 2, y: 2, w: 19, h: 16 } },
  { id: 'server', name: '机房', en: 'SERVER ROOM', accent: '#7cd8ff', rect: { x: 22, y: 2, w: 14, h: 16 } },
  { id: 'pantry', name: '茶水间', en: 'PANTRY', accent: '#ffc857', rect: { x: 37, y: 2, w: 9, h: 16 } },
  { id: 'corridor', name: '走廊', en: 'CORRIDOR', accent: '#7da58f', rect: { x: 2, y: 19, w: 44, h: 7 } },
];

export const zoneAt = (x: number, y: number): ZoneDef => {
  const tx = x / TILE;
  const ty = y / TILE;
  return ZONES.find((z) => tx >= z.rect.x && tx < z.rect.x + z.rect.w && ty >= z.rect.y && ty < z.rect.y + z.rect.h) || ZONES[0];
};

export function buildTileData(): number[][] {
  const data: number[][] = [];
  const doorRows: Record<number, number[]> = {
    18: [9, 10, 11, 28, 29, 30, 40, 41, 42],
  };

  for (let y = 0; y < MAP_H; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_W; x++) {
      let tile = 0;

      const outer = x < 2 || x >= 46 || y < 2 || y >= 27;
      const divider = (x === 21 || x === 36) && y < 19;
      const roomBottom = y === 18 && (doorRows[18] || []).indexOf(x) === -1;

      if (outer || divider || roomBottom) {
        tile = 4;
      } else if (y >= 19) {
        tile = 3;
      } else if (x < 21) {
        tile = (x + y) % 7 === 0 ? 5 : 0;
      } else if (x < 36) {
        tile = (x + y) % 6 === 0 ? 6 : 1;
      } else {
        tile = (x + y) % 5 === 0 ? 7 : 2;
      }

      row.push(tile);
    }
    data.push(row);
  }
  return data;
}

export interface SolidDef {
  w: number;
  h: number;
  offsetY?: number;
}

export interface FurnitureDef {
  key: string;
  x: number;
  y: number;
  solid?: SolidDef;
  noBody?: boolean;
  alpha?: number;
  depthOffset?: number;
}

export const FURNITURE: FurnitureDef[] = [
  // desk zone — cubicles
  { key: 'desk', x: 4.5, y: 5.2, solid: { w: 58, h: 18, offsetY: -9 } },
  { key: 'desk', x: 8.5, y: 5.2, solid: { w: 58, h: 18, offsetY: -9 } },
  { key: 'desk', x: 4.5, y: 9.2, solid: { w: 58, h: 18, offsetY: -9 } },
  { key: 'desk', x: 8.5, y: 9.2, solid: { w: 58, h: 18, offsetY: -9 } },
  { key: 'monitor', x: 4.5, y: 4.9, noBody: true },
  { key: 'monitor', x: 8.5, y: 4.9, noBody: true },
  { key: 'monitor', x: 4.5, y: 8.9, noBody: true },
  { key: 'monitor', x: 8.5, y: 8.9, noBody: true },
  { key: 'chair', x: 4.5, y: 6.3, noBody: true },
  { key: 'chair', x: 8.5, y: 6.3, noBody: true },
  { key: 'chair', x: 4.5, y: 10.3, noBody: true },
  { key: 'chair', x: 8.5, y: 10.3, noBody: true },

  // desk zone — meeting nook
  { key: 'table', x: 16, y: 6.8, solid: { w: 120, h: 26, offsetY: -13 } },
  { key: 'chair', x: 14, y: 5.9, noBody: true },
  { key: 'chair', x: 18, y: 5.9, noBody: true },
  { key: 'chair', x: 14, y: 8.5, noBody: true },
  { key: 'chair', x: 18, y: 8.5, noBody: true },
  { key: 'chair', x: 16, y: 9.4, noBody: true },
  { key: 'whiteboard', x: 16, y: 2.95, noBody: true },
  { key: 'poster', x: 12.2, y: 2.2, noBody: true },

  // desk zone — decor
  { key: 'plant', x: 2.7, y: 3.2, solid: { w: 22, h: 12, offsetY: -6 } },
  { key: 'plant', x: 11.2, y: 3.2, solid: { w: 22, h: 12, offsetY: -6 } },
  { key: 'plant', x: 19.2, y: 15.3, solid: { w: 22, h: 12, offsetY: -6 } },
  { key: 'sofa', x: 12.5, y: 15.3, solid: { w: 60, h: 16, offsetY: -8 } },
  { key: 'printer', x: 19, y: 3.7, solid: { w: 42, h: 14, offsetY: -7 } },
  { key: 'box', x: 2.9, y: 16.5, solid: { w: 24, h: 12, offsetY: -6 } },
  { key: 'mat', x: 10.5, y: 18.35, noBody: true },

  // server room
  { key: 'server', x: 24, y: 5.1, solid: { w: 44, h: 22, offsetY: -11 } },
  { key: 'server', x: 27, y: 5.1, solid: { w: 44, h: 22, offsetY: -11 } },
  { key: 'server', x: 30, y: 5.1, solid: { w: 44, h: 22, offsetY: -11 } },
  { key: 'server', x: 33, y: 5.1, solid: { w: 44, h: 22, offsetY: -11 } },
  { key: 'server', x: 24, y: 9.6, solid: { w: 44, h: 22, offsetY: -11 } },
  { key: 'server', x: 27, y: 9.6, solid: { w: 44, h: 22, offsetY: -11 } },
  { key: 'server', x: 30, y: 9.6, solid: { w: 44, h: 22, offsetY: -11 } },
  { key: 'server', x: 33, y: 9.6, solid: { w: 44, h: 22, offsetY: -11 } },
  { key: 'console', x: 23.4, y: 16, solid: { w: 38, h: 16, offsetY: -8 } },
  { key: 'plant', x: 34.4, y: 3.2, solid: { w: 22, h: 12, offsetY: -6 } },
  { key: 'box', x: 34.2, y: 15.4, solid: { w: 24, h: 12, offsetY: -6 } },
  { key: 'box', x: 22.9, y: 13.8, solid: { w: 24, h: 12, offsetY: -6 } },
  { key: 'mat', x: 29.5, y: 18.35, noBody: true },

  // pantry
  { key: 'coffee', x: 39, y: 4.2, solid: { w: 28, h: 18, offsetY: -9 } },
  { key: 'fridge', x: 43.5, y: 4.2, solid: { w: 36, h: 22, offsetY: -11 } },
  { key: 'window', x: 41, y: 2.45, noBody: true },
  { key: 'table', x: 41, y: 8.7, solid: { w: 118, h: 24, offsetY: -12 } },
  { key: 'chair', x: 39.2, y: 9.6, noBody: true },
  { key: 'chair', x: 42.8, y: 9.6, noBody: true },
  { key: 'sofa', x: 39, y: 13.2, solid: { w: 60, h: 16, offsetY: -8 } },
  { key: 'plant', x: 44.3, y: 13.2, solid: { w: 22, h: 12, offsetY: -6 } },
  { key: 'cup', x: 39.6, y: 5.45, noBody: true, depthOffset: 2 },
  { key: 'mat', x: 41.5, y: 18.35, noBody: true },

  // corridor
  { key: 'plant', x: 3.1, y: 21.6, solid: { w: 22, h: 12, offsetY: -6 } },
  { key: 'plant', x: 35.1, y: 24.4, solid: { w: 22, h: 12, offsetY: -6 } },
  { key: 'plant', x: 44.6, y: 21.6, solid: { w: 22, h: 12, offsetY: -6 } },
  { key: 'box', x: 22.6, y: 24.2, solid: { w: 24, h: 12, offsetY: -6 } },
];

export interface LightDef {
  x: number;
  y: number;
  color: string;
  radius: number;
  alpha: number;
}

export const LIGHTS: LightDef[] = [
  { x: 4.5, y: 4.6, color: '#7cd8ff', radius: 125, alpha: 0.3 },
  { x: 8.5, y: 4.6, color: '#7cd8ff', radius: 125, alpha: 0.3 },
  { x: 4.5, y: 8.6, color: '#7cd8ff', radius: 125, alpha: 0.3 },
  { x: 8.5, y: 8.6, color: '#7cd8ff', radius: 125, alpha: 0.3 },
  { x: 10, y: 8, color: '#7bffb2', radius: 270, alpha: 0.19 },
  { x: 16.5, y: 7, color: '#ffc857', radius: 220, alpha: 0.2 },
  { x: 12.5, y: 15.3, color: '#7bffb2', radius: 190, alpha: 0.16 },
  { x: 26, y: 7.4, color: '#7cd8ff', radius: 270, alpha: 0.22 },
  { x: 31, y: 10, color: '#7cd8ff', radius: 220, alpha: 0.2 },
  { x: 40, y: 6, color: '#ffc857', radius: 230, alpha: 0.27 },
  { x: 42, y: 12.5, color: '#ffc857', radius: 190, alpha: 0.2 },
  { x: 14, y: 22, color: '#7bffb2', radius: 190, alpha: 0.12 },
  { x: 33, y: 22, color: '#7bffb2', radius: 190, alpha: 0.12 },
];

export const PHASES = [
  { clock: '22:00', label: '入夜', alpha: 0.3, tint: 0x020604 },
  { clock: '00:00', label: '深夜', alpha: 0.36, tint: 0x01050a },
  { clock: '03:00', label: '异常时段', alpha: 0.42, tint: 0x0c0204 },
  { clock: '05:00', label: '黎明', alpha: 0.2, tint: 0x1c1005 },
];

export const PHASE_DURATION = 150000;

export const PLAYER_START = { x: 6, y: 12 };
export const COFFEE_POINT = { x: 39, y: 4.2 };
export const CONSOLE_POINT = { x: 23.4, y: 16 };
export const CACHE_CUP = { x: 39.6, y: 5.45 };

export const MAP_LABELS = [
  { x: 4, y: 3.25, text: '工位区 / DESK' },
  { x: 23.5, y: 3.25, text: '机房 / SERVER' },
  { x: 37.5, y: 3.25, text: '茶水间 / PANTRY' },
  { x: 4, y: 20.6, text: '走廊 / CORRIDOR' },
];

export const toWorld = (t: { x: number; y: number }) => ({
  x: t.x * TILE + TILE / 2,
  y: t.y * TILE + TILE / 2,
});

export const toWorldBase = (t: { x: number; y: number }) => ({
  x: t.x * TILE + TILE / 2,
  y: t.y * TILE + TILE,
});
