import Phaser from 'phaser';
import type { BugDef } from '../data/types';
import type { Player } from './Player';

export type BugState = 'wander' | 'alert' | 'flee' | 'loop' | 'grow' | 'telegraph' | 'charge' | 'recover' | 'stunned' | 'hidden' | 'caught';

const BASE_SPEED: Record<string, number> = {
  npe: 52,
  loop: 92,
  scope: 62,
  segv: 78,
  race: 96,
  cache: 104,
};

const DETECTION: Record<string, number> = {
  npe: 0,
  loop: 0,
  scope: 130,
  segv: 220,
  race: 185,
  cache: 145,
};

export class Bug {
  scene: Phaser.Scene;
  def: BugDef;
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  alertText: Phaser.GameObjects.Text;
  cloneMark: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
  chargeLine: Phaser.GameObjects.Graphics;

  state: BugState = 'wander';
  stateTimer = 0;
  wanderTimer = 0;
  target = new Phaser.Math.Vector2();
  patrol: Array<{ x: number; y: number }> = [];
  patrolIndex = 0;
  baseSpeed: number;
  detection: number;
  speedMultiplier = 1;
  frozen = false;
  hidden = false;
  removed = false;
  isClone = false;
  splitDone = false;
  showCloneMark = false;
  growLevel = 0;
  growTime = 0;
  chargeCooldownUntil = 0;
  chargeUntil = 0;
  stunUntil = 0;
  chargeDir = new Phaser.Math.Vector2();
  frozenUntil = 0;
  private lastChargeHit = 0;
  private stuckTime = 0;
  private onSplit?: (bug: Bug) => void;

  constructor(scene: Phaser.Scene, def: BugDef, x: number, y: number, onSplit?: (bug: Bug) => void) {
    this.scene = scene;
    this.def = def;
    this.onSplit = onSplit;
    this.baseSpeed = BASE_SPEED[def.id] || 70;
    this.detection = DETECTION[def.id] || 120;

    this.sprite = scene.physics.add.sprite(x, y, `bug-${def.id}-0`);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(0.35);
    this.sprite.setAlpha(0.4);
    this.sprite.setDepth(y);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(400, 400);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(8, 5);
    body.setOffset(2, 7);

    scene.tweens.add({
      targets: this.sprite,
      scaleX: 3,
      scaleY: 3,
      alpha: 1,
      duration: 280,
      ease: 'Back.easeOut',
    });

    this.shadow = scene.add.image(x, y - 2, 'shadow')
      .setOrigin(0.5, 0.5)
      .setScale(0.55, 0.45)
      .setAlpha(0.55)
      .setDepth(y - 1);
    this.glow = scene.add.image(x, y - 17, 'glow')
      .setOrigin(0.5, 0.5)
      .setScale(0.28)
      .setTint(Phaser.Display.Color.HexStringToColor(def.color).color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.25)
      .setDepth(y - 2);

    scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.18, to: 0.36 },
      scaleX: { from: 0.24, to: 0.32 },
      scaleY: { from: 0.24, to: 0.32 },
      duration: 900 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.shadow,
      alpha: { from: 0.55, to: 0.4 },
      duration: 1000 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.alertText = scene.add.text(x, y - 48, '!', {
      fontFamily: 'monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffc857',
      stroke: '#04130b',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(y + 2).setVisible(false);

    this.cloneMark = scene.add.text(x, y - 52, '×', {
      fontFamily: 'monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ff7eb6',
      stroke: '#04130b',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(y + 3).setVisible(false);

    this.levelText = scene.add.text(x, y - 50, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffb86b',
      stroke: '#04130b',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(y + 3).setVisible(false);

    this.chargeLine = scene.add.graphics().setDepth(y + 1);

    if (def.patrol) {
      this.patrol = def.patrol.map((p) => ({ x: p.x * 32 + 16, y: p.y * 32 + 32 }));
    }
    if (def.behavior === 'loop') {
      this.state = 'loop';
      this.patrolIndex = 0;
    }
    if (def.behavior === 'mimic') {
      this.hidden = true;
      this.state = 'hidden';
      this.sprite.setVisible(false);
      this.shadow.setVisible(false);
      this.glow.setVisible(false);
      body.enable = false;
    }

    this.updateAnimation();
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }

  get centerY(): number {
    return this.sprite.y - 17;
  }

  get caught(): boolean {
    return this.state === 'caught' || this.removed;
  }

  get isCatchable(): boolean {
    return !this.removed && !this.hidden && this.state !== 'caught';
  }

  get isFleeing(): boolean {
    return this.state === 'flee';
  }

  get isStunned(): boolean {
    return this.state === 'stunned';
  }

  get isCharging(): boolean {
    return this.state === 'charge';
  }

  captureWindowScale(): number {
    let scale = 1;
    if (this.state === 'stunned') scale *= 1.35;
    if (this.state === 'recover') scale *= 1.18;
    if (this.state === 'flee') scale *= 0.82;
    if (this.state === 'charge' || this.state === 'telegraph') scale *= 0.78;
    if (this.frozen) scale *= 0.68;
    if (this.def.behavior === 'grow') scale *= Math.max(0.5, 1 - this.growLevel * 0.16);
    return Phaser.Math.Clamp(scale, 0.42, 1.4);
  }

  distanceTo(player: Player): number {
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y);
  }

  isPlayerLooking(player: Player): boolean {
    const dx = this.sprite.x - player.sprite.x;
    const dy = this.sprite.y - player.sprite.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return true;
    return (dx / len) * player.facing.x + (dy / len) * player.facing.y > 0.2;
  }

  reveal(): void {
    if (!this.hidden) return;
    this.hidden = false;
    this.state = 'alert';
    this.stateTimer = 0.55;
    this.sprite.setVisible(true);
    this.shadow.setVisible(true);
    this.glow.setVisible(true);
    this.body.enable = true;
    this.sprite.setScale(0.5, 0.5);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 3,
      scaleY: 3,
      duration: 260,
      ease: 'Back.easeOut',
    });
  }

  freezeFor(ms: number): void {
    this.frozenUntil = Math.max(this.frozenUntil, this.scene.time.now + ms);
    this.body.setVelocity(0, 0);
    this.sprite.setTint(0x9fd8ff);
  }

  onBlocked(): void {
    if (this.state === 'charge' || this.state === 'telegraph') {
      this.state = 'stunned';
      this.stateTimer = 1.2;
      this.body.setVelocity(0, 0);
      this.sprite.setTint(0xffc857);
      this.showAlert('*', '#7cd8ff', 1.2);
    }
  }

  hitPlayer(): void {
    if (this.state !== 'charge') return;
    if (this.scene.time.now - this.lastChargeHit < 600) return;
    this.lastChargeHit = this.scene.time.now;
    this.state = 'recover';
    this.stateTimer = 0.9;
    this.body.setVelocity(0, 0);
    this.sprite.clearTint();
  }

  update(dt: number, player: Player, perks: { race: boolean }): void {
    if (this.removed || this.state === 'caught' || this.hidden) return;
    const now = this.scene.time.now;
    const body = this.body;

    this.showCloneMark = this.isClone && perks.race;
    this.syncVisuals();
    this.updateAnimation();

    if (this.frozenUntil > now) {
      body.setVelocity(0, 0);
      this.alertText.setVisible(true).setText('…').setColor('#9fd8ff');
      this.sprite.setTint(0x9fd8ff);
      this.updateTransientVisuals();
      return;
    } else if (this.sprite.tintTopLeft === 0x9fd8ff) {
      this.sprite.clearTint();
    }

    if (this.state === 'stunned') {
      this.stateTimer -= dt;
      body.setVelocity(0, 0);
      this.alertText.setVisible(true).setText('*').setColor('#7cd8ff');
      if (this.stateTimer <= 0) {
        this.sprite.clearTint();
        this.alertText.setVisible(false);
        this.state = 'wander';
        this.pickWanderTarget();
      }
      this.updateTransientVisuals();
      return;
    }

    if (this.state === 'telegraph') {
      this.stateTimer -= dt;
      body.setVelocity(0, 0);
      this.drawChargeLine(player);
      this.showAlert('!', '#ff6b6b');
      if (this.stateTimer <= 0) {
        this.chargeLine.clear();
        this.state = 'charge';
        this.chargeUntil = now + 520;
        this.chargeDir.set(player.sprite.x - this.sprite.x, player.sprite.y - this.sprite.y).normalize();
        this.alertText.setVisible(false);
      }
      this.updateTransientVisuals();
      return;
    }

    if (this.state === 'charge') {
      const blocked = body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down;
      if (blocked) {
        this.onBlocked();
        this.updateTransientVisuals();
        return;
      }
      if (now > this.chargeUntil) {
        this.state = 'recover';
        this.stateTimer = 0.8;
        body.setVelocity(0, 0);
        this.sprite.clearTint();
      } else {
        body.setVelocity(this.chargeDir.x * 310, this.chargeDir.y * 310);
        this.sprite.setTint(0xff9a8a);
      }
      this.updateTransientVisuals();
      return;
    }

    if (this.state === 'recover') {
      this.stateTimer -= dt;
      body.setVelocity(0, 0);
      this.showAlert('…', '#7cd8ff');
      if (this.stateTimer <= 0) {
        this.alertText.setVisible(false);
        this.state = 'wander';
        this.chargeCooldownUntil = now + 1400;
        this.pickWanderTarget();
      }
      this.updateTransientVisuals();
      return;
    }

    // NPE: freeze when the player faces it
    if (this.def.behavior === 'freeze') {
      this.frozen = this.distanceTo(player) < 165 && this.isPlayerLooking(player);
      if (this.frozen) {
        body.setVelocity(0, 0);
        this.showAlert('…', '#9fd8ff');
      } else if (this.alertText.text === '…') {
        this.alertText.setVisible(false);
      }
    }

    if (this.frozen) {
      this.updateTransientVisuals();
      return;
    }

    const dist = this.distanceTo(player);
    const sneaking = player.sneaking;
    const detect = this.detection * (sneaking ? 0.55 : 1);

    // charge behavior decides before the standard alert
    if (this.def.behavior === 'charge' && this.state === 'wander' && dist < this.detection && now > this.chargeCooldownUntil) {
      this.state = 'telegraph';
      this.stateTimer = 0.5;
      this.body.setVelocity(0, 0);
      this.showAlert('!', '#ff6b6b');
      this.updateTransientVisuals();
      return;
    }

    if (this.def.behavior !== 'loop' && this.def.behavior !== 'grow' && this.def.behavior !== 'freeze' && this.state === 'wander' && dist < detect) {
      this.state = 'alert';
      this.stateTimer = 0.42;
      body.setVelocity(0, 0);
      this.showAlert('!', '#ffc857');
      if (this.def.behavior === 'split' && !this.splitDone && !this.isClone) {
        this.splitDone = true;
        this.onSplit?.(this);
      }
      this.updateTransientVisuals();
      return;
    }

    if (this.state === 'alert') {
      this.stateTimer -= dt;
      body.setVelocity(0, 0);
      if (this.stateTimer <= 0) {
        if (this.def.behavior === 'grow') {
          this.state = 'grow';
          this.alertText.setVisible(false);
        } else {
          this.state = 'flee';
          this.stateTimer = 2.8;
        }
      }
      this.updateTransientVisuals();
      return;
    }

    if (this.state === 'flee') {
      this.stateTimer -= dt;
      this.moveAwayFrom(player, this.baseSpeed * 1.45);
      if (this.stateTimer <= 0 || dist > 330) {
        this.state = this.def.behavior === 'grow' ? 'grow' : 'wander';
        this.alertText.setVisible(false);
        this.pickWanderTarget();
      }
      this.updateTransientVisuals();
      return;
    }

    if (this.def.behavior === 'loop') {
      this.doLoop();
    } else if (this.def.behavior === 'grow') {
      this.doGrow(dt, player);
    } else {
      this.doWander(dt);
    }

    this.updateTransientVisuals();
  }

  private doLoop(): void {
    if (!this.patrol.length) return;
    const target = this.patrol[this.patrolIndex];
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, target.x, target.y);
    if (dist < 14) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrol.length;
      return;
    }
    const angle = Math.atan2(target.y - this.sprite.y, target.x - this.sprite.x);
    this.body.setVelocity(Math.cos(angle) * this.baseSpeed * this.speedMultiplier, Math.sin(angle) * this.baseSpeed * this.speedMultiplier);
    this.checkStuck();
  }

  private doGrow(dt: number, player: Player): void {
    this.growTime += dt;
    if (this.growTime > 8 && this.growLevel < 3) {
      this.growTime = 0;
      this.growLevel += 1;
      const scale = 3 + this.growLevel * 0.45;
      this.sprite.setScale(scale);
      this.scene.tweens.add({ targets: this.sprite, scaleX: scale * 1.08, scaleY: scale * 1.08, duration: 140, yoyo: true });
      this.showAlert('+1', '#ffb86b', 1);
    }
    this.levelText.setVisible(this.growLevel > 0);
    this.levelText.setText(this.growLevel > 0 ? `需求 ×${this.growLevel + 1}` : '');
    this.doWander(dt, 0.7 + this.growLevel * 0.12);
    if (this.growTime > 42 && this.growLevel >= 3) {
      // it becomes too big and leaves; the scene will respawn it later
      this.despawn();
    }
  }

  private doWander(dt: number, speedScale = 1): void {
    if (!this.target || (this.target.x === 0 && this.target.y === 0)) this.pickWanderTarget();
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.target.x, this.target.y);
    if (dist < 12) {
      this.body.setVelocity(0, 0);
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) this.pickWanderTarget();
      return;
    }
    const angle = Math.atan2(this.target.y - this.sprite.y, this.target.x - this.sprite.x);
    const speed = this.baseSpeed * this.speedMultiplier * speedScale;
    this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.checkStuck();
  }

  private pickWanderTarget(): void {
    const radius = this.def.wanderRadius || 50;
    const angle = Math.random() * Math.PI * 2;
    const distance = 18 + Math.random() * radius;
    const base = this.def.spawn;
    this.target.set(
      Phaser.Math.Clamp(base.x * 32 + 16 + Math.cos(angle) * distance, 80, 1440),
      Phaser.Math.Clamp(base.y * 32 + 32 + Math.sin(angle) * distance, 90, 820),
    );
    this.wanderTimer = 0.6 + Math.random() * 1.8;
  }

  private moveAwayFrom(player: Player, speed: number): void {
    const angle = Math.atan2(this.sprite.y - player.sprite.y, this.sprite.x - player.sprite.x);
    const finalSpeed = speed * this.speedMultiplier;
    this.body.setVelocity(Math.cos(angle) * finalSpeed, Math.sin(angle) * finalSpeed);
    this.checkStuck();
  }

  private checkStuck(): void {
    const body = this.body;
    if (body.speed < 4) {
      this.stuckTime += 0.1;
      if (this.stuckTime > 0.55) {
        this.stuckTime = 0;
        if (this.def.behavior === 'loop' && this.patrol.length) {
          this.patrolIndex = (this.patrolIndex + 1) % this.patrol.length;
        } else {
          this.pickWanderTarget();
        }
      }
    } else {
      this.stuckTime = 0;
    }
  }

  private updateAnimation(): void {
    if (this.hidden || this.removed) return;
    const id = this.def.id;
    let key = `bug-idle-${id}`;
    if (this.frozenUntil > this.scene.time.now) key = `bug-alert-${id}`;
    else if (this.state === 'flee' || this.state === 'charge') key = `bug-flee-${id}`;
    else if (
      this.state === 'alert' ||
      this.state === 'telegraph' ||
      this.state === 'stunned' ||
      this.state === 'recover' ||
      this.frozen
    ) {
      key = `bug-alert-${id}`;
    }
    if (!this.scene.anims.exists(key)) return;
    if (this.sprite.anims.currentAnim?.key === key) return;
    this.sprite.play(key, true);
  }

  private showAlert(text: string, color: string, duration = 0): void {
    const changed = !this.alertText.visible || this.alertText.text !== text;
    this.alertText.setVisible(true).setText(text).setColor(color);
    if (changed) {
      this.alertText.setScale(1.35);
      this.scene.tweens.add({
        targets: this.alertText,
        scaleX: 1,
        scaleY: 1,
        duration: 160,
        ease: 'Back.easeOut',
      });
    }
    if (duration > 0) {
      this.scene.time.delayedCall(duration * 1000, () => {
        if (!this.removed && this.state !== 'telegraph' && this.state !== 'stunned') {
          this.alertText.setVisible(false);
        }
      });
    }
  }

  private drawChargeLine(player: Player): void {
    this.chargeLine.clear();
    this.chargeLine.lineStyle(2, 0xff6b6b, 0.5);
    this.chargeLine.beginPath();
    this.chargeLine.moveTo(this.sprite.x, this.sprite.y - 14);
    this.chargeLine.lineTo(player.sprite.x, player.sprite.y - 14);
    this.chargeLine.strokePath();
  }

  private syncVisuals(): void {
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 2);
    this.shadow.setDepth(this.sprite.y - 1);
    this.glow.setPosition(this.sprite.x, this.sprite.y - 17);
    this.glow.setDepth(this.sprite.y - 2);
  }

  private updateTransientVisuals(): void {
    const y = this.sprite.y;
    this.alertText.setPosition(this.sprite.x, y - (this.def.behavior === 'grow' ? 58 : 48));
    this.alertText.setDepth(y + 3);
    this.cloneMark.setPosition(this.sprite.x, y - 52);
    this.cloneMark.setDepth(y + 4);
    this.cloneMark.setVisible(this.showCloneMark);
    if (!this.showCloneMark) this.cloneMark.setAlpha(1);
    if (this.showCloneMark) {
      this.cloneMark.setAlpha(0.6 + Math.sin(this.scene.time.now / 120) * 0.4);
    }
    this.levelText.setPosition(this.sprite.x, y - 62);
    this.levelText.setDepth(y + 4);
    this.chargeLine.setDepth(y + 2);
  }

  despawn(): void {
    if (this.removed) return;
    this.removed = true;
    this.state = 'caught';
    this.body.enable = false;
    this.scene.tweens.killTweensOf([this.sprite, this.shadow, this.glow]);
    this.sprite.anims.stop();

    this.scene.tweens.add({
      targets: this.sprite,
      angle: 14,
      scaleX: 0.3,
      scaleY: 0.3,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.easeIn',
    });
    this.scene.tweens.add({
      targets: [this.shadow, this.glow, this.alertText, this.cloneMark, this.levelText],
      alpha: 0,
      duration: 220,
    });
    this.scene.time.delayedCall(300, () => this.destroy());
    this.chargeLine.clear();
  }

  destroy(): void {
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.shadow.destroy();
    this.glow.destroy();
    this.alertText.destroy();
    this.cloneMark.destroy();
    this.levelText.destroy();
    this.chargeLine.destroy();
  }

  pauseMotion(): void {
    this.body.setVelocity(0, 0);
  }
}
