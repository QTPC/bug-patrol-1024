import Phaser from 'phaser';
import './style.css';
import { OfficeScene } from './game/OfficeScene';
import { GameUI } from './ui/GameUI';
import { ProgressStore } from './state/ProgressStore';

const store = new ProgressStore();
const ui = new GameUI();
const scene = new OfficeScene(store, ui);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 960,
  height: 540,
  backgroundColor: '#050b08',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540,
  },
  scene: [scene],
});

(window as unknown as { __game: Phaser.Game }).__game = game;
