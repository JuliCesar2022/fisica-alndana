import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CircuitTopology = 'series' | 'parallel' | 'mixed' | 'custom';
export type SlotState = 'resistor' | 'wire' | 'empty';
export type CircuitTool = 'pan' | 'resistor' | 'wire' | 'eraser';
export type SlotOrientation = 'horizontal' | 'vertical';

export interface DraggedComponent {
  type: 'resistor' | 'wire';
  angle: number; // 0 for horizontal, 90 for vertical
}

interface CircuitState {
  voltage: number;      // in Volts (1 to 30)
  r1: number;           // R1 in Ohms (10 to 1000)
  r2: number;           // R2 in Ohms (10 to 1000)
  r3: number;           // R3 in Ohms (10 to 1000)
  r4: number;           // R4 in Ohms (10 to 1000)
  isOpen: boolean;      // true if switch is open (no current)
  topology: CircuitTopology;
  slot1: SlotState;     
  slot2: SlotState;     
  slot3: SlotState;     
  slot4: SlotState;     
  slot2Orient: SlotOrientation;
  slot3Orient: SlotOrientation;
  slot4Orient: SlotOrientation;
  activeTool: CircuitTool; // Miro-style toolbar tool ('pan', 'resistor', 'wire', 'eraser')
  draggedComponent: DraggedComponent | null; // Component currently being dragged
}

const initialState: CircuitState = {
  voltage: 12,
  r1: 100,
  r2: 200,
  r3: 200,
  r4: 200,
  isOpen: false,
  topology: 'series',
  slot1: 'resistor',
  slot2: 'resistor',
  slot3: 'resistor',
  slot4: 'empty',
  slot2Orient: 'vertical',
  slot3Orient: 'vertical',
  slot4Orient: 'vertical',
  activeTool: 'pan',
  draggedComponent: null
};

export const circuitSlice = createSlice({
  name: 'circuit',
  initialState,
  reducers: {
    setVoltage: (state, action: PayloadAction<number>) => {
      state.voltage = action.payload;
    },
    setR1: (state, action: PayloadAction<number>) => {
      state.r1 = action.payload;
    },
    setR2: (state, action: PayloadAction<number>) => {
      state.r2 = action.payload;
    },
    setR3: (state, action: PayloadAction<number>) => {
      state.r3 = action.payload;
    },
    setR4: (state, action: PayloadAction<number>) => {
      state.r4 = action.payload;
    },
    setOpen: (state, action: PayloadAction<boolean>) => {
      state.isOpen = action.payload;
    },
    setTopology: (state, action: PayloadAction<CircuitTopology>) => {
      state.topology = action.payload;
      state.slot1 = 'resistor';
      state.slot2 = 'resistor';
      state.slot3 = 'resistor';
      state.slot4 = 'empty';
      state.slot2Orient = 'vertical';
      state.slot3Orient = 'vertical';
      state.slot4Orient = 'vertical';
      state.activeTool = 'pan';
      state.draggedComponent = null;
    },
    setSlot1State: (state, action: PayloadAction<SlotState>) => {
      state.slot1 = action.payload;
    },
    setSlot2State: (state, action: PayloadAction<SlotState>) => {
      state.slot2 = action.payload;
    },
    setSlot3State: (state, action: PayloadAction<SlotState>) => {
      state.slot3 = action.payload;
    },
    setSlot4State: (state, action: PayloadAction<SlotState>) => {
      state.slot4 = action.payload;
    },
    setSlot2Orient: (state, action: PayloadAction<SlotOrientation>) => {
      state.slot2Orient = action.payload;
    },
    setSlot3Orient: (state, action: PayloadAction<SlotOrientation>) => {
      state.slot3Orient = action.payload;
    },
    setSlot4Orient: (state, action: PayloadAction<SlotOrientation>) => {
      state.slot4Orient = action.payload;
    },
    setActiveTool: (state, action: PayloadAction<CircuitTool>) => {
      state.activeTool = action.payload;
    },
    setDraggedComponent: (state, action: PayloadAction<DraggedComponent | null>) => {
      state.draggedComponent = action.payload;
    },
    rotateDraggedComponent: (state) => {
      if (state.draggedComponent) {
        state.draggedComponent.angle = state.draggedComponent.angle === 0 ? 90 : 0;
      }
    }
  }
});

export const { 
  setVoltage, 
  setR1, 
  setR2, 
  setR3, 
  setR4,
  setOpen, 
  setTopology,
  setSlot1State,
  setSlot2State,
  setSlot3State,
  setSlot4State,
  setSlot2Orient,
  setSlot3Orient,
  setSlot4Orient,
  setActiveTool,
  setDraggedComponent,
  rotateDraggedComponent
} = circuitSlice.actions;

export default circuitSlice.reducer;
