import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { InclinedPlaneScene } from './scenes/InclinedPlaneScene';

import { ElectrostaticsScene } from './scenes/ElectrostaticsScene';
import { CircuitScene } from './scenes/CircuitScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#0a0e17',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, InclinedPlaneScene, ElectrostaticsScene, CircuitScene],
  dom: {
    createContainer: true
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
};
