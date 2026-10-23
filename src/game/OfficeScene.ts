import Phaser from 'phaser';
import { BUGS, bugById } from '../data/bugs';
import {
  buildTileData, CONSOLE_POINT, COFFEE_POINT, FURNITURE, LIGHTS, MAP_LABELS,
  PHASES, PHASE_DURATION, PLAYER_START, TILE, WORLD_H, WORLD_W, ZONES, zoneAt,
} from '../data/map';
import type { BugDef, Quality, ZoneId } from '../data/types';
import { Bug } from './Bug';
import { Player } from './Player';
import { Sfx } from './Sfx';
import { createTextures } from './textures';
import type { ProgressStore } from '../state/ProgressStore';
import type { GameUI } from '../ui/GameUI';

interface SplitGroup {
  caught: number;
  deadline: number;
  bestPerfect: boolean;
  bestQuality: Exclude<Quality, 'miss'>;
}

export class OfficeScene extends Phaser.Scene {
  private store: ProgressStore;
  private ui: GameUI;
  private sfx = new Sfx();

  private player!: Player;
  private walls!: Phaser.Tilemaps.TilemapLayer;
  private solids: Phaser.GameObjects.Rectangle[] = [];
  private bugs: Bug[] = [];
  private cupImage: Phaser.GameObjects.Image | null = null;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private paused = false;
  private captureActive = false;
  private captureBug: Bug | null = null;
  private captureZone = { green: [0.61, 0.75] as [number, number], amber: [0.46, 0.9] as [number, number] };

  private currentZone: ZoneId = 'desk';
  private zoneSeen = new Set<ZoneId>(['desk']);
  private lastPrompt = '';
  private nearInteraction: 'coffee' | 'console' | null = null;

  private coffeeReadyAt = 0;
  private qUsed = false;
  private firstCatchDone = false;
  private tutorialNpe = false;

  private phase = 0;
  private phaseStarted = 0;
  private dark!: Phaser.GameObjects.Rectangle;
  private playerLight!: Phaser.GameObjects.Image;

  private respawnQueue = new Map<string, number>();
  private splitGroup: SplitGroup | null = null;

  private touchVector = new Phaser.Math.Vector2();
  private touchSneak = false;

  constructor(store: ProgressStore, ui: GameUI) {
    super('OfficeScene');
    this.store = store;
    this.ui = ui;
  }

  create(): void {
    createTextures(this);
    this.createAnimations();
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor('#050b08');

    this.buildMap();
    this.buildFurniture();
    this.buildLabels();
    this.buildLights();

    const start = this.tileBase(PLAYER_START.x, PLAYER_START.y);
    this.player = new Player(this, start.x, start.y);
    this.player.setKnockbackResist(this.store.perkUnlocked('segv'));

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(90, 56);
    this.cameras.main.fadeIn(420, 4, 8, 6);

    this.playerLight = this.add.image(this.player.x, this.player.y - 6, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x32f08c)
      .setAlpha(0.26)
      .setScale(1.18)
      .setDepth(1002);

    this.tweens.add({
      targets: this.playerLight,
      alpha: { from: 0.22, to: 0.32 },
      scaleX: { from: 1.12, to: 1.28 },
      scaleY: { from: 1.12, to: 1.28 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.physics.add.collider(this.player.sprite, this.walls);
    this.physics.add.collider(this.player.sprite, this.solids);

    for (const def of BUGS) {
      if (!this.store.isCaught(def.id)) this.spawnBug(def);
    }
    this.drawLoopPath();

    this.setupInput();
    this.ui.bind(this, this.store);
    this.ui.setSoundMuted(this.sfx.muted);
    this.ui.setZone(zoneAt(this.player.x, this.player.y));
    this.ui.setShift(0);
    this.ui.setQUsed(false);

    this.phaseStarted = this.time.now;
    this.store.onChange(() => this.syncPerks());

    this.time.delayedCall(420, () => this.ui.ready());
    this.time.delayedCall(760, () => {
      this.ui.toast('夜班开始 · 先去工位区找那只空指针', 'info');
    });

    if (import.meta.env.DEV) this.installDebugApi();
  }

  private tileBase(x: number, y: number): { x: number; y: number } {
    return { x: x * TILE + TILE / 2, y: y * TILE + TILE };
  }

  private pointBase(x: number, y: number): { x: number; y: number } {
    return { x: x * TILE + TILE / 2, y: y * TILE + TILE + 4 };
  }

  private buildMap(): void {
    const data = buildTileData();
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    if (!tileset) {
      console.error('Tileset failed to load');
      return;
    }
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) {
      console.error('Tile layer failed to create');
      return;
    }
    layer.setDepth(0);
    layer.setCollision([4]);
    this.walls = layer;
  }

  private buildFurniture(): void {
    for (const f of FURNITURE) {
      const x = f.x * TILE;
      const y = f.y * TILE;
      const img = this.add.image(x, y, f.key).setOrigin(0.5, 1);
      const flat = f.key === 'mat' || f.key === 'poster' || f.key === 'window';
      img.setDepth(flat ? 2 : y + (f.depthOffset || 0));
      if (f.alpha != null) img.setAlpha(f.alpha);
      if (f.key === 'cup') this.cupImage = img;
      if (f.solid) {
        const solid = this.add.rectangle(
          x,
          y + (f.solid.offsetY == null ? -8 : f.solid.offsetY),
          f.solid.w,
          f.solid.h,
          0x000000,
          0,
        );
        this.physics.add.existing(solid, true);
        this.solids.push(solid);
      }
    }
    if (this.store.isCaught('cache') && this.cupImage) this.cupImage.setVisible(false);
  }

  private buildLabels(): void {
    for (const label of MAP_LABELS) {
      this.add.text(label.x * TILE, label.y * TILE, label.text, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#7bffb2',
      }).setAlpha(0.055).setDepth(2);
    }
  }

  private buildLights(): void {
    const phase = PHASES[0];
    this.dark = this.add.rectangle(0, 0, 960, 540, phase.tint, phase.alpha)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    for (let i = 0; i < LIGHTS.length; i++) {
      const light = LIGHTS[i];
      const glow = this.add.image(light.x * TILE, light.y * TILE, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(Phaser.Display.Color.HexStringToColor(light.color).color)
        .setAlpha(light.alpha)
        .setScale(light.radius / 64)
        .setDepth(1001);
      if (i % 2 === 0) {
        this.tweens.add({
          targets: glow,
          alpha: light.alpha * 1.3,
          duration: 1600 + Math.random() * 1600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }
  }

  private createAnimations(): void {
    const dirs = ['down', 'up', 'side'] as const;
    for (const dir of dirs) {
      const idle = [0, 1, 2, 3].map((i) => `player-${dir}-idle-${i}`);
      const walk = [0, 1, 2, 3].map((i) => `player-${dir}-walk-${i}`);
      const net = [0, 1, 2].map((i) => `player-${dir}-net-${i}`);

      if (!this.anims.exists(`player-idle-${dir}`)) {
        this.anims.create({
          key: `player-idle-${dir}`,
          frames: idle.map((key) => ({ key })),
          frameRate: 3,
          repeat: -1,
        });
      }
      if (!this.anims.exists(`player-walk-${dir}`)) {
        this.anims.create({
          key: `player-walk-${dir}`,
          frames: walk.map((key) => ({ key })),
          frameRate: 10,
          repeat: -1,
        });
      }
      if (!this.anims.exists(`player-net-${dir}`)) {
        this.anims.create({
          key: `player-net-${dir}`,
          frames: net.map((key) => ({ key })),
          frameRate: 12,
          repeat: 0,
        });
      }
    }

    for (const bug of BUGS) {
      const id = bug.id;
      if (!this.anims.exists(`bug-idle-${id}`)) {
        this.anims.create({
          key: `bug-idle-${id}`,
          frames: [{ key: `bug-${id}-0` }, { key: `bug-${id}-1` }],
          frameRate: 3,
          repeat: -1,
        });
      }
      if (!this.anims.exists(`bug-alert-${id}`)) {
        this.anims.create({
          key: `bug-alert-${id}`,
          frames: [{ key: `bug-${id}-1` }, { key: `bug-${id}-2` }],
          frameRate: 8,
          repeat: 0,
        });
      }
      if (!this.anims.exists(`bug-flee-${id}`)) {
        this.anims.create({
          key: `bug-flee-${id}`,
          frames: [{ key: `bug-${id}-0` }, { key: `bug-${id}-2` }],
          frameRate: 12,
          repeat: -1,
        });
      }
    }
  }

  private drawLoopPath(): void {
    if (this.store.isCaught('loop')) return;
    const def = bugById('loop');
    if (!def || !def.patrol) return;
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(1, 0xffd166, 0.16);
    const points = def.patrol.map((p) => this.tileBase(p.x, p.y));
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.closePath();
    g.strokePath();
    for (const p of points) g.fillStyle(0xffd166, 0.22).fillCircle(p.x, p.y, 2);
  }

  private spawnBug(def: BugDef): Bug | null {
    if (this.store.isCaught(def.id)) return null;
    if (this.bugs.some((b) => b.def.id === def.id)) return null;
    const pos = this.tileBase(def.spawn.x, def.spawn.y);
    const bug = new Bug(this, def, pos.x, pos.y, (b) => this.handleSplit(b));
    this.bugs.push(bug);
    this.physics.add.collider(bug.sprite, this.walls);
    this.physics.add.collider(bug.sprite, this.solids);
    this.physics.add.overlap(this.player.sprite, bug.sprite, () => {
      if (!bug.isCharging) return;
      bug.hitPlayer();
      this.player.knockback(bug.x, bug.y, 250, 340);
      this.cameras.main.shake(120, 0.004);
      this.sfx.miss();
      this.ui.toast('段错误撞了你一下 · 侧身闪开，等它撞停', 'warn');
    });
    return bug;
  }

  private handleSplit(original: Bug): void {
    if (this.splitGroup) return;
    const offset = original.x > 26 * TILE ? -44 : 44;
    const clone = new Bug(this, original.def, original.x + offset, original.y + 8);
    clone.isClone = true;
    clone.splitDone = true;
    this.bugs.push(clone);
    this.physics.add.collider(clone.sprite, this.walls);
    this.physics.add.collider(clone.sprite, this.solids);
    this.splitGroup = {
      caught: 0,
      deadline: 0,
      bestPerfect: false,
      bestQuality: 'good',
    };
    this.sparkBurst(original.x, original.centerY, '#f78fb3', 14);
    this.sfx.alert();
    this.ui.toast('并发幽灵分裂了 · 5 秒内抓住两只', 'warn');
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.keys = keyboard.addKeys('W,A,S,D,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cursors = keyboard.createCursorKeys();
    keyboard.on('keydown-E', (event: KeyboardEvent) => {
      event.preventDefault();
      this.handleInteract();
    });
    keyboard.on('keydown-Q', (event: KeyboardEvent) => {
      event.preventDefault();
      this.handleAbility();
    });
    keyboard.on('keydown', () => this.sfx.ensure());
  }

  update(_time: number, delta: number): void {
    if (this.paused || this.captureActive) return;
    const dt = Math.min(0.05, delta / 1000);

    const input = this.readMovement();
    this.player.update(dt, { x: input.x, y: input.y, sneak: input.sneak, enabled: true });

    const perks = { race: this.store.perkUnlocked('race') };
    for (const bug of [...this.bugs]) {
      bug.update(dt, this.player, perks);
      if (bug.removed) {
        this.bugs = this.bugs.filter((b) => b !== bug);
        if (!this.store.isCaught(bug.def.id)) this.queueRespawn(bug.def.id);
      }
    }

    this.updateRespawns();
    this.updatePhase();
    this.updateSplitDeadline();
    this.updateZone();
    this.updateInteraction();
    this.updateTutorial();
    this.playerLight.setPosition(this.player.x, this.player.y - 6);
  }

  private readMovement(): { x: number; y: number; sneak: boolean } {
    let x = 0;
    let y = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;

    if (this.touchVector.lengthSq() > 0.012) {
      x = this.touchVector.x;
      y = this.touchVector.y;
    }
    return { x, y, sneak: this.keys.SHIFT.isDown || this.touchSneak };
  }

  private updateZone(): void {
    const zone = zoneAt(this.player.x, this.player.y);
    if (zone.id !== this.currentZone) {
      this.currentZone = zone.id;
      this.ui.setZone(zone);
      if (!this.zoneSeen.has(zone.id)) {
        this.zoneSeen.add(zone.id);
        if (zone.id === 'server') {
          this.ui.toast('机房 · 段错误会直线冲撞，机柜控制台可以重启它', 'info');
        } else if (zone.id === 'pantry') {
          this.ui.toast('茶水间 · 先按 E 煮咖啡，缓存幽灵才会现身', 'info');
        } else if (zone.id === 'corridor') {
          this.ui.toast('走廊 · 四个区域都能从这里过去', 'info');
        }
      }
    }
  }

  private updateInteraction(): void {
    const coffeePos = this.pointBase(COFFEE_POINT.x, COFFEE_POINT.y);
    const consolePos = this.pointBase(CONSOLE_POINT.x, CONSOLE_POINT.y);
    const coffeeDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, coffeePos.x, coffeePos.y);
    const consoleDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, consolePos.x, consolePos.y);

    let interaction: 'coffee' | 'console' | null = null;
    let prompt = '';
    if (coffeeDist < 82) {
      interaction = 'coffee';
      const cooldown = Math.ceil((this.coffeeReadyAt - this.time.now) / 1000);
      prompt = cooldown > 0 ? `E · 咖啡冷却 ${cooldown}s` : 'E · 煮咖啡';
    } else if (consoleDist < 78) {
      interaction = 'console';
      prompt = 'E · 重启机柜';
    }

    this.nearInteraction = interaction;
    if (!interaction) {
      const target = this.findNetTarget();
      if (target) prompt = 'Space · 挥网';
    }

    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      this.ui.setInteraction(prompt);
    }
  }

  private updateTutorial(): void {
    if (this.tutorialNpe) return;
    const npe = this.bugs.find((b) => b.def.id === 'npe' && b.isCatchable);
    if (!npe) return;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, npe.x, npe.y) < 120) {
      this.tutorialNpe = true;
      this.ui.toast('按住 Shift 绕到它背后 · 靠近后按 Space 挥网', 'info');
    }
  }

  private updateRespawns(): void {
    const now = this.time.now;
    for (const [id, at] of [...this.respawnQueue.entries()]) {
      if (now < at) continue;
      this.respawnQueue.delete(id);
      if (this.store.isCaught(id)) continue;
      if (this.bugs.some((b) => b.def.id === id)) continue;
      const def = bugById(id);
      if (def) this.spawnBug(def);
    }
  }

  private updatePhase(): void {
    if (this.phase >= PHASES.length - 1) return;
    if (this.time.now - this.phaseStarted < PHASE_DURATION) return;
    this.phase += 1;
    this.phaseStarted = this.time.now;
    const phase = PHASES[this.phase];
    this.dark.setFillStyle(phase.tint, phase.alpha);
    this.ui.setShift(this.phase);
    this.sfx.phase();
    this.ui.toast(`${phase.clock} · ${phase.label}${this.phase === 2 ? ' · Bug 更活跃' : ''}`, 'warn');
    const mult = [1, 1.05, 1.15, 0.9][this.phase] || 1;
    this.bugs.forEach((b) => { b.speedMultiplier = mult; });
    if (this.phase === 3) this.playerLight.setTint(0xffd2a0);
  }

  private updateSplitDeadline(): void {
    if (!this.splitGroup) {
      this.ui.setSplitTimer(null);
      return;
    }
    if (!this.splitGroup.deadline) {
      this.ui.setSplitTimer(null);
      return;
    }
    const remaining = (this.splitGroup.deadline - this.time.now) / 1000;
    if (remaining <= 0) {
      this.failSplit();
      this.ui.setSplitTimer(null);
      return;
    }
    this.ui.setSplitTimer(remaining);
  }

  private queueRespawn(id: string, delay = 15000): void {
    if (this.store.isCaught(id)) return;
    if (!this.respawnQueue.has(id)) this.respawnQueue.set(id, this.time.now + delay);
  }

  private findNetTarget(): Bug | null {
    const px = this.player.x;
    const py = this.player.y - 18;
    let best: Bug | null = null;
    let bestDist = Infinity;

    for (const bug of this.bugs) {
      if (!bug.isCatchable) continue;
      const dx = bug.x - px;
      const dy = bug.centerY - py;
      const dist = Math.hypot(dx, dy);
      if (dist > 88) continue;
      const dot = dist > 0.01 ? (dx / dist) * this.player.facing.x + (dy / dist) * this.player.facing.y : 1;
      if (dot < 0.02 && dist > 28) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = bug;
      }
    }
    return best;
  }

  handleNet(): void {
    if (this.paused || this.captureActive) return;
    this.sfx.ensure();
    this.player.swing();
    const target = this.findNetTarget();
    if (!target) {
      this.swingNet();
      this.sfx.net();
      this.ui.toast('空挥了 · 靠近一点，转身对准它', 'info');
      return;
    }

    if (target.def.id === 'race' && !this.splitGroup && !target.splitDone) {
      target.splitDone = true;
      this.handleSplit(target);
      return;
    }

    this.startCapture(target);
  }

  private startCapture(bug: Bug): void {
    this.captureActive = true;
    this.captureBug = bug;
    (this.player.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.bugs.forEach((b) => b.pauseMotion());
    this.ui.setInteraction('');
    this.lastPrompt = '';

    const scale = bug.captureWindowScale();
    const greenHalf = 0.07 * scale;
    const amberHalf = 0.22 * scale;
    this.captureZone = {
      green: [0.68 - greenHalf, 0.68 + greenHalf],
      amber: [0.68 - amberHalf, 0.68 + amberHalf],
    };

    this.swingNet(bug.x, bug.centerY);
    this.sfx.net();
    this.ui.startCapture({
      name: bug.def.name,
      color: bug.def.color,
      duration: 1200,
      green: this.captureZone.green,
      amber: this.captureZone.amber,
    }, (position) => this.resolveCapture(position), () => this.resolveCapture(-1));
  }

  private resolveCapture(position: number): void {
    if (!this.captureActive) return;
    const bug = this.captureBug;
    this.captureActive = false;
    this.captureBug = null;
    if (!bug) return;

    let quality: Quality = 'miss';
    if (position >= 0) {
      if (position >= this.captureZone.green[0] && position <= this.captureZone.green[1]) quality = 'perfect';
      else if (position >= this.captureZone.amber[0] && position <= this.captureZone.amber[1]) quality = 'good';
    }

    if (quality === 'miss') {
      this.failCatch(bug);
    } else {
      if (bug.def.id === 'race' && this.splitGroup) this.handleSplitCatch(bug, quality);
      else this.commitCatch(bug, quality);
    }
  }

  private commitCatch(bug: Bug, quality: Exclude<Quality, 'miss'>): void {
    const def = bug.def;
    this.store.catchBug(def.id, quality);
    this.sparkBurst(bug.x, bug.centerY, def.color, quality === 'perfect' ? 22 : 14);
    this.cameras.main.shake(100, 0.0035);
    this.sfx[quality === 'perfect' ? 'perfect' : 'good']();
    this.removeBug(bug);
    if (def.id === 'cache' && this.cupImage) this.cupImage.setVisible(false);
    this.ui.toast(`${def.name} 已收容${quality === 'perfect' ? ' · PERFECT' : ''} · 去图鉴安抚它`, quality === 'perfect' ? 'tame' : 'ok');
    this.afterCatch(def.id);
  }

  private handleSplitCatch(bug: Bug, quality: Exclude<Quality, 'miss'>): void {
    const group = this.splitGroup;
    if (!group) {
      this.commitCatch(bug, quality);
      return;
    }

    if (group.caught === 0) {
      group.caught = 1;
      group.deadline = this.time.now + 5000;
      group.bestPerfect = quality === 'perfect';
      group.bestQuality = quality;
      this.sparkBurst(bug.x, bug.centerY, bug.def.color, 16);
      this.removeBug(bug);
      this.sfx.good();
      this.ui.toast('分裂体还剩一只 · 5 秒内收网', 'warn');
      return;
    }

    const best: Exclude<Quality, 'miss'> = quality === 'perfect' || group.bestPerfect ? 'perfect' : 'good';
    this.splitGroup = null;
    this.ui.setSplitTimer(null);
    this.sparkBurst(bug.x, bug.centerY, bug.def.color, 22);
    this.removeBug(bug);
    this.store.catchBug('race', best);
    this.sfx.perfect();
    this.ui.toast('并发幽灵收容成功 · 两只都进网了', 'tame');
    this.afterCatch('race');
  }

  private failSplit(): void {
    const group = this.splitGroup;
    if (!group) return;
    const remaining = this.bugs.find((b) => b.def.id === 'race' && !b.removed);
    if (remaining) this.removeBug(remaining);
    this.splitGroup = null;
    this.queueRespawn('race', 12000);
    this.sfx.miss();
    this.ui.setSplitTimer(null);
    this.ui.toast('并发幽灵合并了 · 等它下次再分裂', 'bad');
  }

  private failCatch(bug: Bug): void {
    if (this.store.perkUnlocked('loop')) {
      bug.state = 'alert';
      bug.stateTimer = 0.6;
      this.ui.toast('跳出循环 · 空挥没有惊动它，再试一次', 'ok');
    } else {
      bug.state = 'flee';
      bug.stateTimer = 2.8;
      this.ui.toast('失手了 · 它跑了，追上去再试', 'bad');
    }
    this.sfx.miss();
    this.cameras.main.shake(90, 0.0025);
  }

  private removeBug(bug: Bug): void {
    this.bugs = this.bugs.filter((b) => b !== bug);
    bug.despawn();
  }

  private afterCatch(id: string): void {
    if (!this.firstCatchDone && this.store.caughtCount() === 1) {
      this.firstCatchDone = true;
      this.time.delayedCall(620, () => this.ui.openJournal(id));
    }
    if (this.store.allCaught()) {
      this.time.delayedCall(700, () => this.ui.toast('全部收容 · 按 Tab 打开图鉴，把它们安抚下来', 'warn'));
    }
  }

  private swingNet(x?: number, y?: number): void {
    const angle = Math.atan2(this.player.facing.y, this.player.facing.x);
    const nx = x ?? this.player.x + this.player.facing.x * 38;
    const ny = y ?? (this.player.y - 18) + this.player.facing.y * 38;
    const net = this.add.image(nx, ny, 'net')
      .setDepth(1003)
      .setAlpha(0.95)
      .setScale(0.9)
      .setRotation(angle + 0.55);
    this.tweens.add({
      targets: net,
      rotation: angle - 0.7,
      alpha: 0,
      scale: 1.18,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => net.destroy(),
    });
  }

  private sparkBurst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.add.image(x, y, 'spark')
        .setDepth(1003)
        .setTint(Phaser.Display.Color.HexStringToColor(color).color)
        .setScale(1.2 + Math.random() * 2);
      const angle = Math.random() * Math.PI * 2;
      const distance = 24 + Math.random() * 54;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 8,
        alpha: 0,
        scale: 0.2,
        duration: 480 + Math.random() * 260,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  handleInteract(): void {
    if (this.paused || this.captureActive) return;
    this.sfx.ensure();
    if (this.nearInteraction === 'coffee') this.brewCoffee();
    else if (this.nearInteraction === 'console') this.restartServer();
    else this.ui.toast('附近没有可以互动的东西', 'info');
  }

  private brewCoffee(): void {
    const now = this.time.now;
    if (now < this.coffeeReadyAt) {
      this.ui.toast(`咖啡机还在加热 · ${Math.ceil((this.coffeeReadyAt - now) / 1000)} 秒`, 'info');
      return;
    }
    const cooldown = this.store.perkUnlocked('cache') ? 8000 : 20000;
    this.coffeeReadyAt = now + cooldown;
    this.sfx.brew();
    this.spawnSteam();

    const cache = this.bugs.find((b) => b.def.id === 'cache' && !b.removed);
    if (cache && cache.hidden && !this.store.isCaught('cache')) {
      cache.reveal();
      if (this.cupImage) this.cupImage.setVisible(false);
      this.ui.toast('咖啡好了 · 杯子里有东西跑出来了', 'warn');
    } else {
      this.ui.toast('咖啡好了 · 今晚的 Bug 都安静了', 'ok');
    }
  }

  private restartServer(): void {
    const segv = this.bugs.find((b) => b.def.id === 'segv' && !b.removed);
    if (segv) {
      segv.chargeCooldownUntil = this.time.now + 15000;
      segv.state = 'wander';
      segv.alertText.setVisible(false);
      segv.sprite.clearTint();
    }
    this.sfx.brew();
    this.cameras.main.flash(110, 124, 216, 255, false);
    this.ui.toast('机柜重启完成 · 段错误安静了 15 秒', 'ok');
  }

  private spawnSteam(): void {
    const pos = this.pointBase(COFFEE_POINT.x, COFFEE_POINT.y);
    for (let i = 0; i < 5; i++) {
      const steam = this.add.image(pos.x - 12 + Math.random() * 24, 106 + Math.random() * 18, 'steam')
        .setDepth(1003)
        .setAlpha(0.34)
        .setScale(1 + Math.random());
      this.tweens.add({
        targets: steam,
        y: steam.y - 34 - Math.random() * 18,
        x: steam.x + (Math.random() - 0.5) * 18,
        alpha: 0,
        duration: 900 + i * 80,
        delay: i * 90,
        ease: 'Sine.easeOut',
        onComplete: () => steam.destroy(),
      });
    }
  }

  handleAbility(): void {
    if (this.paused || this.captureActive) return;
    this.sfx.ensure();
    if (!this.store.perkUnlocked('scope')) {
      this.ui.toast('还没有驯化需求变更龙 · 先去图鉴安抚它', 'tip');
      return;
    }
    if (this.qUsed) {
      this.ui.toast('范围冻结本班已经用过了', 'tip');
      return;
    }
    this.qUsed = true;
    this.bugs.forEach((b) => b.freezeFor(3000));
    this.ui.setQUsed(true);
    this.ui.toast('范围冻结 · 全场 Bug 静止 3 秒', 'tame');
    this.sfx.phase();
    this.cameras.main.flash(120, 124, 216, 255, false);
  }

  private syncPerks(): void {
    this.player.setKnockbackResist(this.store.perkUnlocked('segv'));
    this.ui.setQUsed(this.qUsed);
  }

  setPaused(value: boolean): void {
    this.paused = value;
    if (value) {
      this.physics.pause();
      (this.player.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.ui.setInteraction('');
      this.lastPrompt = '';
    } else {
      this.physics.resume();
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  isCaptureActive(): boolean {
    return this.captureActive;
  }

  setTouchVector(x: number, y: number): void {
    this.touchVector.set(x, y);
  }

  setTouchSneak(value: boolean): void {
    this.touchSneak = value;
  }

  isMuted(): boolean {
    return this.sfx.muted;
  }

  playSoothe(tamed: boolean): void {
    if (tamed) this.sfx.tame();
    else this.sfx.good();
  }

  toggleSound(): boolean {
    const muted = this.sfx.toggle();
    this.ui.setSoundMuted(muted);
    return muted;
  }

  celebrate(): void {
    this.sfx.egg();
    this.cameras.main.flash(180, 123, 255, 178, false);
    const colors = ['#7bffb2', '#ffc857', '#ff7eb6', '#7cd8ff', '#ff6b6b'];
    for (let i = 0; i < 38; i++) {
      const color = colors[i % colors.length];
      this.sparkBurst(this.player.x, this.player.y - 20, color, 1);
    }
    this.ui.toast('1024 · 程序员节快乐。今晚不写 Bug，只写诗。', 'tame');
  }

  getMinimapData(): { player: { x: number; y: number }; bugs: Array<{ x: number; y: number; color: string }>; zone: ZoneId } {
    return {
      player: { x: this.player ? this.player.x / TILE : 0, y: this.player ? this.player.y / TILE : 0 },
      bugs: this.bugs
        .filter((b) => !b.hidden && !b.removed && b.isCatchable)
        .map((b) => ({ x: b.x / TILE, y: b.y / TILE, color: b.def.color })),
      zone: this.currentZone,
    };
  }

  getDebugState(): Record<string, unknown> {
    return {
      phase: this.phase,
      paused: this.paused,
      captureActive: this.captureActive,
      caught: this.store.caughtCount(),
      tamed: this.store.tamedCount(),
      bugs: this.bugs.filter((b) => !b.removed).map((b) => ({
        id: b.def.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        state: b.state,
        hidden: b.hidden,
        scale: Number(b.sprite.scaleX.toFixed(2)),
        growLevel: b.growLevel,
        anim: b.sprite.anims.currentAnim?.key,
        frame: b.sprite.anims.currentFrame?.index,
      })),
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        facing: { x: this.player.facing.x, y: this.player.facing.y },
        anim: this.player.sprite.anims.currentAnim?.key,
        frame: this.player.sprite.anims.currentFrame?.index,
      },
      splitGroup: this.splitGroup,
    };
  }

  private installDebugApi(): void {
    const api = {
      scene: this,
      store: this.store,
      ui: this.ui,
      getState: () => this.getDebugState(),
      teleportTo: (id: string) => {
        const bug = this.bugs.find((b) => b.def.id === id && !b.removed);
        if (!bug) return false;
        this.player.setPosition(bug.x, bug.y + 46);
        this.player.facing.set(0, -1);
        return true;
      },
      catchAll: () => {
        for (const def of BUGS) {
          if (!this.store.isCaught(def.id)) this.store.catchBug(def.id, 'perfect');
          const active = this.bugs.find((b) => b.def.id === def.id);
          if (active) this.removeBug(active);
        }
      },
      tameAll: () => {
        for (const def of BUGS) {
          if (this.store.isCaught(def.id) && !this.store.isTamed(def.id)) {
            this.store.soothe(def.id);
            this.store.soothe(def.id);
            this.store.soothe(def.id);
          }
        }
      },
      setPhase: (n: number) => {
        this.phase = Phaser.Math.Clamp(n, 0, PHASES.length - 1);
        this.phaseStarted = this.time.now;
        const phase = PHASES[this.phase];
        this.dark.setFillStyle(phase.tint, phase.alpha);
        this.ui.setShift(this.phase);
      },
    };
    (window as unknown as { __bugPatrol: typeof api }).__bugPatrol = api;
  }
}
