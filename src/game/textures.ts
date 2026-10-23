import Phaser from 'phaser';
import { BUGS, SPRITES } from '../data/bugs';

type Ctx = CanvasRenderingContext2D;

function addCanvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function lighten(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function drawTiles(ctx: Ctx): void {
  const T = 32;
  const floor = (ox: number, base: string, line: string, alt: boolean): void => {
    rect(ctx, ox, 0, T, T, base);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let i = 0; i <= T; i += 16) {
      ctx.beginPath();
      ctx.moveTo(ox + i + 0.5, 0);
      ctx.lineTo(ox + i + 0.5, T);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox, i + 0.5);
      ctx.lineTo(ox + T, i + 0.5);
      ctx.stroke();
    }
    if (alt) {
      rect(ctx, ox + 5, 7, 8, 5, 'rgba(0,0,0,.16)');
      rect(ctx, ox + 18, 21, 9, 4, 'rgba(255,255,255,.035)');
    } else {
      rect(ctx, ox + 23, 9, 2, 1, 'rgba(255,255,255,.06)');
      rect(ctx, ox + 9, 24, 1, 2, 'rgba(0,0,0,.14)');
    }
  };

  // 0/5 desk carpet
  floor(0, '#22352c', 'rgba(74,112,92,.34)', false);
  floor(5 * T, '#243a2f', 'rgba(78,118,96,.32)', true);

  // 1/6 server floor
  rect(ctx, T, 0, T, T, '#16242c');
  ctx.strokeStyle = 'rgba(62,104,124,.32)';
  for (let i = 0; i <= T; i += 16) {
    ctx.beginPath();
    ctx.moveTo(T + i + 0.5, 0);
    ctx.lineTo(T + i + 0.5, T);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(T, i + 0.5);
    ctx.lineTo(T + T, i + 0.5);
    ctx.stroke();
  }
  rect(ctx, T + 3, 3, 2, 2, '#355767');
  rect(ctx, T + 27, 3, 2, 2, '#355767');
  rect(ctx, T + 3, 27, 2, 2, '#355767');
  rect(ctx, T + 27, 27, 2, 2, '#355767');

  rect(ctx, 6 * T, 0, T, T, '#182a33');
  ctx.strokeStyle = 'rgba(62,104,124,.28)';
  for (let i = 0; i <= T; i += 16) {
    ctx.beginPath();
    ctx.moveTo(6 * T + i + 0.5, 0);
    ctx.lineTo(6 * T + i + 0.5, T);
    ctx.stroke();
  }
  rect(ctx, 6 * T + 8, 19, 16, 1, '#28414c');

  // 2/7 pantry
  rect(ctx, 2 * T, 0, T, T, '#352c20');
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      rect(ctx, 2 * T + x * 16, y * 16, 16, 16, (x + y) % 2 === 0 ? '#352c20' : '#2c2419');
    }
  }
  ctx.strokeStyle = 'rgba(24,18,12,.4)';
  for (let i = 0; i <= T; i += 16) {
    ctx.beginPath();
    ctx.moveTo(2 * T + i + 0.5, 0);
    ctx.lineTo(2 * T + i + 0.5, T);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2 * T, i + 0.5);
    ctx.lineTo(3 * T, i + 0.5);
    ctx.stroke();
  }
  rect(ctx, 2 * T + 22, 5, 5, 7, 'rgba(255,200,87,.06)');

  rect(ctx, 7 * T, 0, T, T, '#372e21');
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      rect(ctx, 7 * T + x * 16, y * 16, 16, 16, (x + y) % 2 === 0 ? '#372e21' : '#2e251a');
    }
  }
  rect(ctx, 7 * T + 5, 21, 11, 3, 'rgba(0,0,0,.16)');

  // 3 corridor
  rect(ctx, 3 * T, 0, T, T, '#213029');
  ctx.strokeStyle = 'rgba(46,76,62,.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= T; i += 16) {
    ctx.beginPath();
    ctx.moveTo(3 * T + i + 0.5, 0);
    ctx.lineTo(3 * T + i + 0.5, T);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3 * T, i + 0.5);
    ctx.lineTo(4 * T, i + 0.5);
    ctx.stroke();
  }
  rect(ctx, 3 * T + 14, 0, 2, T, 'rgba(255,200,87,.035)');

  // 4 wall
  rect(ctx, 4 * T, 0, T, T, '#0e1814');
  rect(ctx, 4 * T, 0, T, 4, '#244033');
  rect(ctx, 4 * T, 4, T, 2, '#1a2b22');
  rect(ctx, 4 * T, T - 3, T, 3, '#050907');
  ctx.strokeStyle = 'rgba(38,64,51,.24)';
  for (let i = 0; i < T; i += 16) {
    ctx.beginPath();
    ctx.moveTo(4 * T + i + 0.5, 4);
    ctx.lineTo(4 * T + i + 0.5, T - 3);
    ctx.stroke();
  }
  rect(ctx, 4 * T + 3, 8, 1, 1, 'rgba(123,255,178,.16)');
}

type PlayerDir = 'down' | 'up' | 'side';
type PlayerAnimState = 'idle' | 'walk' | 'net';

const TRAE_DARK = '#1A1B1D';
const TRAE_FACE = '#101215';
const TRAE_GREEN = '#32F08C';
const BOT_BODY = '#2B3035';
const BOT_EDGE = '#41484F';

function drawTraeHead(ctx: Ctx, x: number, y: number, dir: PlayerDir, blink: boolean): void {
  // TRAE mark: dark face, green frame with a bottom-left notch, two diamond eyes
  rect(ctx, x, y, 10, 9, TRAE_DARK);

  if (dir === 'up') {
    rect(ctx, x + 1, y + 1, 8, 7, TRAE_FACE);
    rect(ctx, x + 3, y + 3, 4, 3, TRAE_GREEN);
    rect(ctx, x + 4, y + 4, 2, 1, TRAE_DARK);
    rect(ctx, x + 3, y + 6, 4, 1, 'rgba(50,240,140,.35)');
  } else {
    rect(ctx, x + 1, y + 1, 8, 7, TRAE_FACE);
    const eyeY = y + 4;
    if (dir === 'side') {
      const cx = x + 7;
      if (blink) {
        rect(ctx, cx - 1, eyeY, 3, 1, TRAE_GREEN);
      } else {
        rect(ctx, cx, eyeY - 1, 1, 1, TRAE_GREEN);
        rect(ctx, cx - 1, eyeY, 1, 1, TRAE_GREEN);
        rect(ctx, cx, eyeY, 1, 1, TRAE_GREEN);
        rect(ctx, cx + 1, eyeY, 1, 1, TRAE_GREEN);
        rect(ctx, cx, eyeY + 1, 1, 1, TRAE_GREEN);
      }
      rect(ctx, x + 1, y + 3, 1, 3, TRAE_GREEN);
    } else {
      for (const cx of [x + 3, x + 7]) {
        if (blink) {
          rect(ctx, cx - 1, eyeY, 3, 1, TRAE_GREEN);
        } else {
          rect(ctx, cx, eyeY - 1, 1, 1, TRAE_GREEN);
          rect(ctx, cx - 1, eyeY, 1, 1, TRAE_GREEN);
          rect(ctx, cx, eyeY, 1, 1, TRAE_GREEN);
          rect(ctx, cx + 1, eyeY, 1, 1, TRAE_GREEN);
          rect(ctx, cx, eyeY + 1, 1, 1, TRAE_GREEN);
        }
      }
    }
  }

  // green bracket with the lower-left notch from the TRAE mark
  rect(ctx, x, y, 10, 1, TRAE_GREEN);
  rect(ctx, x, y + 1, 1, 7, TRAE_GREEN);
  rect(ctx, x + 9, y + 1, 1, 7, TRAE_GREEN);
  rect(ctx, x + 2, y + 8, 8, 1, TRAE_GREEN);

  rect(ctx, x + 4, y + 9, 2, 1, BOT_EDGE);
}

function drawPlayer(ctx: Ctx, dir: PlayerDir, state: PlayerAnimState, frame: number): void {
  ctx.clearRect(0, 0, 16, 24);

  const bob = state === 'idle'
    ? (frame === 1 || frame === 3 ? 1 : 0)
    : state === 'walk'
      ? (frame === 1 || frame === 3 ? 1 : 0)
      : 0;
  const lean = state === 'net' ? (frame === 0 ? -1 : frame === 1 ? 1 : 0) : 0;
  const blink = state === 'idle' && frame === 2;
  const headX = 3 + lean;
  const headY = 2 - bob;
  const bodyX = 4 + lean;
  const bodyY = 12 - bob;

  let leftTop = 18;
  let rightTop = 18;
  if (state === 'walk') {
    if (frame === 0) rightTop = 19;
    else if (frame === 2) leftTop = 19;
  }

  // legs (behind the body)
  if (dir === 'side') {
    const backX = 6 + lean;
    const frontX = 9 + lean;
    rect(ctx, backX, leftTop, 2, 22 - leftTop, TRAE_DARK);
    rect(ctx, frontX, rightTop, 2, 22 - rightTop, TRAE_DARK);
    rect(ctx, backX, 22, 2, 2, TRAE_GREEN);
    rect(ctx, frontX, 22, 2, 2, TRAE_GREEN);
  } else {
    const leftX = 5 + lean;
    const rightX = 9 + lean;
    rect(ctx, leftX, leftTop, 2, 22 - leftTop, TRAE_DARK);
    rect(ctx, rightX, rightTop, 2, 22 - rightTop, TRAE_DARK);
    rect(ctx, leftX, 22, 2, 2, TRAE_GREEN);
    rect(ctx, rightX, 22, 2, 2, TRAE_GREEN);
  }

  // torso
  rect(ctx, bodyX, bodyY, 8, 6, BOT_BODY);
  rect(ctx, bodyX, bodyY, 8, 1, BOT_EDGE);
  rect(ctx, bodyX, bodyY + 5, 8, 1, TRAE_DARK);
  rect(ctx, bodyX + 2, bodyY + 2, 4, 1, TRAE_GREEN);
  rect(ctx, bodyX + 2, bodyY + 4, 2, 1, TRAE_GREEN);

  if (dir === 'up') {
    rect(ctx, bodyX + 1, bodyY + 1, 6, 3, '#343A40');
    rect(ctx, bodyX + 2, bodyY + 1, 1, 3, TRAE_GREEN);
    rect(ctx, bodyX + 5, bodyY + 1, 1, 3, TRAE_GREEN);
  }

  // arms
  if (dir === 'side') {
    rect(ctx, bodyX - 1, bodyY + 1, 2, 4, BOT_EDGE);
    const frontArmX = state === 'net' && frame === 1 ? bodyX + 8 : bodyX + 6;
    rect(ctx, frontArmX, bodyY + 1, 2, 4, BOT_EDGE);
    rect(ctx, frontArmX, bodyY + 4, 2, 1, TRAE_GREEN);
  } else {
    const rightArmX = state === 'net' && frame === 1 ? bodyX + 9 : bodyX + 8;
    rect(ctx, bodyX - 2, bodyY + 1, 2, 4, BOT_EDGE);
    rect(ctx, rightArmX, bodyY + 1, 2, 4, BOT_EDGE);
    rect(ctx, bodyX - 2, bodyY + 4, 2, 1, TRAE_GREEN);
    rect(ctx, rightArmX, bodyY + 4, 2, 1, TRAE_GREEN);
  }

  drawTraeHead(ctx, headX, headY, dir, blink);
}

function drawDesk(ctx: Ctx): void {
  rect(ctx, 4, 32, 56, 4, 'rgba(0,0,0,.22)');
  rect(ctx, 2, 3, 60, 18, '#5a3f2e');
  rect(ctx, 2, 3, 60, 3, '#7a5540');
  rect(ctx, 2, 20, 60, 2, '#2b1d16');
  rect(ctx, 5, 22, 5, 12, '#2b1d16');
  rect(ctx, 54, 22, 5, 12, '#2b1d16');
  rect(ctx, 8, 7, 11, 7, '#cfe8d8');
  rect(ctx, 9, 9, 8, 1, '#8fb4a1');
  rect(ctx, 9, 11, 6, 1, '#8fb4a1');
  rect(ctx, 46, 7, 6, 6, '#7ee8c4');
  rect(ctx, 47, 6, 4, 1, '#d8fff1');
  rect(ctx, 47, 12, 4, 1, '#3e7c66');
  rect(ctx, 24, 5, 18, 12, '#23352d');
  rect(ctx, 25, 6, 16, 10, '#10211b');
  rect(ctx, 27, 8, 7, 1, '#7bffb2');
  rect(ctx, 27, 10, 10, 1, '#4f9e77');
  rect(ctx, 27, 12, 5, 1, '#ffc857');
}

function drawMonitor(ctx: Ctx): void {
  rect(ctx, 4, 2, 24, 16, '#0b1210');
  rect(ctx, 6, 4, 20, 11, '#163a2e');
  rect(ctx, 7, 5, 9, 1, '#7bffb2');
  rect(ctx, 7, 7, 14, 1, '#3f8b6b');
  rect(ctx, 7, 9, 7, 1, '#ffc857');
  rect(ctx, 7, 11, 11, 1, '#4f9e77');
  rect(ctx, 14, 18, 4, 4, '#1a2420');
  rect(ctx, 10, 22, 12, 2, '#0b1210');
  rect(ctx, 26, 15, 1, 5, '#1a2420');
}

function drawChair(ctx: Ctx): void {
  rect(ctx, 5, 2, 14, 8, '#1e2622');
  rect(ctx, 6, 3, 12, 2, '#334038');
  rect(ctx, 4, 10, 16, 8, '#2a332e');
  rect(ctx, 6, 11, 12, 5, '#354039');
  rect(ctx, 6, 18, 2, 5, '#151d19');
  rect(ctx, 16, 18, 2, 5, '#151d19');
  rect(ctx, 8, 22, 8, 1, '#0b1110');
}

function drawServer(ctx: Ctx): void {
  rect(ctx, 4, 4, 40, 58, '#22343a');
  rect(ctx, 4, 4, 40, 4, '#36505a');
  rect(ctx, 44, 8, 2, 54, '#0b1114');
  for (let y = 10; y < 58; y += 12) {
    rect(ctx, 6, y, 34, 9, '#111c20');
    rect(ctx, 34, y + 2, 2, 2, '#7bffb2');
    rect(ctx, 34, y + 6, 2, 2, '#7cd8ff');
    rect(ctx, 38, y + 2, 2, 2, '#ff6b6b');
    rect(ctx, 8, y + 2, 18, 1, '#21363c');
    rect(ctx, 8, y + 4, 22, 1, '#1c3035');
    rect(ctx, 8, y + 6, 12, 1, '#17272b');
  }
  rect(ctx, 8, 60, 30, 2, '#0a1114');
  rect(ctx, 10, 1, 2, 4, '#2b3c42');
  rect(ctx, 36, 1, 2, 4, '#2b3c42');
}

function drawCoffee(ctx: Ctx): void {
  rect(ctx, 4, 6, 24, 38, '#232a26');
  rect(ctx, 4, 6, 24, 3, '#39433d');
  rect(ctx, 8, 12, 16, 6, '#101613');
  rect(ctx, 9, 13, 4, 4, '#ff6b6b');
  rect(ctx, 18, 13, 4, 4, '#7bffb2');
  rect(ctx, 7, 22, 18, 16, '#1a211e');
  rect(ctx, 10, 24, 12, 11, '#6b3f25');
  rect(ctx, 11, 25, 10, 2, '#8a5433');
  rect(ctx, 9, 38, 14, 2, '#0b1110');
  rect(ctx, 12, 42, 8, 2, '#0b1110');
  rect(ctx, 22, 30, 3, 5, '#2e3632');
}

function drawFridge(ctx: Ctx): void {
  rect(ctx, 4, 2, 32, 60, '#2b332e');
  rect(ctx, 4, 2, 32, 3, '#44534a');
  rect(ctx, 5, 6, 30, 26, '#313b35');
  rect(ctx, 5, 34, 30, 26, '#29322d');
  rect(ctx, 32, 12, 2, 10, '#697d6f');
  rect(ctx, 32, 42, 2, 10, '#697d6f');
  rect(ctx, 9, 11, 5, 5, '#ffc857');
  rect(ctx, 17, 16, 4, 4, '#ff7eb6');
  rect(ctx, 24, 9, 3, 3, '#7cd8ff');
  rect(ctx, 10, 43, 12, 8, '#cfe8d8');
  rect(ctx, 11, 46, 9, 1, '#8fb4a1');
}

function drawPlant(ctx: Ctx): void {
  rect(ctx, 8, 34, 16, 2, 'rgba(0,0,0,.25)');
  rect(ctx, 9, 28, 14, 10, '#3a2a20');
  rect(ctx, 9, 28, 14, 2, '#5a4030');
  rect(ctx, 14, 12, 4, 17, '#2f7d52');
  rect(ctx, 8, 16, 4, 13, '#3b925f');
  rect(ctx, 20, 15, 4, 14, '#3b925f');
  rect(ctx, 11, 9, 4, 10, '#4daa70');
  rect(ctx, 17, 10, 4, 9, '#4daa70');
  rect(ctx, 12, 7, 3, 5, '#63c489');
  rect(ctx, 19, 6, 4, 6, '#2f7d52');
  rect(ctx, 14, 10, 1, 4, '#8fe6b1');
}

function drawTable(ctx: Ctx): void {
  rect(ctx, 4, 54, 120, 4, 'rgba(0,0,0,.22)');
  rect(ctx, 2, 6, 124, 46, '#4a3326');
  rect(ctx, 2, 6, 124, 3, '#6b4a35');
  rect(ctx, 2, 50, 124, 2, '#2b1d16');
  rect(ctx, 8, 52, 6, 11, '#2b1d16');
  rect(ctx, 114, 52, 6, 11, '#2b1d16');
  rect(ctx, 16, 14, 26, 18, '#cfe8d8');
  rect(ctx, 18, 17, 22, 1, '#8fb4a1');
  rect(ctx, 18, 20, 16, 1, '#8fb4a1');
  rect(ctx, 18, 23, 19, 1, '#8fb4a1');
  rect(ctx, 52, 12, 18, 22, '#23352d');
  rect(ctx, 54, 14, 14, 16, '#10211b');
  rect(ctx, 56, 16, 8, 1, '#7bffb2');
  rect(ctx, 56, 19, 10, 1, '#4f9e77');
  rect(ctx, 84, 16, 7, 7, '#ffc857');
  rect(ctx, 85, 18, 5, 1, '#6b4a35');
  rect(ctx, 85, 20, 4, 1, '#6b4a35');
  rect(ctx, 98, 14, 6, 6, '#7ee8c4');
  rect(ctx, 100, 12, 3, 2, '#d8fff1');
  rect(ctx, 34, 38, 20, 10, '#7bffb2');
  rect(ctx, 36, 41, 11, 1, '#0d2b1f');
  rect(ctx, 36, 43, 14, 1, '#0d2b1f');
}

function drawWhiteboard(ctx: Ctx): void {
  rect(ctx, 2, 2, 92, 24, '#d8e8df');
  rect(ctx, 2, 2, 92, 2, '#f4fff9');
  rect(ctx, 4, 5, 30, 1, '#4d7461');
  rect(ctx, 4, 8, 44, 1, '#7da58f');
  rect(ctx, 4, 11, 36, 1, '#7da58f');
  rect(ctx, 4, 15, 20, 1, '#4d7461');
  rect(ctx, 56, 6, 20, 12, '#ffc857');
  rect(ctx, 58, 9, 16, 1, '#6b4a35');
  rect(ctx, 58, 12, 12, 1, '#6b4a35');
  rect(ctx, 82, 8, 8, 8, '#ff7eb6');
  rect(ctx, 84, 10, 4, 1, '#4a1f32');
  rect(ctx, 84, 12, 3, 1, '#4a1f32');
}

function drawSofa(ctx: Ctx): void {
  rect(ctx, 4, 28, 56, 4, 'rgba(0,0,0,.22)');
  rect(ctx, 2, 8, 60, 22, '#24473a');
  rect(ctx, 2, 8, 60, 4, '#356451');
  rect(ctx, 4, 12, 26, 14, '#2d5747');
  rect(ctx, 32, 12, 26, 14, '#2d5747');
  rect(ctx, 29, 12, 4, 14, '#1a342a');
  rect(ctx, 8, 30, 4, 2, '#131d18');
  rect(ctx, 52, 30, 4, 2, '#131d18');
  rect(ctx, 8, 14, 10, 5, '#ffc857');
  rect(ctx, 20, 16, 8, 5, '#7ee8c4');
}

function drawPrinter(ctx: Ctx): void {
  rect(ctx, 4, 32, 40, 3, 'rgba(0,0,0,.2)');
  rect(ctx, 4, 8, 40, 24, '#303b36');
  rect(ctx, 4, 8, 40, 3, '#4a5850');
  rect(ctx, 8, 2, 24, 8, '#d8e8df');
  rect(ctx, 9, 3, 22, 1, '#8fb4a1');
  rect(ctx, 10, 12, 28, 10, '#1a2420');
  rect(ctx, 12, 14, 10, 1, '#7bffb2');
  rect(ctx, 12, 17, 18, 1, '#4f9e77');
  rect(ctx, 34, 26, 2, 2, '#7bffb2');
  rect(ctx, 8, 30, 32, 2, '#0b1110');
}

function drawBox(ctx: Ctx): void {
  rect(ctx, 4, 20, 20, 2, 'rgba(0,0,0,.2)');
  rect(ctx, 2, 6, 24, 16, '#5a4027');
  rect(ctx, 2, 6, 24, 2, '#7a5838');
  rect(ctx, 12, 6, 4, 16, '#c9a26b');
  rect(ctx, 5, 10, 5, 4, '#d8e8df');
  rect(ctx, 6, 11, 3, 1, '#8fb4a1');
  rect(ctx, 18, 16, 4, 3, '#3a2a20');
}

function drawMat(ctx: Ctx): void {
  rect(ctx, 0, 0, 40, 16, '#1c2c24');
  rect(ctx, 1, 1, 38, 14, '#23382c');
  rect(ctx, 5, 4, 30, 1, '#3f6a50');
  rect(ctx, 5, 8, 30, 1, '#3f6a50');
  rect(ctx, 5, 12, 30, 1, '#3f6a50');
}

function drawPoster(ctx: Ctx): void {
  rect(ctx, 1, 1, 22, 30, '#132019');
  rect(ctx, 2, 2, 20, 28, '#0c1711');
  rect(ctx, 3, 3, 18, 26, '#1d3b2b');
  ctx.fillStyle = '#7bffb2';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('1024', 4, 18);
  ctx.fillStyle = '#ffc857';
  ctx.font = '4px monospace';
  ctx.fillText('NIGHT', 6, 24);
  rect(ctx, 5, 26, 14, 1, '#4f9e77');
}

function drawConsole(ctx: Ctx): void {
  rect(ctx, 4, 28, 32, 2, 'rgba(0,0,0,.22)');
  rect(ctx, 4, 8, 32, 20, '#1a2420');
  rect(ctx, 4, 8, 32, 2, '#33473c');
  rect(ctx, 7, 11, 26, 12, '#10211b');
  rect(ctx, 9, 13, 8, 1, '#7bffb2');
  rect(ctx, 9, 16, 14, 1, '#4f9e77');
  rect(ctx, 9, 19, 6, 1, '#ffc857');
  rect(ctx, 9, 24, 4, 4, '#ff6b6b');
  rect(ctx, 16, 24, 4, 4, '#7bffb2');
  rect(ctx, 10, 28, 20, 1, '#0b1110');
}

function drawWindow(ctx: Ctx): void {
  rect(ctx, 2, 2, 60, 44, '#1a2a22');
  rect(ctx, 4, 4, 56, 40, '#0a1826');
  for (let i = 0; i < 7; i++) {
    rect(ctx, 8 + i * 7, 7 + (i % 3) * 9, 2, 2, i % 2 ? '#7cd8ff' : '#dcffea');
  }
  rect(ctx, 42, 9, 9, 9, '#cfe8d8');
  rect(ctx, 44, 9, 5, 2, '#0a1826');
  rect(ctx, 4, 32, 56, 12, '#102134');
  rect(ctx, 4, 40, 56, 4, '#2a2a20');
  rect(ctx, 4, 4, 56, 1, '#2e4a3a');
  rect(ctx, 33, 4, 1, 40, '#1a2a22');
  rect(ctx, 4, 24, 56, 1, '#1a2a22');
}

function drawCup(ctx: Ctx): void {
  rect(ctx, 3, 4, 6, 7, '#d8e8df');
  rect(ctx, 4, 2, 4, 2, '#6b3f25');
  rect(ctx, 9, 5, 2, 2, '#b9cfc3');
  rect(ctx, 2, 11, 8, 1, '#8fb4a1');
  rect(ctx, 5, 0, 1, 1, 'rgba(220,255,234,.3)');
}

function drawNet(ctx: Ctx): void {
  ctx.strokeStyle = '#7bffb2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(26, 14, 13, 10, -0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(123,255,178,.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(17, 10);
  ctx.lineTo(33, 17);
  ctx.moveTo(19, 19);
  ctx.lineTo(33, 9);
  ctx.moveTo(20, 5);
  ctx.lineTo(24, 24);
  ctx.moveTo(30, 5);
  ctx.lineTo(28, 24);
  ctx.stroke();
  ctx.strokeStyle = '#ffc857';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, 20);
  ctx.lineTo(40, 36);
  ctx.stroke();
  rect(ctx, 38, 34, 3, 5, '#8a5433');
}

function drawShadow(ctx: Ctx): void {
  const g = ctx.createRadialGradient(16, 8, 1, 16, 8, 14);
  g.addColorStop(0, 'rgba(0,0,0,.5)');
  g.addColorStop(0.6, 'rgba(0,0,0,.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 16);
}

function drawGlow(ctx: Ctx): void {
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,.35)');
  g.addColorStop(0.72, 'rgba(255,255,255,.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
}

function drawSteam(ctx: Ctx): void {
  const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
  g.addColorStop(0, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 8);
}

function drawBugTexture(ctx: Ctx, sprite: string[], color: string, frame: number): void {
  ctx.clearRect(0, 0, 12, 12);
  const yOff = frame === 0 ? 0 : frame === 1 ? 1 : 2;
  for (let y = 0; y < sprite.length; y++) {
    const row = sprite[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const py = y - yOff;
      if (py < 0 || py >= 12) continue;
      let fill = color;
      if (ch === 'o') fill = '#f4fff9';
      else if (ch === 'x') fill = frame === 2 ? '#f4fff9' : '#06110b';
      else if (ch === '%') fill = lighten(color, 0.38);
      rect(ctx, x, py, 1, 1, fill);
    }
  }
}

export function createTextures(scene: Phaser.Scene): void {
  addCanvas(scene, 'tiles', 8 * 32, 32, drawTiles);

  for (const dir of ['down', 'up', 'side'] as const) {
    for (let frame = 0; frame < 4; frame++) {
      addCanvas(scene, `player-${dir}-idle-${frame}`, 16, 24, (ctx) => drawPlayer(ctx, dir, 'idle', frame));
      addCanvas(scene, `player-${dir}-walk-${frame}`, 16, 24, (ctx) => drawPlayer(ctx, dir, 'walk', frame));
    }
    for (let frame = 0; frame < 3; frame++) {
      addCanvas(scene, `player-${dir}-net-${frame}`, 16, 24, (ctx) => drawPlayer(ctx, dir, 'net', frame));
    }
  }

  for (const bug of BUGS) {
    const sprite = SPRITES[bug.sprite];
    for (let frame = 0; frame < 3; frame++) {
      addCanvas(scene, `bug-${bug.id}-${frame}`, 12, 12, (ctx) => drawBugTexture(ctx, sprite, bug.color, frame));
    }
  }

  addCanvas(scene, 'desk', 64, 36, drawDesk);
  addCanvas(scene, 'monitor', 32, 24, drawMonitor);
  addCanvas(scene, 'chair', 24, 24, drawChair);
  addCanvas(scene, 'server', 48, 64, drawServer);
  addCanvas(scene, 'coffee', 32, 48, drawCoffee);
  addCanvas(scene, 'fridge', 40, 64, drawFridge);
  addCanvas(scene, 'plant', 32, 40, drawPlant);
  addCanvas(scene, 'table', 128, 64, drawTable);
  addCanvas(scene, 'whiteboard', 96, 28, drawWhiteboard);
  addCanvas(scene, 'sofa', 64, 32, drawSofa);
  addCanvas(scene, 'printer', 48, 36, drawPrinter);
  addCanvas(scene, 'box', 28, 24, drawBox);
  addCanvas(scene, 'mat', 40, 16, drawMat);
  addCanvas(scene, 'poster', 24, 32, drawPoster);
  addCanvas(scene, 'console', 40, 30, drawConsole);
  addCanvas(scene, 'window', 64, 48, drawWindow);
  addCanvas(scene, 'cup', 12, 12, drawCup);
  addCanvas(scene, 'net', 42, 40, drawNet);
  addCanvas(scene, 'shadow', 32, 16, drawShadow);
  addCanvas(scene, 'glow', 128, 128, drawGlow);
  addCanvas(scene, 'steam', 8, 8, drawSteam);
  addCanvas(scene, 'spark', 4, 4, (ctx) => rect(ctx, 0, 0, 4, 4, '#ffffff'));
}
