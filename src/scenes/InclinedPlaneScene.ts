import Phaser from 'phaser';
import { COLORS, MATERIALS, SCALE } from '../utils/constants';
import { ForceCalculator, SimState } from '../physics/ForceCalculator';
import { EnergyTracker } from '../physics/EnergyTracker';
import { VectorRenderer } from '../utils/VectorRenderer';
import { store } from '../store/store';
import { updatePhysicsData, setPlaying } from '../store/rampSlice';
import { EVENT_RESET_RAMP } from '../components/panels/RampPanel';

export class InclinedPlaneScene extends Phaser.Scene {
  private forceCalc!: ForceCalculator;
  private energyTracker!: EnergyTracker;
  private vectorRenderer!: VectorRenderer;

  private sceneGfx!: Phaser.GameObjects.Graphics;
  private ballGfx!: Phaser.GameObjects.Graphics;
  private trailGfx!: Phaser.GameObjects.Graphics;

  private isPlaying: boolean = false;
  private simState!: SimState;
  private trail: { x: number; y: number }[] = [];

  private rampStartX: number = 0;
  private rampStartY: number = 0;
  private rampEndX: number = 0;
  private rampEndY: number = 0;
  private rampLength: number = 5;
  private groundY: number = 0;

  private currentAngle: number = 30;
  private currentMass: number = 2;
  private currentGravity: number = 9.81;
  private currentMaterial: string = 'wood';
  private currentCustomFriction: number = 0.25;

  private unsubscribeStore!: () => void;

  constructor() {
    super({ key: 'InclinedPlaneScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.sceneGfx = this.add.graphics().setDepth(1);
    this.trailGfx = this.add.graphics().setDepth(5);
    this.ballGfx = this.add.graphics().setDepth(10);

    this.groundY = height * 0.75;
    
    // Sync initial state from Redux
    const state = store.getState().ramp;
    this.currentAngle = state.angle;
    this.currentMass = state.mass;
    this.currentGravity = state.gravity;
    this.currentMaterial = state.material;
    this.currentCustomFriction = state.customFriction;
    this.isPlaying = state.isPlaying;

    this.calculateRampGeometry(width, height);

    this.forceCalc = new ForceCalculator(
      this.currentMass,
      this.currentAngle,
      this.currentGravity,
      this.currentMaterial,
      this.rampLength,
      this.currentCustomFriction
    );
    this.energyTracker = new EnergyTracker();
    this.vectorRenderer = new VectorRenderer(this);

    this.drawScene();
    this.drawBallAtStart();
    this.updateRedux();
    this.updateForceVectors();

    // Subscribe to Redux store
    this.unsubscribeStore = store.subscribe(() => {
      const state = store.getState().ramp;
      let changed = false;
      if (
        state.angle !== this.currentAngle || 
        state.mass !== this.currentMass || 
        state.gravity !== this.currentGravity || 
        state.material !== this.currentMaterial ||
        state.customFriction !== this.currentCustomFriction
      ) {
        this.currentAngle = state.angle;
        this.currentMass = state.mass;
        this.currentGravity = state.gravity;
        this.currentMaterial = state.material;
        this.currentCustomFriction = state.customFriction;
        changed = true;
      }
      
      if (changed) {
        this.onControlsChanged();
      }

      if (state.isPlaying !== this.isPlaying) {
        this.isPlaying = state.isPlaying;
      }
    });

    const handleReset = () => {
      this.isPlaying = false;
      this.forceCalc.reset();
      this.trail = [];
      this.trailGfx.clear();
      this.drawBallAtStart();
      this.updateRedux();
      this.updateForceVectors();
    };
    window.addEventListener(EVENT_RESET_RAMP, handleReset);

    this.events.once('shutdown', () => {
      window.removeEventListener(EVENT_RESET_RAMP, handleReset);
      this.cleanup();
    }, this);
  }

  private calculateRampGeometry(width: number, height: number) {
    const angleRad = (this.currentAngle * Math.PI) / 180;
    const rampPixelLength = this.rampLength * SCALE;

    this.rampEndX = width * 0.35;
    this.rampEndY = this.groundY;
    this.rampStartX = this.rampEndX + rampPixelLength * Math.cos(angleRad);
    this.rampStartY = this.rampEndY - rampPixelLength * Math.sin(angleRad);
  }

  private drawScene() {
    this.sceneGfx.clear();
    const { width, height } = this.cameras.main;

    this.sceneGfx.lineStyle(1, COLORS.gridLine, 0.3);
    for (let x = 0; x < width; x += 40) {
      this.sceneGfx.moveTo(x, 0);
      this.sceneGfx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 40) {
      this.sceneGfx.moveTo(0, y);
      this.sceneGfx.lineTo(width, y);
    }
    this.sceneGfx.strokePath();

    this.sceneGfx.fillStyle(COLORS.ground, 0.8);
    this.sceneGfx.fillRect(0, this.groundY, width, height - this.groundY);
    this.sceneGfx.lineStyle(2, 0x334155, 1);
    this.sceneGfx.moveTo(0, this.groundY);
    this.sceneGfx.lineTo(width, this.groundY);
    this.sceneGfx.strokePath();

    const mat = this.currentMaterial === 'custom' ? {
      name: store.getState().ramp.customMaterialName || 'Personalizado',
      color: 0xec4899,
      colorHex: '#ec4899'
    } : MATERIALS[this.currentMaterial];
    this.sceneGfx.fillStyle(mat.color, 0.4);
    this.sceneGfx.beginPath();
    this.sceneGfx.moveTo(this.rampEndX, this.rampEndY);
    this.sceneGfx.lineTo(this.rampStartX, this.rampStartY);
    this.sceneGfx.lineTo(this.rampStartX, this.rampEndY);
    this.sceneGfx.closePath();
    this.sceneGfx.fillPath();

    this.sceneGfx.lineStyle(8, mat.color, 0.8);
    this.sceneGfx.beginPath();
    this.sceneGfx.moveTo(this.rampEndX, this.rampEndY);
    this.sceneGfx.lineTo(this.rampStartX, this.rampStartY);
    this.sceneGfx.strokePath();

    const arcRadius = 40;
    const endAngle = -this.currentAngle * (Math.PI / 180);
    this.sceneGfx.lineStyle(2, 0xf59e0b, 0.7);
    this.sceneGfx.beginPath();
    this.sceneGfx.arc(this.rampStartX, this.rampEndY, arcRadius, Math.PI, Math.PI + endAngle, true);
    this.sceneGfx.strokePath();

    // Labels are recreated
    this.children.list.filter(c => c.name === 'angleLabel' || c.name === 'heightLabel' || c.name === 'materialLabel').forEach(c => c.destroy());

    const labelAngle = Math.PI + endAngle / 2;
    const labelX = this.rampStartX + (arcRadius + 16) * Math.cos(labelAngle);
    const labelY = this.rampEndY + (arcRadius + 16) * Math.sin(labelAngle);
    this.add.text(labelX, labelY, `θ = ${this.currentAngle}°`, {
      fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontStyle: 'bold', color: '#f59e0b', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setName('angleLabel');

    const heightM = this.rampLength * Math.sin(this.currentAngle * Math.PI / 180);
    this.sceneGfx.lineStyle(1, 0x94a3b8, 0.4);
    let hy = this.rampStartY;
    const hx = this.rampStartX - 20;
    while (hy < this.rampEndY) {
      const endY = Math.min(hy + 5, this.rampEndY);
      this.sceneGfx.beginPath();
      this.sceneGfx.moveTo(hx, hy);
      this.sceneGfx.lineTo(hx, endY);
      this.sceneGfx.strokePath();
      hy = endY + 5;
    }

    this.add.text(hx - 15, (this.rampStartY + this.rampEndY) / 2, `h=${heightM.toFixed(1)}m`, {
      fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#94a3b8', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20).setAngle(-90).setName('heightLabel');
  }

  private getBallPositionOnRamp(distAlongRamp: number): { x: number; y: number } {
    const angleRad = (this.currentAngle * Math.PI) / 180;
    const pixelDist = distAlongRamp * SCALE;
    const x = this.rampStartX - pixelDist * Math.cos(angleRad);
    const y = this.rampStartY + pixelDist * Math.sin(angleRad);
    const ballRadius = 12;
    const normalX = Math.sin(angleRad) * ballRadius;
    const normalY = Math.cos(angleRad) * ballRadius;
    return { x: x - normalX, y: y - normalY };
  }

  private getBallPositionOnGround(groundX: number): { x: number; y: number } {
    return { x: this.rampEndX - groundX * SCALE, y: this.groundY - 12 };
  }

  private drawBallAtStart() {
    const pos = this.getBallPositionOnRamp(0);
    this.drawBall(pos.x, pos.y);
  }

  private drawBall(x: number, y: number) {
    this.ballGfx.clear();
    const radius = 12;
    this.ballGfx.fillStyle(COLORS.ballGlow, 0.15);
    this.ballGfx.fillCircle(x, y, radius + 8);
    this.ballGfx.fillStyle(0x000000, 0.3);
    this.ballGfx.fillEllipse(x + 3, y + radius + 4, radius * 1.5, 4);
    this.ballGfx.fillStyle(COLORS.ball, 1);
    this.ballGfx.fillCircle(x, y, radius);
    this.ballGfx.fillStyle(0xffffff, 0.3);
    this.ballGfx.fillCircle(x - 3, y - 3, radius * 0.4);
  }

  private drawTrail() {
    this.trailGfx.clear();
    for (let i = 1; i < this.trail.length; i++) {
      const alpha = (i / this.trail.length) * 0.4;
      const size = (i / this.trail.length) * 3;
      this.trailGfx.fillStyle(COLORS.ballGlow, alpha);
      this.trailGfx.fillCircle(this.trail[i].x, this.trail[i].y, size);
    }
  }

  private onControlsChanged() {
    this.calculateRampGeometry(this.cameras.main.width, this.cameras.main.height);
    this.forceCalc.updateParams(
      this.currentMass,
      this.currentAngle,
      this.currentGravity,
      this.currentMaterial,
      this.rampLength,
      this.currentCustomFriction
    );
    this.drawScene();

    if (!this.isPlaying) {
      this.forceCalc.reset();
      this.trail = [];
      this.trailGfx.clear();
      this.drawBallAtStart();
    }
    this.updateRedux();
    this.updateForceVectors();
  }

  private updateRedux() {
    const forces = this.forceCalc.getForces();
    const state = this.forceCalc.getState();
    store.dispatch(updatePhysicsData({ forces, state }));
  }

  private updateForceVectors() {
    const state = this.forceCalc.getState();
    const forces = this.forceCalc.getForces();

    let ballPos = state.onRamp ? this.getBallPositionOnRamp(state.position) : this.getBallPositionOnGround(state.position);

    if (state.onRamp) {
      this.vectorRenderer.drawForceVectors(
        ballPos.x, ballPos.y,
        this.forceCalc.getAngleRad(),
        forces.weight, forces.normalForce, forces.parallelForce, forces.frictionForce, forces.netForce
      );
    } else {
      this.vectorRenderer.clear();
    }
  }

  private performSimStep(dt: number) {
    const state = this.forceCalc.step(dt);
    this.simState = state;

    let ballPos = state.onRamp ? this.getBallPositionOnRamp(state.position) : this.getBallPositionOnGround(state.position);

    this.trail.push({ x: ballPos.x, y: ballPos.y });
    if (this.trail.length > 100) this.trail.shift();
    this.drawTrail();
    this.drawBall(ballPos.x, ballPos.y);

    this.updateForceVectors();
    this.updateRedux();

    if (state.finished) {
      this.isPlaying = false;
      store.dispatch(setPlaying(false));
    }
  }

  update(time: number, delta: number) {
    if (this.isPlaying) {
      const dt = Math.min(delta / 1000, 1 / 30);
      this.performSimStep(dt);
    }
  }

  private cleanup() {
    if (this.unsubscribeStore) this.unsubscribeStore();
    this.vectorRenderer.destroy();
    this.isPlaying = false;
    this.trail = [];
    store.dispatch(setPlaying(false));
  }
}
