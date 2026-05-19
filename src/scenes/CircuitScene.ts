import Phaser from 'phaser';
import { store } from '../store/store';
import { CircuitTopology, setSlot1State, setSlot2State, setSlot3State, setSlot4State, setSlot2Orient, setSlot3Orient, setSlot4Orient, setOpen, CircuitTool, DraggedComponent, setDraggedComponent, rotateDraggedComponent } from '../store/circuitSlice';

const COLORS = {
  wire: 0x334155,
  wireGlow: 0x6366f1,
  electron: 0x22d3ee,
  electronGlow: 0x06b6d4,
  batteryBody: 0x1e293b,
  batteryText: 0xf8fafc,
  bulbOff: 0x475569,
  bulbOn: 0xf59e0b,
  grid: 0x111827,
  r1: 0xf43f5e,
  r2: 0x3b82f6,
  r3: 0x10b981,
  r4: 0xc084fc,
  slotGuide: 0x64748b,
  slotHover: 0x818cf8
};

interface PathNode {
  x: number;
  y: number;
}

interface AnimElectron {
  pathIndex: number; 
  distance: number;  
}

export class CircuitScene extends Phaser.Scene {
  private wireGraphics!: Phaser.GameObjects.Graphics;
  private glowGraphics!: Phaser.GameObjects.Graphics;
  private sceneGfx!: Phaser.GameObjects.Graphics;
  private unsubscribeStore?: () => void;

  // Circuit configuration from Redux
  private voltage = 12;
  private r1 = 100;
  private r2 = 200;
  private r3 = 200;
  private r4 = 200;
  private isOpen = false;
  private topology: CircuitTopology = 'series';
  private slot1: 'resistor' | 'wire' | 'empty' = 'resistor';
  private slot2: 'resistor' | 'wire' | 'empty' = 'resistor';
  private slot3: 'resistor' | 'wire' | 'empty' = 'resistor';
  private slot4: 'resistor' | 'wire' | 'empty' = 'empty';
  private slot2Orient: 'horizontal' | 'vertical' = 'vertical';
  private slot3Orient: 'horizontal' | 'vertical' = 'vertical';
  private slot4Orient: 'horizontal' | 'vertical' = 'vertical';
  private activeTool: CircuitTool = 'pan';
  private draggedComponent: DraggedComponent | null = null;

  // Path dimensions
  private cx = 0;
  private cy = 0;
  private left = 0;
  private right = 0;
  private top = 0;
  private bottom = 0;

  // Dynamic electron groups
  private electrons: AnimElectron[] = [];
  private numElectronsPerPath = 18;

  // UI overlays
  private valueLabels: { dom: Phaser.GameObjects.DOMElement; x: number; y: number; slot: number }[] = [];
  private contextMenu: Phaser.GameObjects.DOMElement | null = null;

  constructor() {
    super('CircuitScene');
  }

  create() {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#0a0e17');

    this.sceneGfx = this.add.graphics().setDepth(2);
    this.wireGraphics = this.add.graphics().setDepth(1);
    this.glowGraphics = this.add.graphics().setDepth(3);

    this.cx = width / 2;
    this.cy = height / 2;
    this.left = this.cx - 280;
    this.right = this.cx + 280;
    this.top = this.cy - 140;
    this.bottom = this.cy + 140;

    // Set Miro-like grab hand cursor
    this.input.setDefaultCursor('grab');

    // Disable default browser context menu on canvas
    this.input.mouse?.disableContextMenu();

    // Initialize electron particles
    this.resetElectrons();

    // Subscribe to Redux state
    this.syncFromRedux();
    this.unsubscribeStore = store.subscribe(() => {
      const prevTopology = this.topology;
      const prevSlot4 = this.slot4;
      const prevSlot2 = this.slot2;
      const prevSlot3 = this.slot3;
      
      this.syncFromRedux();
      
      if (prevTopology !== this.topology || prevSlot4 !== this.slot4 || prevSlot2 !== this.slot2 || prevSlot3 !== this.slot3) {
        this.resetElectrons();
      }
    });

    // Handle mouse drag-to-pan & grab cursor animations (Miro style)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Close context menu if clicked elsewhere
      if (this.contextMenu) {
        this.contextMenu.destroy();
        this.contextMenu = null;
        return;
      }

      // Drag and Drop Snapping / Placement Controller
      if (this.topology === 'custom' && this.draggedComponent) {
        if (pointer.leftButtonDown()) {
          const pWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          const isDraggingHorizontal = this.draggedComponent.angle === 0;

          const slots = isDraggingHorizontal
            ? [
                { id: 1, x: this.cx - 140, y: this.top, isHorizontal: true },
                { id: 2, x: this.cx, y: this.top, isHorizontal: true },
                { id: 4, x: this.cx + 140, y: this.top, isHorizontal: true },
                { id: 3, x: this.right - 70, y: this.top, isHorizontal: true }
              ]
            : [
                { id: 2, x: this.cx, y: this.cy, isHorizontal: false },
                { id: 4, x: this.cx + 140, y: this.cy, isHorizontal: false },
                { id: 3, x: this.right, y: this.cy - 60, isHorizontal: false }
              ];

          let nearest = slots[0];
          let minDist = Phaser.Math.Distance.Between(pWorld.x, pWorld.y, nearest.x, nearest.y);
          for (let i = 1; i < slots.length; i++) {
            const d = Phaser.Math.Distance.Between(pWorld.x, pWorld.y, slots[i].x, slots[i].y);
            if (d < minDist) {
              minDist = d;
              nearest = slots[i];
            }
          }

          if (minDist < 100) {
            const type = this.draggedComponent.type;
            const orient = nearest.isHorizontal ? 'horizontal' : 'vertical';

            if (nearest.id === 1) store.dispatch(setSlot1State(type));
            if (nearest.id === 2) {
              store.dispatch(setSlot2State(type));
              store.dispatch(setSlot2Orient(orient));
            }
            if (nearest.id === 3) {
              store.dispatch(setSlot3State(type));
              store.dispatch(setSlot3Orient(orient));
            }
            if (nearest.id === 4) {
              store.dispatch(setSlot4State(type));
              store.dispatch(setSlot4Orient(orient));
            }

            store.dispatch(setDraggedComponent(null));
            this.cameras.main.flash(85, 99, 102, 241, true);
          } else {
            // Cancel placement if clicked completely out of bounds
            store.dispatch(setDraggedComponent(null));
          }
          return;
        }

        if (pointer.rightButtonDown()) {
          // Cancel dragging on right-click
          store.dispatch(setDraggedComponent(null));
          return;
        }
      }

      // Detach / Pick up component from board logic
      if (this.topology === 'custom' && !this.draggedComponent) {
        if (pointer.leftButtonDown()) {
          const pWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          const c1 = this.getSlotCoords(1);
          const c2 = this.getSlotCoords(2);
          const c3 = this.getSlotCoords(3);
          const c4 = this.getSlotCoords(4);

          const slots = [
            { id: 1, x: c1.x, y: c1.y, state: this.slot1, isHorizontal: c1.isHorizontal },
            { id: 2, x: c2.x, y: c2.y, state: this.slot2, isHorizontal: c2.isHorizontal },
            { id: 4, x: c4.x, y: c4.y, state: this.slot4, isHorizontal: c4.isHorizontal },
            { id: 3, x: c3.x, y: c3.y, state: this.slot3, isHorizontal: c3.isHorizontal }
          ];

          let nearest = slots[0];
          let minDist = Phaser.Math.Distance.Between(pWorld.x, pWorld.y, nearest.x, nearest.y);
          for (let i = 1; i < slots.length; i++) {
            const d = Phaser.Math.Distance.Between(pWorld.x, pWorld.y, slots[i].x, slots[i].y);
            if (d < minDist) {
              minDist = d;
              nearest = slots[i];
            }
          }

          if (minDist < 55 && nearest.state !== 'empty') {
            const compType = nearest.state;
            const compAngle = nearest.isHorizontal ? 0 : 90;
            
            if (nearest.id === 1) store.dispatch(setSlot1State('empty'));
            if (nearest.id === 2) store.dispatch(setSlot2State('empty'));
            if (nearest.id === 3) store.dispatch(setSlot3State('empty'));
            if (nearest.id === 4) store.dispatch(setSlot4State('empty'));

            store.dispatch(setDraggedComponent({ type: compType as 'resistor' | 'wire', angle: compAngle }));
            this.cameras.main.flash(85, 99, 102, 241, true);
            return;
          }
        }
      }

      if (this.topology === 'custom' && this.activeTool !== 'pan') {
        if (pointer.leftButtonDown()) {
          const pWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          const nearest = this.findNearestSlotCandidate(pWorld.x, pWorld.y);

          if (nearest.distance < 75) {
            const newState = this.activeTool === 'resistor' ? 'resistor' : this.activeTool === 'wire' ? 'wire' : 'empty';
            const orient = nearest.isHorizontal ? 'horizontal' : 'vertical';

            if (nearest.id === 1) store.dispatch(setSlot1State(newState));
            if (nearest.id === 2) {
              store.dispatch(setSlot2State(newState));
              store.dispatch(setSlot2Orient(orient));
            }
            if (nearest.id === 3) {
              store.dispatch(setSlot3State(newState));
              store.dispatch(setSlot3Orient(orient));
            }
            if (nearest.id === 4) {
              store.dispatch(setSlot4State(newState));
              store.dispatch(setSlot4Orient(orient));
            }

            this.cameras.main.flash(85, 99, 102, 241, true);
            return;
          }
        }
      } else {
        if (pointer.leftButtonDown()) {
          const pWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          const switchX = this.cx + 120;
          const switchY = this.bottom;
          const dist = Phaser.Math.Distance.Between(pWorld.x, pWorld.y, switchX, switchY);
          if (dist < 28) {
            store.dispatch(setOpen(!this.isOpen));
            return;
          }
        }
      }

      if (this.activeTool === 'pan' && !this.draggedComponent) {
        this.input.setDefaultCursor('grabbing');
      }

      if (pointer.rightButtonDown() && this.topology === 'custom' && !this.draggedComponent) {
        const pWorld = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const nearest = this.findNearestSlotCandidate(pWorld.x, pWorld.y);

        if (nearest.distance < 140) {
          this.spawnContextMenu(pointer.x, pointer.y, nearest.id, nearest.isHorizontal ? 'horizontal' : 'vertical');
        }
      }
    });

    this.input.on('pointerup', () => {
      if (this.topology === 'custom') {
        if (this.activeTool === 'pan') this.input.setDefaultCursor('grab');
        else if (this.activeTool === 'resistor') this.input.setDefaultCursor('cell');
        else if (this.activeTool === 'wire') this.input.setDefaultCursor('alias');
        else if (this.activeTool === 'eraser') this.input.setDefaultCursor('not-allowed');
      } else {
        this.input.setDefaultCursor('grab');
      }
    });

    // Miro drag-to-pan implementation
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && !this.contextMenu && this.activeTool === 'pan') {
        // If they started dragging near the switch, don't drag camera
        const pStartWorld = this.cameras.main.getWorldPoint(pointer.downX, pointer.downY);
        const switchX = this.cx + 120;
        const switchY = this.bottom;
        const distToSwitch = Phaser.Math.Distance.Between(pStartWorld.x, pStartWorld.y, switchX, switchY);
        if (distToSwitch < 28) return;

        const dx = pointer.x - (pointer.prevPosition ? pointer.prevPosition.x : pointer.x);
        const dy = pointer.y - (pointer.prevPosition ? pointer.prevPosition.y : pointer.y);

        this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
        this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
      }
    });

    // Miro scroll-to-zoom implementation
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number) => {
      const zoomFactor = 0.05;
      let newZoom = this.cameras.main.zoom - deltaY * zoomFactor * 0.01;
      newZoom = Phaser.Math.Clamp(newZoom, 0.4, 2.5);
      this.cameras.main.setZoom(newZoom);
    });

    this.events.once('shutdown', () => {
      if (this.unsubscribeStore) this.unsubscribeStore();
      this.clearLabels();
    });
  }

  private spawnContextMenu(x: number, y: number, slotIndex: number, orient: 'horizontal' | 'vertical') {
    if (this.contextMenu) this.contextMenu.destroy();

    const html = `
      <div class="glass-panel" style="
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        padding: 6px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(15,23,42,0.95);
        color: #f1f5f9;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 145px;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
      ">
        <div style="font-weight: bold; color: #818cf8; padding: 2px 6px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 2px;">Ranura R${slotIndex}</div>
        <button id="opt-resistor" style="background: transparent; border: none; color: #f43f5e; text-align: left; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: background 0.15s; outline: none;">🔴 Resistencia</button>
        <button id="opt-wire" style="background: transparent; border: none; color: #cbd5e1; text-align: left; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: background 0.15s; outline: none;">🔗 Cable Directo</button>
        <button id="opt-empty" style="background: transparent; border: none; color: #94a3b8; text-align: left; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 500; transition: background 0.15s; outline: none;">⚪ Vaciar Tramo</button>
      </div>
    `;

    this.contextMenu = this.add.dom(x, y).createFromHTML(html).setDepth(20);
    this.contextMenu.addListener('click');
    this.contextMenu.on('click', (event: any) => {
      const targetId = event.target.id;
      if (targetId === 'opt-resistor') {
        if (slotIndex === 1) store.dispatch(setSlot1State('resistor'));
        if (slotIndex === 2) {
          store.dispatch(setSlot2State('resistor'));
          store.dispatch(setSlot2Orient(orient));
        }
        if (slotIndex === 3) {
          store.dispatch(setSlot3State('resistor'));
          store.dispatch(setSlot3Orient(orient));
        }
        if (slotIndex === 4) {
          store.dispatch(setSlot4State('resistor'));
          store.dispatch(setSlot4Orient(orient));
        }
      } else if (targetId === 'opt-wire') {
        if (slotIndex === 1) store.dispatch(setSlot1State('wire'));
        if (slotIndex === 2) {
          store.dispatch(setSlot2State('wire'));
          store.dispatch(setSlot2Orient(orient));
        }
        if (slotIndex === 3) {
          store.dispatch(setSlot3State('wire'));
          store.dispatch(setSlot3Orient(orient));
        }
        if (slotIndex === 4) {
          store.dispatch(setSlot4State('wire'));
          store.dispatch(setSlot4Orient(orient));
        }
      } else if (targetId === 'opt-empty') {
        if (slotIndex === 1) store.dispatch(setSlot1State('empty'));
        if (slotIndex === 2) store.dispatch(setSlot2State('empty'));
        if (slotIndex === 3) store.dispatch(setSlot3State('empty'));
        if (slotIndex === 4) store.dispatch(setSlot4State('empty'));
      }
      this.contextMenu?.destroy();
      this.contextMenu = null;
    });
  }

  private resetElectrons() {
    this.electrons = [];
    
    // Determine active electron paths
    const activePaths: number[] = [];
    if (this.topology === 'series') {
      activePaths.push(0);
    } else if (this.topology === 'parallel') {
      activePaths.push(0, 1, 2);
    } else if (this.topology === 'mixed' || this.topology === 'custom') {
      if (this.slot2 !== 'empty') activePaths.push(1);
      if (this.slot3 !== 'empty') activePaths.push(2);
      if (this.slot4 !== 'empty') activePaths.push(3);
    }

    activePaths.forEach(pIdx => {
      const totalLen = this.getPathLength(this.getNodesForPath(pIdx));
      for (let i = 0; i < this.numElectronsPerPath; i++) {
        this.electrons.push({
          pathIndex: pIdx,
          distance: (i / this.numElectronsPerPath) * totalLen
        });
      }
    });
  }

  private syncFromRedux() {
    const state = store.getState().circuit;
    this.voltage = state.voltage;
    this.r1 = state.r1;
    this.r2 = state.r2;
    this.r3 = state.r3;
    this.r4 = state.r4;
    this.isOpen = state.isOpen;
    this.topology = state.topology;
    this.slot1 = state.slot1;
    this.slot2 = state.slot2;
    this.slot3 = state.slot3;
    this.slot4 = state.slot4;
    this.slot2Orient = state.slot2Orient || 'vertical';
    this.slot3Orient = state.slot3Orient || 'vertical';
    this.slot4Orient = state.slot4Orient || 'vertical';

    const prevTool = this.activeTool;
    this.activeTool = state.activeTool || 'pan';
    this.draggedComponent = state.draggedComponent || null;
    
    // Dynamically update cursor when activeTool or draggedComponent changes in Redux
    if (this.draggedComponent) {
      this.input.setDefaultCursor('crosshair');
    } else if (prevTool !== this.activeTool) {
      if (this.topology === 'custom') {
        if (this.activeTool === 'pan') this.input.setDefaultCursor('grab');
        else if (this.activeTool === 'resistor') this.input.setDefaultCursor('cell');
        else if (this.activeTool === 'wire') this.input.setDefaultCursor('alias');
        else if (this.activeTool === 'eraser') this.input.setDefaultCursor('not-allowed');
      } else {
        this.input.setDefaultCursor('grab');
      }
    }
  }

  private clearLabels() {
    this.valueLabels.forEach(lbl => lbl.dom.destroy());
    this.valueLabels = [];
  }

  update(time: number, delta: number) {
    this.sceneGfx.clear();
    this.wireGraphics.clear();
    this.glowGraphics.clear();
    this.clearLabels();

    const { width, height } = this.cameras.main;

    this.cx = width / 2;
    this.cy = height / 2;
    this.left = this.cx - 280;
    this.right = this.cx + 280;
    this.top = this.cy - 140;
    this.bottom = this.cy + 140;

    // 1. Draw infinite grid background based on camera view boundary (Miro style)
    this.drawGrid(width, height);

    // 2. Solve network
    const { req, it, i1, i2, i3, i4, v1, v2, v3, v4 } = this.solveNetwork();

    // 3. Move electrons proportional to branch specific currents
    if (!this.isOpen) {
      const speedFactor = 0.45; 
      this.electrons.forEach(e => {
        let branchCurrent = 0;
        if (this.topology === 'series') {
          branchCurrent = it;
        } else if (this.topology === 'parallel') {
          branchCurrent = e.pathIndex === 0 ? i1 : e.pathIndex === 1 ? i2 : i3;
        } else if (this.topology === 'mixed' || this.topology === 'custom') {
          branchCurrent = e.pathIndex === 1 ? i2 : e.pathIndex === 2 ? i3 : e.pathIndex === 3 ? i4 : i2;
        }
        
        const pathNodes = this.getNodesForPath(e.pathIndex);
        const totalLen = this.getPathLength(pathNodes);
        const step = branchCurrent * speedFactor * delta;
        e.distance = (e.distance + step) % totalLen;
      });
    }

    // 4. Draw wires
    this.drawWires();

    // 5. Draw battery
    this.drawBattery(this.cx, this.bottom);

    // 6. Draw bulb
    this.drawBulb(this.left, this.cy, it);

    // 7. Draw Switch
    this.drawSwitch(this.cx + 120, this.bottom);

    // 8. Draw active components and dynamic hover badges
    this.drawComponentsAndBadges(it, i1, i2, i3, i4, v1, v2, v3, v4);

    // 9. Draw interactive dashed slot indicators for Creador topology
    if (this.topology === 'custom') {
      this.drawSlotIndicators();
    }

    // 9.5. Draw Dragged Component Preview
    if (this.topology === 'custom' && this.draggedComponent) {
      const mouseWorld = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
      const isDraggingHorizontal = this.draggedComponent.angle === 0;

      const slots = isDraggingHorizontal
        ? [
            { id: 1, x: this.cx - 140, y: this.top, isHorizontal: true, color: COLORS.r1 },
            { id: 2, x: this.cx, y: this.top, isHorizontal: true, color: COLORS.r2 },
            { id: 4, x: this.cx + 140, y: this.top, isHorizontal: true, color: COLORS.r4 },
            { id: 3, x: this.right - 70, y: this.top, isHorizontal: true, color: COLORS.r3 }
          ]
        : [
            { id: 2, x: this.cx, y: this.cy, isHorizontal: false, color: COLORS.r2 },
            { id: 4, x: this.cx + 140, y: this.cy, isHorizontal: false, color: COLORS.r4 },
            { id: 3, x: this.right, y: this.cy - 60, isHorizontal: false, color: COLORS.r3 }
          ];

      let nearestSlot = slots[0];
      let minDist = Phaser.Math.Distance.Between(mouseWorld.x, mouseWorld.y, nearestSlot.x, nearestSlot.y);
      for (let i = 1; i < slots.length; i++) {
        const d = Phaser.Math.Distance.Between(mouseWorld.x, mouseWorld.y, slots[i].x, slots[i].y);
        if (d < minDist) {
          minDist = d;
          nearestSlot = slots[i];
        }
      }

      const componentColor = this.draggedComponent.type === 'resistor' ? 0xf43f5e : 0xe2e8f0;

      if (minDist < 100) {
        // Render Snap Preview inside the slot
        const snapX = nearestSlot.x;
        const snapY = nearestSlot.y;
        const isHorizontal = nearestSlot.isHorizontal;

        // Glow indicator around the slot
        this.glowGraphics.fillStyle(componentColor, 0.15);
        this.glowGraphics.fillCircle(snapX, snapY, 40);

        this.glowGraphics.lineStyle(2, componentColor, 0.8);
        this.glowGraphics.strokeCircle(snapX, snapY, 32);

        if (this.draggedComponent.type === 'resistor') {
          this.drawResistorGfx(snapX, snapY, isHorizontal, componentColor);
        } else {
          // Draw wire segment
          this.wireGraphics.fillStyle(0x0a0e17, 1);
          if (isHorizontal) {
            this.wireGraphics.fillRect(snapX - 22, snapY - 5, 44, 10);
            this.sceneGfx.lineStyle(4, componentColor, 0.9);
            this.sceneGfx.lineBetween(snapX - 22, snapY, snapX + 22, snapY);
          } else {
            this.wireGraphics.fillRect(snapX - 5, snapY - 22, 10, 44);
            this.sceneGfx.lineStyle(4, componentColor, 0.9);
            this.sceneGfx.lineBetween(snapX, snapY - 22, snapX, snapY + 22);
          }
        }
      } else {
        // Render Floating Component following mouse cursor
        const isHorizontal = this.draggedComponent.angle === 0;
        
        // Draw float shadow/glow behind the component
        this.glowGraphics.fillStyle(componentColor, 0.1);
        this.glowGraphics.fillCircle(mouseWorld.x, mouseWorld.y, 24);

        if (this.draggedComponent.type === 'resistor') {
          this.drawResistorGfx(mouseWorld.x, mouseWorld.y, isHorizontal, componentColor);
        } else {
          // Draw wire segment
          this.wireGraphics.fillStyle(0x0a0e17, 0.7);
          if (isHorizontal) {
            this.wireGraphics.fillRect(mouseWorld.x - 22, mouseWorld.y - 5, 44, 10);
            this.sceneGfx.lineStyle(4, componentColor, 0.8);
            this.sceneGfx.lineBetween(mouseWorld.x - 22, mouseWorld.y, mouseWorld.x + 22, mouseWorld.y);
          } else {
            this.wireGraphics.fillRect(mouseWorld.x - 5, mouseWorld.y - 22, 10, 44);
            this.sceneGfx.lineStyle(4, componentColor, 0.8);
            this.sceneGfx.lineBetween(mouseWorld.x, mouseWorld.y - 22, mouseWorld.x, mouseWorld.y + 22);
          }
        }
      }
    }

    // 10. Draw Electrons
    this.drawElectrons();

    // 11. Hover probing badge visibility controller (calculated in World space to support pan/zoom)
    const mouseWorld = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);

    this.valueLabels.forEach(lbl => {
      const dist = Phaser.Math.Distance.Between(mouseWorld.x, mouseWorld.y, lbl.x, lbl.y);
      const isCustomMode = this.topology === 'custom';
      
      const slotState = lbl.slot === 1 ? this.slot1 : lbl.slot === 2 ? this.slot2 : lbl.slot === 3 ? this.slot3 : this.slot4;
      if (isCustomMode && slotState !== 'resistor') {
        lbl.dom.setVisible(false);
        return;
      }

      // Proximity reveal
      if (dist < 48) {
        lbl.dom.setVisible(true);
        lbl.dom.setScale(1.02);
      } else {
        lbl.dom.setVisible(false);
      }
    });
  }

  private drawGrid(width: number, height: number) {
    const cam = this.cameras.main;
    // Calculate infinite coordinates relative to camera scroll & zoom
    const startX = Math.floor((cam.scrollX - width) / 40) * 40;
    const endX = Math.ceil((cam.scrollX + width * 2) / 40) * 40;
    const startY = Math.floor((cam.scrollY - height) / 40) * 40;
    const endY = Math.ceil((cam.scrollY + height * 2) / 40) * 40;

    this.sceneGfx.lineStyle(1, COLORS.grid, 0.4);
    for (let x = startX; x < endX; x += 40) {
      this.sceneGfx.moveTo(x, startY);
      this.sceneGfx.lineTo(x, endY);
    }
    for (let y = startY; y < endY; y += 40) {
      this.sceneGfx.moveTo(startX, y);
      this.sceneGfx.lineTo(endX, y);
    }
    this.sceneGfx.strokePath();
  }

  private drawWires() {
    const drawOutline = (path: PathNode[], alpha = 1) => {
      this.wireGraphics.lineStyle(6, COLORS.wire, alpha);
      this.wireGraphics.beginPath();
      this.wireGraphics.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        this.wireGraphics.lineTo(path[i].x, path[i].y);
      }
      this.wireGraphics.strokePath();

      const glowAlpha = this.isOpen ? 0.08 : 0.35 * alpha;
      this.wireGraphics.lineStyle(2, COLORS.wireGlow, glowAlpha);
      this.wireGraphics.strokePath();
    };

    if (this.topology === 'series') {
      drawOutline([
        { x: this.left, y: this.top },
        { x: this.right, y: this.top },
        { x: this.right, y: this.bottom },
        { x: this.left, y: this.bottom },
        { x: this.left, y: this.top }
      ]);
      return;
    }

    if (this.topology === 'parallel') {
      drawOutline([
        { x: this.left, y: this.top },
        { x: this.right, y: this.top },
        { x: this.right, y: this.bottom },
        { x: this.left, y: this.bottom },
        { x: this.left, y: this.top }
      ]);
      drawOutline([{ x: this.cx - 140, y: this.top }, { x: this.cx - 140, y: this.bottom }]);
      drawOutline([{ x: this.cx, y: this.top }, { x: this.cx, y: this.bottom }]);
      drawOutline([{ x: this.cx + 140, y: this.top }, { x: this.cx + 140, y: this.bottom }]);
      return;
    }

    // Mixed & Custom layouts
    const topSegments: PathNode[][] = [];
    let prevX = this.left;

    // Slot 1 (always horizontal)
    if (this.slot1 === 'resistor' || this.slot1 === 'empty') {
      topSegments.push([{ x: prevX, y: this.top }, { x: this.cx - 162, y: this.top }]);
      prevX = this.cx - 118;
    } else {
      topSegments.push([{ x: prevX, y: this.top }, { x: this.cx - 118, y: this.top }]);
      prevX = this.cx - 118;
    }

    // Slot 2 horizontal option
    const isS2Horiz = (this.topology === 'custom' || this.topology === 'mixed') && this.slot2Orient === 'horizontal';
    const s2X = this.cx;
    if (isS2Horiz && (this.slot2 === 'resistor' || this.slot2 === 'empty')) {
      topSegments.push([{ x: prevX, y: this.top }, { x: s2X - 22, y: this.top }]);
      prevX = s2X + 22;
    } else {
      topSegments.push([{ x: prevX, y: this.top }, { x: s2X, y: this.top }]);
      prevX = s2X;
    }

    // Slot 4 horizontal option
    const isS4Horiz = this.topology === 'custom' && this.slot4Orient === 'horizontal';
    const s4X = this.cx + 140;
    if (isS4Horiz && (this.slot4 === 'resistor' || this.slot4 === 'empty')) {
      topSegments.push([{ x: prevX, y: this.top }, { x: s4X - 22, y: this.top }]);
      prevX = s4X + 22;
    } else {
      topSegments.push([{ x: prevX, y: this.top }, { x: s4X, y: this.top }]);
      prevX = s4X;
    }

    // Slot 3 horizontal option
    const isS3Horiz = (this.topology === 'custom' || this.topology === 'mixed') && this.slot3Orient === 'horizontal';
    const s3X = this.right - 70;
    if (isS3Horiz && (this.slot3 === 'resistor' || this.slot3 === 'empty')) {
      topSegments.push([{ x: prevX, y: this.top }, { x: s3X - 22, y: this.top }]);
      prevX = s3X + 22;
    } else {
      topSegments.push([{ x: prevX, y: this.top }, { x: s3X, y: this.top }]);
      prevX = s3X;
    }

    // Finish to right edge
    topSegments.push([{ x: prevX, y: this.top }, { x: this.right, y: this.top }]);
    topSegments.forEach(seg => drawOutline(seg));

    // Left vertical wire
    drawOutline([{ x: this.left, y: this.top }, { x: this.left, y: this.bottom }]);

    // Bottom horizontal wire
    drawOutline([{ x: this.left, y: this.bottom }, { x: this.right, y: this.bottom }]);

    // Slot 2 (Vertical branch center)
    const centerSegments: PathNode[][] = [];
    if (!isS2Horiz) {
      if (this.slot2 === 'resistor' || this.slot2 === 'empty') {
        centerSegments.push([{ x: this.cx, y: this.top }, { x: this.cx, y: this.cy - 25 }]);
        centerSegments.push([{ x: this.cx, y: this.cy + 25 }, { x: this.cx, y: this.bottom }]);
      } else {
        centerSegments.push([{ x: this.cx, y: this.top }, { x: this.cx, y: this.bottom }]);
      }
    } else {
      centerSegments.push([{ x: this.cx, y: this.top }, { x: this.cx, y: this.bottom }]);
    }
    centerSegments.forEach(seg => drawOutline(seg));

    // Slot 4 (Vertical branch mid-right)
    if (this.topology === 'custom') {
      const alpha = this.slot4 === 'empty' ? 0.22 : 1;
      const slot4Segments: PathNode[][] = [];
      if (!isS4Horiz) {
        if (this.slot4 === 'resistor' || this.slot4 === 'empty') {
          slot4Segments.push([{ x: this.cx + 140, y: this.top }, { x: this.cx + 140, y: this.cy - 25 }]);
          slot4Segments.push([{ x: this.cx + 140, y: this.cy + 25 }, { x: this.cx + 140, y: this.bottom }]);
        } else {
          slot4Segments.push([{ x: this.cx + 140, y: this.top }, { x: this.cx + 140, y: this.bottom }]);
        }
      } else {
        slot4Segments.push([{ x: this.cx + 140, y: this.top }, { x: this.cx + 140, y: this.bottom }]);
      }
      slot4Segments.forEach(seg => drawOutline(seg, alpha));
    }

    // Slot 3 (Vertical branch right)
    const rightSegments: PathNode[][] = [];
    if (!isS3Horiz) {
      if (this.slot3 === 'resistor' || this.slot3 === 'empty') {
        rightSegments.push([{ x: this.right, y: this.top }, { x: this.right, y: this.cy - 85 }]);
        rightSegments.push([{ x: this.right, y: this.cy - 35 }, { x: this.right, y: this.bottom }]);
      } else {
        rightSegments.push([{ x: this.right, y: this.top }, { x: this.right, y: this.bottom }]);
      }
    } else {
      rightSegments.push([{ x: this.right, y: this.top }, { x: this.right, y: this.bottom }]);
    }
    rightSegments.forEach(seg => drawOutline(seg));
  }

  private drawBattery(x: number, y: number) {
    const w = 80, h = 32;
    this.wireGraphics.fillStyle(0x0a0e17, 1);
    this.wireGraphics.fillRect(x - w/2 - 10, y - 4, w + 20, 8);

    this.sceneGfx.fillStyle(COLORS.batteryBody, 1);
    this.sceneGfx.lineStyle(2, COLORS.wireGlow, 0.8);
    this.sceneGfx.fillRoundedRect(x - w/2, y - h/2, w, h, 6);
    this.sceneGfx.strokeRoundedRect(x - w/2, y - h/2, w, h, 6);

    this.sceneGfx.fillStyle(0x3b82f6, 1);
    this.sceneGfx.fillRect(x - w/2 + 2, y - h/2 + 2, 8, h - 4);
    this.sceneGfx.fillStyle(0xef4444, 1);
    this.sceneGfx.fillRect(x + w/2 - 10, y - h/2 + 2, 8, h - 4);

    this.sceneGfx.fillStyle(COLORS.batteryText, 1);
    this.sceneGfx.fillRect(x - w/4 - 3, y - 1, 6, 2);
    this.sceneGfx.fillRect(x + w/4 - 3, y - 1, 6, 2);
    this.sceneGfx.fillRect(x + w/4 - 1, y - 3, 2, 6);
  }

  private drawBulb(x: number, y: number, totalCurrent: number) {
    this.wireGraphics.fillStyle(0x0a0e17, 1);
    this.wireGraphics.fillRect(x - 4, y - 20, 8, 40);

    if (totalCurrent > 0) {
      const maxGlow = 45 + Math.min(totalCurrent * 35, 60);
      const alpha = 0.15 + Math.min(totalCurrent * 0.2, 0.4);
      this.glowGraphics.fillStyle(0xf59e0b, alpha * 0.35);
      this.glowGraphics.fillCircle(x - 12, y, maxGlow);
      this.glowGraphics.fillStyle(0xf59e0b, alpha);
      this.glowGraphics.fillCircle(x - 12, y, 22 + Math.min(totalCurrent * 12, 20));
    }

    this.sceneGfx.fillStyle(0x64748b, 1);
    this.sceneGfx.fillRect(x - 6, y - 12, 12, 24);
    this.sceneGfx.lineStyle(1, 0x94a3b8, 1);
    this.sceneGfx.strokeRect(x - 6, y - 12, 12, 24);

    const glassColor = totalCurrent > 0 ? COLORS.bulbOn : COLORS.bulbOff;
    this.sceneGfx.lineStyle(3, glassColor, 1);
    this.sceneGfx.fillStyle(totalCurrent > 0 ? 0xfef08a : 0x1e293b, totalCurrent > 0 ? 0.3 : 0.6);
    this.sceneGfx.fillCircle(x - 22, y, 18);
    this.sceneGfx.strokeCircle(x - 22, y, 18);

    this.sceneGfx.lineStyle(1.5, totalCurrent > 0 ? 0xfff176 : 0x94a3b8, 1);
    this.sceneGfx.beginPath();
    this.sceneGfx.moveTo(x - 6, y - 5);
    this.sceneGfx.lineTo(x - 18, y - 5);
    this.sceneGfx.lineTo(x - 18, y + 5);
    this.sceneGfx.lineTo(x - 6, y + 5);
    this.sceneGfx.strokePath();

    if (totalCurrent > 0) {
      this.glowGraphics.fillStyle(0xffffff, 0.9);
      this.glowGraphics.fillCircle(x - 18, y, 4);
    }
  }

  private drawSwitch(x: number, y: number) {
    this.wireGraphics.fillStyle(0x0a0e17, 1);
    this.wireGraphics.fillRect(x - 25, y - 5, 50, 10);

    const contactRad = 4;
    const gap = 24;

    this.sceneGfx.fillStyle(0x64748b, 1);
    this.sceneGfx.lineStyle(1.5, COLORS.wireGlow, 0.8);
    this.sceneGfx.fillCircle(x - gap/2, y, contactRad);
    this.sceneGfx.strokeCircle(x - gap/2, y, contactRad);
    this.sceneGfx.fillCircle(x + gap/2, y, contactRad);
    this.sceneGfx.strokeCircle(x + gap/2, y, contactRad);

    this.sceneGfx.lineStyle(3, 0xf1f5f9, 1);
    if (this.isOpen) {
      const angle = -Math.PI / 4;
      const endX = x - gap/2 + Math.cos(angle) * gap;
      const endY = y + Math.sin(angle) * gap;
      this.sceneGfx.lineBetween(x - gap/2, y, endX, endY);
    } else {
      this.sceneGfx.lineBetween(x - gap/2, y, x + gap/2, y);
    }
  }

  private drawResistorGfx(x: number, y: number, isHorizontal: boolean, color: number) {
    this.wireGraphics.fillStyle(0x0a0e17, 1);
    if (isHorizontal) {
      this.wireGraphics.fillRect(x - 22, y - 5, 44, 10);
    } else {
      this.wireGraphics.fillRect(x - 5, y - 22, 10, 44);
    }

    const gfx = this.sceneGfx;
    gfx.lineStyle(3.5, color, 1);
    const size = 18;
    if (isHorizontal) {
      gfx.beginPath();
      gfx.moveTo(x - size, y);
      gfx.lineTo(x - size + 4, y - 7);
      gfx.lineTo(x - size + 8, y + 7);
      gfx.lineTo(x - size + 12, y - 7);
      gfx.lineTo(x - size + 16, y + 7);
      gfx.lineTo(x - size + 20, y - 7);
      gfx.lineTo(x - size + 24, y + 7);
      gfx.lineTo(x - size + 28, y - 7);
      gfx.lineTo(x - size + 32, y + 7);
      gfx.lineTo(x + size, y);
      gfx.strokePath();
    } else {
      gfx.beginPath();
      gfx.moveTo(x, y - size);
      gfx.lineTo(x - 7, y - size + 4);
      gfx.lineTo(x + 7, y - size + 8);
      gfx.lineTo(x - 7, y - size + 12);
      gfx.lineTo(x + 7, y - size + 16);
      gfx.lineTo(x - 7, y - size + 20);
      gfx.lineTo(x + 7, y - size + 24);
      gfx.lineTo(x - 7, y - size + 28);
      gfx.lineTo(x + 7, y - size + 32);
      gfx.lineTo(x, y + size);
      gfx.strokePath();
    }
  }

  private addValueBadge(x: number, y: number, name: string, v: number, i: number, color: string, slotIndex: number) {
    const currentStr = this.isOpen ? "0.0000 A" : `${i.toFixed(4)} A`;
    const voltStr = this.isOpen ? "0.00 V" : `${v.toFixed(2)} V`;

    const html = `
      <div class="glass-panel" style="
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(15,23,42,0.85);
        color: #f1f5f9;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 65px;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
        transition: transform 0.1s ease-out;
      ">
        <span style="font-weight: bold; color: ${color}; font-size: 10.5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">${name}</span>
        <span style="color: #cbd5e1; font-family: monospace;">V: ${voltStr}</span>
        <span style="color: #38bdf8; font-family: monospace;">I: ${currentStr}</span>
      </div>
    `;
    const label = this.add.dom(x, y).createFromHTML(html).setDepth(10);
    label.setVisible(false);
    this.valueLabels.push({ dom: label, x, y, slot: slotIndex });
  }

  private drawComponentsAndBadges(it: number, i1: number, i2: number, i3: number, i4: number, v1: number, v2: number, v3: number, v4: number) {
    if (this.topology === 'series') {
      this.drawResistorGfx(this.cx - 140, this.top, true, COLORS.r1);
      this.addValueBadge(this.cx - 140, this.top - 38, 'R₁', v1, i1, '#f43f5e', 1);

      this.drawResistorGfx(this.cx, this.top, true, COLORS.r2);
      this.addValueBadge(this.cx, this.top - 38, 'R₂', v2, i2, '#3b82f6', 2);

      this.drawResistorGfx(this.cx + 140, this.top, true, COLORS.r3);
      this.addValueBadge(this.cx + 140, this.top - 38, 'R₃', v3, i3, '#10b981', 3);
    } 
    else if (this.topology === 'parallel') {
      this.drawResistorGfx(this.cx - 140, this.cy, false, COLORS.r1);
      this.addValueBadge(this.cx - 140, this.cy - 50, 'R₁', v1, i1, '#f43f5e', 1);

      this.drawResistorGfx(this.cx, this.cy, false, COLORS.r2);
      this.addValueBadge(this.cx, this.cy - 50, 'R₂', v2, i2, '#3b82f6', 2);

      this.drawResistorGfx(this.cx + 140, this.cy, false, COLORS.r3);
      this.addValueBadge(this.cx + 140, this.cy - 50, 'R₃', v3, i3, '#10b981', 3);
    } 
    else if (this.topology === 'mixed' || this.topology === 'custom') {
      // Slot 1
      if (this.slot1 === 'resistor') {
        this.drawResistorGfx(this.cx - 140, this.top, true, COLORS.r1);
        this.addValueBadge(this.cx - 140, this.top - 38, 'R₁', v1, i1, '#f43f5e', 1);
      } else if (this.slot1 === 'wire') {
        this.wireGraphics.fillStyle(0x0a0e17, 1);
        this.wireGraphics.fillRect(this.cx - 140 - 22, this.top - 5, 44, 10);
        this.sceneGfx.lineStyle(4, COLORS.wire, 1);
        this.sceneGfx.lineBetween(this.cx - 140 - 22, this.top, this.cx - 140 + 22, this.top);
      }

      // Slot 2
      const s2 = this.getSlotCoords(2);
      if (this.slot2 === 'resistor') {
        this.drawResistorGfx(s2.x, s2.y, s2.isHorizontal, COLORS.r2);
        const badgeY = s2.isHorizontal ? s2.y - 38 : s2.y - 50;
        this.addValueBadge(s2.x, badgeY, 'R₂', v2, i2, '#3b82f6', 2);
      } else if (this.slot2 === 'wire') {
        this.wireGraphics.fillStyle(0x0a0e17, 1);
        if (s2.isHorizontal) {
          this.wireGraphics.fillRect(s2.x - 22, s2.y - 5, 44, 10);
          this.sceneGfx.lineStyle(4, COLORS.wire, 1);
          this.sceneGfx.lineBetween(s2.x - 22, s2.y, s2.x + 22, s2.y);
        } else {
          this.wireGraphics.fillRect(s2.x - 5, s2.y - 22, 10, 44);
          this.sceneGfx.lineStyle(4, COLORS.wire, 1);
          this.sceneGfx.lineBetween(s2.x, s2.y - 22, s2.x, s2.y + 22);
        }
      }

      // Slot 3
      const s3 = this.getSlotCoords(3);
      if (this.slot3 === 'resistor') {
        this.drawResistorGfx(s3.x, s3.y, s3.isHorizontal, COLORS.r3);
        const badgeX = s3.isHorizontal ? s3.x : s3.x - 58;
        const badgeY = s3.isHorizontal ? s3.y - 38 : s3.y - 60;
        this.addValueBadge(badgeX, badgeY, 'R₃', v3, i3, '#10b981', 3);
      } else if (this.slot3 === 'wire') {
        this.wireGraphics.fillStyle(0x0a0e17, 1);
        if (s3.isHorizontal) {
          this.wireGraphics.fillRect(s3.x - 22, s3.y - 5, 44, 10);
          this.sceneGfx.lineStyle(4, COLORS.wire, 1);
          this.sceneGfx.lineBetween(s3.x - 22, s3.y, s3.x + 22, s3.y);
        } else {
          this.wireGraphics.fillRect(s3.x - 5, s3.y - 22, 10, 44);
          this.sceneGfx.lineStyle(4, COLORS.wire, 1);
          this.sceneGfx.lineBetween(s3.x, s3.y - 22, s3.x, s3.y + 22);
        }
      }

      // Slot 4
      if (this.topology === 'custom') {
        const s4 = this.getSlotCoords(4);
        if (this.slot4 === 'resistor') {
          this.drawResistorGfx(s4.x, s4.y, s4.isHorizontal, COLORS.r4);
          const badgeY = s4.isHorizontal ? s4.y - 38 : s4.y - 50;
          this.addValueBadge(s4.x, badgeY, 'R₄', v4, i4, '#c084fc', 4);
        } else if (this.slot4 === 'wire') {
          this.wireGraphics.fillStyle(0x0a0e17, 1);
          if (s4.isHorizontal) {
            this.wireGraphics.fillRect(s4.x - 22, s4.y - 5, 44, 10);
            this.sceneGfx.lineStyle(4, COLORS.wire, 1);
            this.sceneGfx.lineBetween(s4.x - 22, s4.y, s4.x + 22, s4.y);
          } else {
            this.wireGraphics.fillRect(s4.x - 5, s4.y - 22, 10, 44);
            this.sceneGfx.lineStyle(4, COLORS.wire, 1);
            this.sceneGfx.lineBetween(s4.x, s4.y - 22, s4.x, s4.y + 22);
          }
        }
      }
    }
  }

  private getSlotCoords(id: number): { x: number, y: number, isHorizontal: boolean } {
    if (id === 1) {
      return { x: this.cx - 140, y: this.top, isHorizontal: true };
    }
    if (id === 2) {
      return this.slot2Orient === 'horizontal'
        ? { x: this.cx, y: this.top, isHorizontal: true }
        : { x: this.cx, y: this.cy, isHorizontal: false };
    }
    if (id === 4) {
      return this.slot4Orient === 'horizontal'
        ? { x: this.cx + 140, y: this.top, isHorizontal: true }
        : { x: this.cx + 140, y: this.cy, isHorizontal: false };
    }
    if (id === 3) {
      return this.slot3Orient === 'horizontal'
        ? { x: this.right - 70, y: this.top, isHorizontal: true }
        : { x: this.right, y: this.cy - 60, isHorizontal: false };
    }
    return { x: 0, y: 0, isHorizontal: false };
  }

  private findNearestSlotCandidate(wx: number, wy: number): { id: number, isHorizontal: boolean, distance: number } {
    const candidates = [
      { id: 1, x: this.cx - 140, y: this.top, isHorizontal: true },
      { id: 2, x: this.cx, y: this.cy, isHorizontal: false },
      { id: 2, x: this.cx, y: this.top, isHorizontal: true },
      { id: 4, x: this.cx + 140, y: this.cy, isHorizontal: false },
      { id: 4, x: this.cx + 140, y: this.top, isHorizontal: true },
      { id: 3, x: this.right, y: this.cy - 60, isHorizontal: false },
      { id: 3, x: this.right - 70, y: this.top, isHorizontal: true }
    ];

    let nearest = candidates[0];
    let minDist = Phaser.Math.Distance.Between(wx, wy, nearest.x, nearest.y);
    for (let i = 1; i < candidates.length; i++) {
      const d = Phaser.Math.Distance.Between(wx, wy, candidates[i].x, candidates[i].y);
      if (d < minDist) {
        minDist = d;
        nearest = candidates[i];
      }
    }
    return { id: nearest.id, isHorizontal: nearest.isHorizontal, distance: minDist };
  }

  private drawSlotIndicators() {
    const mouseWorld = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);

    // List all possible guidelines based on current slot states
    const guides: { id: number, x: number, y: number, w: number, h: number, name: string, state: string, isHorizontal: boolean }[] = [];

    // Slot 1: always horizontal
    if (this.slot1 !== 'resistor') {
      guides.push({ id: 1, x: this.cx - 140, y: this.top, w: 46, h: 22, name: 'R₁', state: this.slot1, isHorizontal: true });
    }

    // Slot 2:
    if (this.slot2 !== 'resistor') {
      if (this.slot2Orient === 'horizontal') {
        guides.push({ id: 2, x: this.cx, y: this.top, w: 46, h: 22, name: 'R₂', state: this.slot2, isHorizontal: true });
      } else {
        guides.push({ id: 2, x: this.cx, y: this.cy, w: 22, h: 46, name: 'R₂', state: this.slot2, isHorizontal: false });
      }
      if (this.slot2 === 'empty') {
        const altOrient = this.slot2Orient === 'horizontal' ? 'vertical' : 'horizontal';
        const altX = this.cx;
        const altY = altOrient === 'horizontal' ? this.top : this.cy;
        const altW = altOrient === 'horizontal' ? 46 : 22;
        const altH = altOrient === 'horizontal' ? 22 : 46;
        this.drawDashedRect(altX, altY, altW + 6, altH + 6, COLORS.slotGuide, 0.15);
      }
    }

    // Slot 4:
    if (this.slot4 !== 'resistor') {
      if (this.slot4Orient === 'horizontal') {
        guides.push({ id: 4, x: this.cx + 140, y: this.top, w: 46, h: 22, name: 'R₄', state: this.slot4, isHorizontal: true });
      } else {
        guides.push({ id: 4, x: this.cx + 140, y: this.cy, w: 22, h: 46, name: 'R₄', state: this.slot4, isHorizontal: false });
      }
      if (this.slot4 === 'empty') {
        const altOrient = this.slot4Orient === 'horizontal' ? 'vertical' : 'horizontal';
        const altX = this.cx + 140;
        const altY = altOrient === 'horizontal' ? this.top : this.cy;
        const altW = altOrient === 'horizontal' ? 46 : 22;
        const altH = altOrient === 'horizontal' ? 22 : 46;
        this.drawDashedRect(altX, altY, altW + 6, altH + 6, COLORS.slotGuide, 0.15);
      }
    }

    // Slot 3:
    if (this.slot3 !== 'resistor') {
      if (this.slot3Orient === 'horizontal') {
        guides.push({ id: 3, x: this.right - 70, y: this.top, w: 46, h: 22, name: 'R₃', state: this.slot3, isHorizontal: true });
      } else {
        guides.push({ id: 3, x: this.right, y: this.cy - 60, w: 22, h: 46, name: 'R₃', state: this.slot3, isHorizontal: false });
      }
      if (this.slot3 === 'empty') {
        const altOrient = this.slot3Orient === 'horizontal' ? 'vertical' : 'horizontal';
        const altX = altOrient === 'horizontal' ? this.right - 70 : this.right;
        const altY = altOrient === 'horizontal' ? this.top : this.cy - 60;
        const altW = altOrient === 'horizontal' ? 46 : 22;
        const altH = altOrient === 'horizontal' ? 22 : 46;
        this.drawDashedRect(altX, altY, altW + 6, altH + 6, COLORS.slotGuide, 0.15);
      }
    }

    guides.forEach(slot => {
      const dist = Phaser.Math.Distance.Between(mouseWorld.x, mouseWorld.y, slot.x, slot.y);
      const isHovered = dist < 45;
      const color = isHovered ? COLORS.slotHover : COLORS.slotGuide;
      const alpha = isHovered ? 0.95 : 0.45;

      // Draw outer dashed card
      this.drawDashedRect(slot.x, slot.y, slot.w + 6, slot.h + 6, color, alpha);

      // Fill container slightly
      this.sceneGfx.fillStyle(color, isHovered ? 0.12 : 0.04);
      this.sceneGfx.fillRect(slot.x - slot.w/2 - 2, slot.y - slot.h/2 - 2, slot.w + 4, slot.h + 4);

      // Draw central plus (+) symbol
      this.sceneGfx.lineStyle(2, color, alpha);
      this.sceneGfx.lineBetween(slot.x - 4, slot.y, slot.x + 4, slot.y);
      this.sceneGfx.lineBetween(slot.x, slot.y - 4, slot.x, slot.y + 4);

      if (isHovered) {
        const modeLabel = slot.state === 'wire' ? 'Cable' : 'Vacío';
        this.sceneGfx.fillStyle(color, 1);
        const yOff = (slot.id === 1 || slot.isHorizontal) ? 24 : 36;
        
        this.valueLabels.push({
          dom: this.add.dom(slot.x, slot.y + yOff).createFromHTML(`
            <div style="
              font-family: 'Inter', sans-serif;
              font-size: 9px;
              color: #818cf8;
              background: rgba(15,23,42,0.9);
              border: 1px solid rgba(129,140,248,0.2);
              border-radius: 4px;
              padding: 2px 5px;
              white-space: nowrap;
              pointer-events: none;
            ">
              R${slot.id} (${modeLabel}) - Click derecho
            </div>
          `),
          x: slot.x,
          y: slot.y + yOff,
          slot: slot.id
        });
        this.valueLabels[this.valueLabels.length - 1].dom.setVisible(true);
      }
    });
  }

  private drawElectrons() {
    this.electrons.forEach(e => {
      const nodes = this.getNodesForPath(e.pathIndex);
      const pos = this.getPointOnPath(e.distance, nodes);

      this.glowGraphics.fillStyle(COLORS.electronGlow, 0.35);
      this.glowGraphics.fillCircle(pos.x, pos.y, 7.5);

      this.glowGraphics.fillStyle(COLORS.electron, 1);
      this.glowGraphics.fillCircle(pos.x, pos.y, 4);
    });
  }

  private drawDashedRect(x: number, y: number, w: number, h: number, color: number, alpha: number) {
    const gfx = this.sceneGfx;
    gfx.lineStyle(1.5, color, alpha);
    const dashLen = 6;
    const gapLen = 4;
    
    // Top edge
    let currX = x - w/2;
    while (currX < x + w/2) {
      gfx.lineBetween(currX, y - h/2, Math.min(currX + dashLen, x + w/2), y - h/2);
      currX += dashLen + gapLen;
    }
    // Bottom edge
    currX = x - w/2;
    while (currX < x + w/2) {
      gfx.lineBetween(currX, y + h/2, Math.min(currX + dashLen, x + w/2), y + h/2);
      currX += dashLen + gapLen;
    }
    // Left edge
    let currY = y - h/2;
    while (currY < y + h/2) {
      gfx.lineBetween(x - w/2, currY, x - w/2, Math.min(currY + dashLen, y + h/2));
      currY += dashLen + gapLen;
    }
    // Right edge
    currY = y - h/2;
    while (currY < y + h/2) {
      gfx.lineBetween(x + w/2, currY, x + w/2, Math.min(currY + dashLen, y + h/2));
      currY += dashLen + gapLen;
    }
  }

  private getEffR(slot: 'resistor' | 'wire' | 'empty', val: number) {
    if (slot === 'wire') return 0.0001;
    if (slot === 'empty') return 1e9;
    return val;
  }

  private solveNetwork() {
    let req = 0;
    let it = 0;
    let i1 = 0, i2 = 0, i3 = 0, i4 = 0;
    let v1 = 0, v2 = 0, v3 = 0, v4 = 0;

    if (!this.isOpen) {
      if (this.topology === 'series') {
        req = this.r1 + this.r2 + this.r3;
        it = this.voltage / req;
        i1 = i2 = i3 = it;
        v1 = it * this.r1;
        v2 = it * this.r2;
        v3 = it * this.r3;
      } else if (this.topology === 'parallel') {
        req = 1 / (1/this.r1 + 1/this.r2 + 1/this.r3);
        it = this.voltage / req;
        v1 = v2 = v3 = this.voltage;
        i1 = this.voltage / this.r1;
        i2 = this.voltage / this.r2;
        i3 = this.voltage / this.r3;
      } else if (this.topology === 'mixed' || this.topology === 'custom') {
        const R1_eff = this.getEffR(this.slot1, this.r1);
        const R2_eff = this.getEffR(this.slot2, this.r2);
        const R3_eff = this.getEffR(this.slot3, this.r3);
        const R4_eff = this.getEffR(this.slot4, this.r4);

        const G2 = 1 / R2_eff;
        const G3 = 1 / R3_eff;
        const G4 = 1 / R4_eff;
        const Gp = G2 + G3 + G4;
        const Rp = Gp === 0 ? 1e9 : 1 / Gp;

        req = R1_eff + Rp;
        if (req < 0.1) req = 0.1;

        it = this.voltage / req;
        v1 = it * R1_eff;
        v2 = v3 = v4 = Math.max(0, this.voltage - v1);
        
        i1 = it;
        i2 = this.slot2 === 'empty' ? 0 : v2 / R2_eff;
        i3 = this.slot3 === 'empty' ? 0 : v3 / R3_eff;
        i4 = this.slot4 === 'empty' ? 0 : v4 / R4_eff;
      }
    }

    return { req, it, i1, i2, i3, i4, v1, v2, v3, v4 };
  }

  private getNodesForPath(pIdx: number): PathNode[] {
    const nodes: PathNode[] = [];
    const battery = { x: this.cx, y: this.bottom };
    const bottomLeft = { x: this.left, y: this.bottom };
    const topLeft = { x: this.left, y: this.top };
    const topRight = { x: this.right, y: this.top };
    const bottomRight = { x: this.right, y: this.bottom };

    if (this.topology === 'series') {
      return [battery, bottomLeft, topLeft, topRight, bottomRight, battery];
    } 
    
    if (this.topology === 'parallel') {
      const branchX = pIdx === 0 ? this.cx - 140 : pIdx === 1 ? this.cx : this.cx + 140;
      return [
        battery,
        bottomLeft,
        topLeft,
        { x: branchX, y: this.top },
        { x: branchX, y: this.bottom },
        battery
      ];
    } 
    
    // Mixed and Custom routing
    if (pIdx === 1) { 
      return [
        battery,
        bottomLeft,
        topLeft,
        { x: this.cx, y: this.top },
        { x: this.cx, y: this.bottom },
        battery
      ];
    } else if (pIdx === 2) { 
      return [
        battery,
        bottomLeft,
        topLeft,
        topRight,
        bottomRight,
        battery
      ];
    } else if (pIdx === 3) { 
      return [
        battery,
        bottomLeft,
        topLeft,
        { x: this.cx + 140, y: this.top },
        { x: this.cx + 140, y: this.bottom },
        battery
      ];
    }

    return [battery, battery];
  }

  private getPathLength(path: PathNode[]): number {
    let len = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i+1].x - path[i].x;
      const dy = path[i+1].y - path[i].y;
      len += Math.sqrt(dx*dx + dy*dy);
    }
    return len;
  }

  private getPointOnPath(dist: number, path: PathNode[]): PathNode {
    let d = dist;
    for (let i = 0; i < path.length - 1; i++) {
      const p1 = path[i];
      const p2 = path[i+1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx*dx + dy*dy);

      if (d <= segLen) {
        const ratio = d / segLen;
        return {
          x: p1.x + dx * ratio,
          y: p1.y + dy * ratio
        };
      }
      d -= segLen;
    }
    return path[path.length - 1];
  }
}
