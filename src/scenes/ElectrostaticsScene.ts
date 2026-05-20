import Phaser from 'phaser';
import { COLORS } from '../utils/constants';
import { ElectrostaticsCalculator, PointCharge } from '../physics/ElectrostaticsCalculator';
import { store } from '../store/store';
import { syncChargesFromEngine, updateNetForce, setPlaying } from '../store/electroSlice';
import { EVENT_ADD_CHARGE, EVENT_RESET_ELECTRO } from '../components/panels/MiroLeftPanel';

interface ChargeBody {
  id: string;
  charge: number;
  body: Phaser.Physics.Matter.Image | Phaser.Physics.Matter.Sprite;
  gfx: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
}

export class ElectrostaticsScene extends Phaser.Scene {
  private calculator!: ElectrostaticsCalculator;
  private sceneGfx!: Phaser.GameObjects.Graphics;
  
  private charges: ChargeBody[] = [];
  private selectedChargeId: string | null = null;
  private isPlaying: boolean = false;
  
  private nextId = 1;
  private unsubscribeStore!: () => void;

  constructor() {
    super({ key: 'ElectrostaticsScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.sceneGfx = this.add.graphics().setDepth(1);
    this.drawGrid(width, height);

    this.calculator = new ElectrostaticsCalculator();
    const headerHeight = 52;
    this.matter.world.setBounds(0, headerHeight, width, height - headerHeight, 50, true, true, true, true);

    const state = store.getState().electrostatics;
    this.isPlaying = state.isPlaying;

    this.addCharge(5, width/2, height/2, true);
    this.addCharge(-5, width/2 + 200, height/2, false);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: any[]) => {
      if (currentlyOver.length === 0) {
        this.selectedChargeId = null;
        store.dispatch({ type: 'electrostatics/setSelectedCharge', payload: null });
      }
    });

    this.matter.add.mouseSpring({ length: 0, stiffness: 0.2, damping: 0.1 });

    this.input.mouse?.disableContextMenu();

    const handleAdd = (e: any) => {
      this.addCharge(e.detail, width/2 + Phaser.Math.Between(-50, 50), height/2 + Phaser.Math.Between(-50, 50));
    };
    const handleReset = () => this.resetSimulation();
    
    const handleMove = (e: any) => {
      const { id, x, y } = e.detail;
      const c = this.charges.find(ch => ch.id === id);
      if (c && !this.isPlaying) {
        c.body.setPosition(x, y);
        this.syncChargesToRedux();
      }
    };
    
    const handleToggleStatic = (e: any) => {
      const c = this.charges.find(ch => ch.id === e.detail);
      if (c) {
        c.body.setStatic(!c.body.isStatic());
        if (c.body.isStatic()) c.body.setVelocity(0, 0);
        this.syncChargesToRedux();
      }
    };

    const handleDeleteCharge = (e: any) => {
      const id = e.detail;
      const idx = this.charges.findIndex(ch => ch.id === id);
      if (idx !== -1) {
        const c = this.charges[idx];
        c.body.destroy();
        c.gfx.destroy();
        c.text.destroy();
        this.charges.splice(idx, 1);
        
        if (this.selectedChargeId === id) {
          this.selectedChargeId = null;
          store.dispatch({ type: 'electrostatics/setSelectedCharge', payload: null });
        }
        
        this.syncChargesToRedux();
      }
    };
    
    window.addEventListener(EVENT_ADD_CHARGE, handleAdd);
    window.addEventListener(EVENT_RESET_ELECTRO, handleReset);
    window.addEventListener('evt_move_charge', handleMove);
    window.addEventListener('evt_toggle_static', handleToggleStatic);
    window.addEventListener('evt_delete_charge', handleDeleteCharge);

    // Redux Sub
    let currentVacuumMode = state.vacuumMode;
    this.unsubscribeStore = store.subscribe(() => {
      const state = store.getState().electrostatics;
      this.isPlaying = state.isPlaying;
      
      // Sync charge values if edited from React
      if (state.selectedChargeId !== this.selectedChargeId) {
        this.selectedChargeId = state.selectedChargeId;
      }
      
      state.charges.forEach(sc => {
        const c = this.charges.find(ch => ch.id === sc.id);
        if (c && c.charge !== sc.charge) {
          c.charge = sc.charge;
        }
      });

      // Handle Vacuum Mode changes
      if (state.vacuumMode !== currentVacuumMode) {
        currentVacuumMode = state.vacuumMode;
        const newFrictionAir = currentVacuumMode ? 0 : 0.02;
        this.charges.forEach(c => {
          c.body.setFrictionAir(newFrictionAir);
        });
      }
    });

    this.events.once('shutdown', () => {
      window.removeEventListener(EVENT_ADD_CHARGE, handleAdd);
      window.removeEventListener(EVENT_RESET_ELECTRO, handleReset);
      window.removeEventListener('evt_move_charge', handleMove);
      window.removeEventListener('evt_toggle_static', handleToggleStatic);
      window.removeEventListener('evt_delete_charge', handleDeleteCharge);
      this.cleanup();
    });
  }

  private addCharge(chargeValue: number, x: number, y: number, isStatic: boolean = false) {
    const id = `c_${this.nextId++}`;
    const radius = 25;
    
    const state = store.getState().electrostatics;
    const initialFrictionAir = state.vacuumMode ? 0 : 0.02;

    const body = this.matter.add.gameObject(
      this.add.rectangle(x, y, radius*2, radius*2, 0x000000, 0).setDepth(10),
      { shape: 'circle', radius: radius, restitution: 0.8, friction: 0.05, frictionAir: initialFrictionAir, density: 0.05, isStatic: isStatic }
    ) as Phaser.Physics.Matter.Sprite;
    
    body.setData('id', id);
    body.setInteractive({ useHandCursor: true });

    // Drag events to sync coordinates
    this.input.setDraggable(body);
    body.on('drag', (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.isPlaying) {
        body.setPosition(dragX, dragY);
        this.syncChargesToRedux();
      }
    });

    body.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.selectedChargeId = id;
      store.dispatch({ type: 'electrostatics/setSelectedCharge', payload: id });
      this.syncChargesToRedux();

      if (pointer.rightButtonDown()) {
        const event = pointer.event as any;
        window.dispatchEvent(new CustomEvent('evt_show_charge_context_menu', {
          detail: {
            id,
            x: event.clientX || pointer.x,
            y: event.clientY || pointer.y,
            charge: chargeValue,
            isStatic: body.isStatic()
          }
        }));
      }
    });

    const gfx = this.add.graphics().setDepth(5);
    const sign = chargeValue > 0 ? '+' : (chargeValue < 0 ? '−' : '');
    const text = this.add.text(x, y, sign, { fontFamily: "'Inter', sans-serif", fontSize: '28px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(6);

    this.charges.push({ id, charge: chargeValue, body, gfx, text });
    this.selectedChargeId = id;
    store.dispatch({ type: 'electrostatics/setSelectedCharge', payload: id });
    this.syncChargesToRedux();
  }

  private syncChargesToRedux() {
    const arr = this.charges.map(c => ({ id: c.id, charge: c.charge, isStatic: c.body.isStatic(), x: c.body.x, y: c.body.y, z: 0 }));
    store.dispatch(syncChargesFromEngine(arr));
  }

  private resetSimulation() {
    this.isPlaying = false;
    store.dispatch(setPlaying(false));
    this.charges.forEach(c => { c.body.destroy(); c.gfx.destroy(); c.text.destroy(); });
    this.charges = [];
    this.selectedChargeId = null;
    this.nextId = 1;
    store.dispatch({ type: 'electrostatics/setSelectedCharge', payload: null });
    this.syncChargesToRedux();
    this.sceneGfx.clear();
    this.drawGrid(this.cameras.main.width, this.cameras.main.height);
  }

  private drawGrid(width: number, height: number) {
    this.sceneGfx.lineStyle(1, COLORS.gridLine, 0.3);
    for (let x = 0; x < width; x += 40) { this.sceneGfx.moveTo(x, 0); this.sceneGfx.lineTo(x, height); }
    for (let y = 0; y < height; y += 40) { this.sceneGfx.moveTo(0, y); this.sceneGfx.lineTo(width, y); }
    this.sceneGfx.strokePath();
  }

  private getChargeColor(charge: number): number {
    if (charge > 0) return 0xef4444; 
    if (charge < 0) return 0x3b82f6; 
    return 0x94a3b8; 
  }

  update() {
    this.sceneGfx.clear();
    this.drawGrid(this.cameras.main.width, this.cameras.main.height);

    const allStates: PointCharge[] = this.charges.map(c => ({
      id: c.id, charge: c.charge, x: c.body.x, y: c.body.y, z: 0, isStatic: c.body.isStatic()
    }));

    this.drawSelectionLines();

    let selNetForce = null;

    for (const c of this.charges) {
      const netForce = this.calculator.calculateNetForce({ id: c.id, charge: c.charge, x: c.body.x, y: c.body.y, z: 0, isStatic: c.body.isStatic() }, allStates);

      if (this.isPlaying && !c.body.isStatic()) {
        const matterForceScale = 0.0001; 
        c.body.applyForce(new Phaser.Math.Vector2(netForce.fx * matterForceScale, netForce.fy * matterForceScale));
        
        // Prevent tunneling/disappearing by capping the maximum velocity
        const maxVelocity = 30;
        const vel = new Phaser.Math.Vector2(c.body.body.velocity.x, c.body.body.velocity.y);
        if (vel.lengthSq() > maxVelocity * maxVelocity) {
          vel.normalize().scale(maxVelocity);
          c.body.setVelocity(vel.x, vel.y);
        }
      }

      this.updateChargeVisuals(c, c.id === this.selectedChargeId);
      
      if (c.id === this.selectedChargeId) {
        selNetForce = netForce.magnitude;
      }
    }

    // Only dispatch net force to Redux occasionally or if selected charge changes to avoid massive overhead
    // For this simple app, we can just dispatch it every frame since we only have one value.
    // Redux Toolkit handles it efficiently if value is identical.
    if (store.getState().electrostatics.netForce !== selNetForce) {
      store.dispatch(updateNetForce(selNetForce));
    }

    if (this.isPlaying) {
      this.syncChargesToRedux();
    }
  }

  private drawSelectionLines() {
    if (!this.selectedChargeId) return;
    const selC = this.charges.find(c => c.id === this.selectedChargeId);
    if (!selC) return;

    this.sceneGfx.lineStyle(2, 0x94a3b8, 0.4);
    for (const other of this.charges) {
      if (other.id === selC.id) continue;
      this.sceneGfx.beginPath();
      this.sceneGfx.moveTo(selC.body.x, selC.body.y);
      this.sceneGfx.lineTo(other.body.x, other.body.y);
      this.sceneGfx.strokePath();
    }
  }

  private updateChargeVisuals(c: ChargeBody, isSelected: boolean) {
    const x = c.body.x;
    const y = c.body.y;
    const radius = 25;
    const isStatic = c.body.isStatic();
    
    c.gfx.clear();
    const color = this.getChargeColor(c.charge);

    if (isStatic) { c.gfx.lineStyle(4, 0xf59e0b, 0.8); c.gfx.strokeCircle(x, y, radius + 4); }
    if (isSelected) { c.gfx.fillStyle(0xffffff, 0.2); c.gfx.fillCircle(x, y, radius + 10); c.gfx.lineStyle(2, 0xffffff, 0.8); c.gfx.strokeCircle(x, y, radius + 10); }

    c.gfx.fillStyle(0x000000, 0.5); c.gfx.fillCircle(x + 3, y + 3, radius);
    c.gfx.fillStyle(color, 1); c.gfx.fillCircle(x, y, radius);
    c.gfx.fillStyle(0xffffff, 0.3); c.gfx.fillCircle(x - 8, y - 8, radius * 0.4);

    c.text.setPosition(x, y);
    const sign = c.charge > 0 ? '+' : (c.charge < 0 ? '−' : '');
    c.text.setText(sign);
  }

  private cleanup() {
    if (this.unsubscribeStore) this.unsubscribeStore();
    this.isPlaying = false;
    
    // Crucial: Clear all class properties since the Scene instance is reused by Phaser
    this.charges = [];
    this.selectedChargeId = null;
    this.nextId = 1;
    
    // Also reset Redux state to avoid React trying to read destroyed charges
    store.dispatch({ type: 'electrostatics/setSelectedCharge', payload: null });
    store.dispatch(syncChargesFromEngine([]));
  }
}
