import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // No external assets needed — we draw everything with graphics
  }

  create() {
    const hash = window.location.hash.replace('#', '');
    
    const sceneMap: Record<string, string> = {
      menu: 'MenuScene',
      ramp: 'InclinedPlaneScene',
      electrostatics: 'ElectrostaticsScene',
    };

    const targetScene = sceneMap[hash] || 'MenuScene';
    this.scene.start(targetScene);
  }
}
