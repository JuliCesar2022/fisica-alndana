import Phaser from 'phaser';
import { store } from '../store/store';
import { updatePhysicsData } from '../store/freeFallSlice';
import { EVENT_RESET_FREEFALL } from '../components/panels/FreeFallPanel';

const PLANET_THEMES = {
  earth: {
    bg: 0xbae6fd,       // Sky blue
    gridLine: 0x7dd3fc, // Lighter blue grid
    gridAlpha: 0.12,    // Soft faint grid
    ground: 0x22c55e,   // Lush green grass
    groundLine: 0x15803d,
    ball: 0xf8fafc,
    trail: 0x3b82f6,
    ruler: 0x475569,
  },
  moon: {
    bg: 0x090d16,       // Space black
    gridLine: 0x1e293b,
    gridAlpha: 0.08,
    ground: 0x475569,   // Lunar gray
    groundLine: 0x334155,
    ball: 0xe2e8f0,
    trail: 0x94a3b8,
    ruler: 0x64748b,
  },
  mars: {
    bg: 0x451a03,       // Dusty orange
    gridLine: 0x78350f,
    gridAlpha: 0.08,
    ground: 0x9a3412,   // Iron oxide dark red
    groundLine: 0x7c2d12,
    ball: 0xfef08a,
    trail: 0xea580c,
    ruler: 0xa8a29e,
  },
  jupiter: {
    bg: 0x1e1b4b,       // Stormy violet
    gridLine: 0x312e81,
    gridAlpha: 0.06,
    ground: 0xb45309,   // Swirling amber ground
    groundLine: 0x92400e,
    ball: 0xf8fafc,
    trail: 0xf59e0b,
    ruler: 0x94a3b8,
  },
  custom: {
    bg: 0x0a0e17,       // Standard terminal
    gridLine: 0x1e293b,
    gridAlpha: 0.08,
    ground: 0x1e293b,
    groundLine: 0x334155,
    ball: 0xe2e8f0,
    trail: 0x3b82f6,
    ruler: 0x64748b,
  }
};

export class FreeFallScene extends Phaser.Scene {
  private groundY!: number;
  private ball!: Phaser.GameObjects.Arc;
  private trailGfx!: Phaser.GameObjects.Graphics;
  private rulerGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private starsGfx!: Phaser.GameObjects.Graphics;
  
  private unsubscribeStore!: () => void;
  
  private isPlaying: boolean = false;
  private simTime: number = 0;
  private startHeight: number = 100;
  private gravity: number = 9.81;
  private mass: number = 2.0;
  private currentPlanet: 'earth' | 'moon' | 'mars' | 'jupiter' | 'custom' = 'earth';

  // Visual scaling
  private pixelsPerMeter: number = 10;
  private startY: number = 0;

  private trail: {x: number, y: number}[] = [];

  constructor() {
    super({ key: 'FreeFallScene' });
  }

  create() {
    this.bgGfx = this.add.graphics({ x: 0, y: 0 });
    this.starsGfx = this.add.graphics({ x: 0, y: 0 });
    this.trailGfx = this.add.graphics({ x: 0, y: 0 });
    this.rulerGfx = this.add.graphics({ x: 0, y: 0 });
    this.ball = this.add.circle(0, 0, 15, 0xffffff);
    this.ball.setStrokeStyle(2, 0xffffff);

    // Make the ball draggable
    this.ball.setInteractive({ draggable: true, useHandCursor: true });

    this.input.on('dragstart', () => {
      if (this.isPlaying) {
        store.dispatch({ type: 'freefall/setPlaying', payload: false });
      }
    });

    this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Arc, dragX: number, dragY: number) => {
      if (gameObject === this.ball) {
        const clampedY = Phaser.Math.Clamp(dragY, this.startY, this.groundY);
        const pixelOffset = clampedY - this.startY;
        
        // The ruler max is always 500m
        const maxRulerHeight = 500;
        const physicalHeight = maxRulerHeight - (pixelOffset / this.pixelsPerMeter);
        
        const finalHeight = Phaser.Math.Clamp(Math.round(physicalHeight), 10, 500);
        store.dispatch({ type: 'freefall/setHeight', payload: finalHeight });
        
        // Instantly reset time and trail to redraw cleanly
        this.simTime = 0;
        this.trail = [];
        this.trailGfx.clear();
        this.updateBallPosition();
        this.dispatchPhysicsData();
      }
    });

    this.onResize();
    this.scale.on('resize', this.onResize, this);

    this.unsubscribeStore = store.subscribe(this.handleStoreUpdate.bind(this));
    window.addEventListener(EVENT_RESET_FREEFALL, this.resetSimulation.bind(this));

    this.syncWithStore();
    this.drawRuler();
    this.resetSimulation();
  }

  private onResize() {
    const { height } = this.cameras.main;
    this.groundY = height - 100;
    
    this.drawBackground();
    this.drawRuler();
    this.updateBallPosition();
  }

  private drawBackground() {
    if (!this.bgGfx || !this.cameras.main) return;
    const { width, height } = this.cameras.main;
    const theme = PLANET_THEMES[this.currentPlanet];
    
    // Set camera background
    this.cameras.main.setBackgroundColor(theme.bg);
    
    // Clear and redraw bgGfx
    this.bgGfx.clear();
    
    // Draw grid
    this.bgGfx.lineStyle(1, theme.gridLine, theme.gridAlpha);
    for (let x = 0; x < width; x += 40) {
      this.bgGfx.moveTo(x, 0);
      this.bgGfx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 40) {
      this.bgGfx.moveTo(0, y);
      this.bgGfx.lineTo(width, y);
    }
    this.bgGfx.strokePath();

    // Draw stars for Moon!
    this.starsGfx.clear();
    if (this.currentPlanet === 'moon') {
      this.starsGfx.fillStyle(0xffffff, 0.8);
      for (let i = 0; i < 60; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * this.groundY;
        const size = Math.random() * 1.5 + 0.5;
        this.starsGfx.fillCircle(sx, sy, size);
      }
    }

    // Draw ground
    this.bgGfx.fillStyle(theme.ground, 0.9);
    this.bgGfx.fillRect(0, this.groundY, width, height - this.groundY);
    this.bgGfx.lineStyle(2, theme.groundLine, 1);
    this.bgGfx.moveTo(0, this.groundY);
    this.bgGfx.lineTo(width, this.groundY);
    this.bgGfx.strokePath();

    // Update ball color
    this.ball.setFillStyle(theme.ball, 1);
    
    // Force trail redraw with new color
    this.drawTrail();
  }

  private syncWithStore() {
    const state = store.getState().freefall;
    let changed = false;
    
    if (this.startHeight !== state.height) { this.startHeight = state.height; changed = true; }
    if (this.gravity !== state.gravity) { this.gravity = state.gravity; changed = true; }
    if (this.mass !== state.mass) { this.mass = state.mass; changed = true; }
    
    if (this.currentPlanet !== state.planet) {
      this.currentPlanet = state.planet;
      this.drawBackground();
      changed = true;
    }

    if (changed) {
      this.drawRuler();
      if (!this.isPlaying) this.resetSimulation();
    }

    if (this.isPlaying !== state.isPlaying) {
      this.isPlaying = state.isPlaying;
    }
  }

  private handleStoreUpdate() {
    this.syncWithStore();
  }

  private resetSimulation = () => {
    this.simTime = 0;
    this.trail = [];
    this.trailGfx.clear();
    this.updateBallPosition();
    this.dispatchPhysicsData();
  };

  private drawRuler() {
    if (!this.rulerGfx || !this.cameras.main) return;
    this.rulerGfx.clear();
    
    const { width, height } = this.cameras.main;
    const theme = PLANET_THEMES[this.currentPlanet];
    const colorHex = '#' + theme.ruler.toString(16).padStart(6, '0');
    
    // Scale: the ruler always represents 500m (the absolute max height)
    const maxRulerHeight = 500;
    const availablePixels = this.groundY - 50;
    this.pixelsPerMeter = availablePixels / maxRulerHeight;
    this.startY = 50;

    const rulerX = width / 2 - 100;
    
    this.rulerGfx.lineStyle(2, theme.ruler, 0.5);
    this.rulerGfx.moveTo(rulerX, this.startY);
    this.rulerGfx.lineTo(rulerX, this.groundY);
    this.rulerGfx.strokePath();

    // Destroy old texts
    this.children.list.filter(c => c.name === 'rulerLabel').forEach(c => c.destroy());

    // Ticks every 50m
    const numTicks = 10;
    for (let i = 0; i <= numTicks; i++) {
      const h = maxRulerHeight - (maxRulerHeight / numTicks) * i;
      const y = this.startY + (maxRulerHeight - h) * this.pixelsPerMeter;
      
      this.rulerGfx.moveTo(rulerX - 10, y);
      this.rulerGfx.lineTo(rulerX, y);
      this.rulerGfx.strokePath();
      
      // Draw tick numbers
      this.add.text(rulerX - 15, y, `${h.toFixed(0)}m`, {
        fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: colorHex
      }).setOrigin(1, 0.5).setName('rulerLabel');
    }
  }

  private updateBallPosition() {
    const { width } = this.cameras.main;
    const currentY = this.startHeight - 0.5 * this.gravity * (this.simTime * this.simTime);
    
    // Prevent going below ground
    const yPos = Math.max(0, currentY);
    
    // Ruler max is 500m
    const pixelY = this.startY + (500 - yPos) * this.pixelsPerMeter;
    this.ball.setPosition(width / 2, pixelY);
  }

  private dispatchPhysicsData() {
    const currentY = Math.max(0, this.startHeight - 0.5 * this.gravity * (this.simTime * this.simTime));
    let velocity = this.gravity * this.simTime;
    
    if (currentY <= 0) {
      velocity = Math.sqrt(2 * this.gravity * this.startHeight);
    }

    const pe = this.mass * this.gravity * currentY;
    const ke = 0.5 * this.mass * velocity * velocity;

    store.dispatch(updatePhysicsData({
      time: this.simTime,
      y: currentY,
      velocity: velocity,
      potentialEnergy: pe,
      kineticEnergy: ke,
      totalEnergy: pe + ke
    }));
  }

  update(time: number, delta: number) {
    if (!this.isPlaying) return;

    const dt = delta / 1000;
    this.simTime += dt;

    const currentY = this.startHeight - 0.5 * this.gravity * (this.simTime * this.simTime);
    
    if (currentY <= 0) {
      // Hit ground
      this.simTime = Math.sqrt((2 * this.startHeight) / this.gravity);
      this.isPlaying = false;
      store.dispatch({ type: 'freefall/setPlaying', payload: false });
    }

    this.updateBallPosition();
    this.dispatchPhysicsData();

    // Trail
    if (this.trail.length === 0 || this.simTime - this.trail[this.trail.length - 1].x > 0.05) {
      this.trail.push({ x: this.simTime, y: this.ball.y });
      this.drawTrail();
    }
  }

  private drawTrail() {
    this.trailGfx.clear();
    const theme = PLANET_THEMES[this.currentPlanet];
    this.trailGfx.fillStyle(theme.trail, 0.4);
    for (let i = 0; i < this.trail.length; i++) {
      const size = Math.max(2, 6 - (this.trail.length - i) * 0.1);
      this.trailGfx.fillCircle(this.cameras.main.width / 2, this.trail[i].y, size);
    }
  }

  destroy() {
    if (this.unsubscribeStore) this.unsubscribeStore();
    window.removeEventListener(EVENT_RESET_FREEFALL, this.resetSimulation);
    this.scale.off('resize', this.onResize, this);
  }
}
