import Phaser from 'phaser';

export interface MoveInput {
  x: number;
  y: number;
  sneak: boolean;
  enabled: boolean;
}

export class Player {
  scene: Phaser.Scene;
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  facing = new Phaser.Math.Vector2(0, 1);
  sneaking = false;
  private dir: 'down' | 'up' | 'side' = 'down';
  private netUntil = 0;
  private stunUntil = 0;
  private knockbackResist = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player-down-idle-0');
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(3);
    this.sprite.setDepth(y);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDrag(1000, 1000);
    this.sprite.setMaxVelocity(190, 190);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 7);
    body.setOffset(3, 17);

    this.shadow = scene.add.image(x, y - 3, 'shadow')
      .setOrigin(0.5, 0.5)
      .setScale(1.6, 1.1)
      .setAlpha(0.7)
      .setDepth(y - 1);

    this.play('player-idle-down', true);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  setKnockbackResist(value: boolean): void {
    this.knockbackResist = value;
  }

  get isStunned(): boolean {
    return this.scene.time.now < this.stunUntil;
  }

  swing(): void {
    this.netUntil = this.scene.time.now + 320;
    this.play(`player-net-${this.dir}`, true);
  }

  knockback(fromX: number, fromY: number, force: number, stunMs: number): void {
    const factor = this.knockbackResist ? 0.45 : 1;
    const angle = Math.atan2(this.sprite.y - fromY, this.sprite.x - fromX);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * force * factor, Math.sin(angle) * force * factor);
    this.stunUntil = this.scene.time.now + stunMs * (this.knockbackResist ? 0.5 : 1);
    this.sprite.setTint(0xffb3a0);
    this.scene.time.delayedCall(stunMs * (this.knockbackResist ? 0.5 : 1), () => {
      this.sprite.clearTint();
    });
  }

  update(dt: number, input: MoveInput): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const now = this.scene.time.now;

    if (!input.enabled || this.isStunned) {
      body.setVelocity(0, 0);
      if (now >= this.netUntil) this.playIdle();
      this.syncVisuals();
      return;
    }

    let dx = input.x;
    let dy = input.y;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    const moving = len > 0.01;
    if (moving) {
      this.facing.set(dx, dy).normalize();
      if (Math.abs(dx) > Math.abs(dy) + 0.01) {
        this.dir = 'side';
        this.sprite.setFlipX(dx < 0);
      } else {
        this.dir = dy < 0 ? 'up' : 'down';
        this.sprite.setFlipX(false);
      }
    }

    this.sneaking = input.sneak && moving;
    const speed = this.sneaking ? 78 : 158;
    body.setVelocity(dx * speed, dy * speed);

    if (now >= this.netUntil) {
      this.play(`player-${moving ? 'walk' : 'idle'}-${this.dir}`, true);
    }

    this.sprite.setAlpha(this.sneaking ? 0.82 : 1);
    this.syncVisuals();
  }

  private syncVisuals(): void {
    this.sprite.setDepth(this.sprite.y);
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 3);
    this.shadow.setDepth(this.sprite.y - 1);
    this.shadow.setAlpha(this.sneaking ? 0.45 : 0.7);
  }

  private playIdle(): void {
    this.play(`player-idle-${this.dir}`, true);
  }

  private play(key: string, ignoreIfPlaying = true): void {
    if (!this.scene.anims.exists(key)) return;
    const current = this.sprite.anims.currentAnim?.key;
    if (current === key) return;
    this.sprite.play(key, ignoreIfPlaying);
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.sprite.setDepth(y);
    this.shadow.setPosition(x, y - 3);
    this.shadow.setDepth(y - 1);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
