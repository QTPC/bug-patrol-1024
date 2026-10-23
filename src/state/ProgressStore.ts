import { BUGS } from '../data/bugs';
import type { SaveState, Quality } from '../data/types';

const KEY = 'bug-patrol-1024.v1';

const fresh = (): SaveState => ({
  version: 1,
  caught: {},
  tamed: {},
  moods: {},
  perfect: {},
  coffeeBrewed: false,
});

export class ProgressStore {
  private state: SaveState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = this.load();
  }

  private load(): SaveState {
    const base = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      if (parsed && typeof parsed === 'object') {
        if (parsed.caught && typeof parsed.caught === 'object') base.caught = parsed.caught;
        if (parsed.tamed && typeof parsed.tamed === 'object') base.tamed = parsed.tamed;
        if (parsed.moods && typeof parsed.moods === 'object') base.moods = parsed.moods;
        if (parsed.perfect && typeof parsed.perfect === 'object') base.perfect = parsed.perfect;
        base.coffeeBrewed = !!parsed.coffeeBrewed;
      }
    } catch {
      // localStorage unavailable — keep the in-memory state
    }

    for (const bug of BUGS) {
      if (base.caught[bug.id]) {
        const mood = Math.min(100, Math.max(0, Number(base.moods[bug.id]) || 25));
        base.moods[bug.id] = mood;
        if (mood >= 100) base.tamed[bug.id] = true;
      }
      if (base.tamed[bug.id]) {
        base.caught[bug.id] = true;
        base.moods[bug.id] = 100;
      }
    }
    return base;
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      // ignore
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  isCaught(id: string): boolean {
    return !!this.state.caught[id];
  }

  isTamed(id: string): boolean {
    return !!this.state.tamed[id];
  }

  isPerfect(id: string): boolean {
    return !!this.state.perfect[id];
  }

  mood(id: string): number {
    return Number(this.state.moods[id]) || 0;
  }

  caughtCount(): number {
    return BUGS.filter((b) => this.isCaught(b.id)).length;
  }

  tamedCount(): number {
    return BUGS.filter((b) => this.isTamed(b.id)).length;
  }

  allCaught(): boolean {
    return this.caughtCount() === BUGS.length;
  }

  allTamed(): boolean {
    return this.tamedCount() === BUGS.length;
  }

  perkUnlocked(id: string): boolean {
    return this.isTamed(id);
  }

  catchBug(id: string, quality: Exclude<Quality, 'miss'>): void {
    const startMood = quality === 'perfect' ? 40 : 25;
    this.state.caught[id] = true;
    this.state.moods[id] = Math.max(this.state.moods[id] || 0, startMood);
    if (quality === 'perfect') this.state.perfect[id] = true;
    this.save();
    this.emit();
  }

  soothe(id: string): { mood: number; tamed: boolean } {
    if (!this.state.caught[id]) return { mood: 0, tamed: false };
    const mood = Math.min(100, (Number(this.state.moods[id]) || 0) + 30);
    this.state.moods[id] = mood;
    let tamed = false;
    if (mood >= 100) {
      this.state.tamed[id] = true;
      tamed = true;
    }
    this.save();
    this.emit();
    return { mood, tamed };
  }

  setCoffeeBrewed(value: boolean): void {
    this.state.coffeeBrewed = value;
    this.save();
  }

  coffeeBrewed(): boolean {
    return !!this.state.coffeeBrewed;
  }

  reset(): void {
    this.state = fresh();
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    this.emit();
  }

  raw(): SaveState {
    return this.state;
  }
}
