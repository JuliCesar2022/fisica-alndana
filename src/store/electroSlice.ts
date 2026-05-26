import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PointChargeState {
  id: string;
  charge: number;
  isStatic: boolean;
  x: number;
  y: number;
  z: number;
}

interface ElectroState {
  charges: PointChargeState[];
  selectedChargeId: string | null;
  isPlaying: boolean;
  netForce: number | null; // Selected charge net force
  vacuumMode: boolean;
}

const initialState: ElectroState = {
  charges: [
    { id: 'charge_1', charge: 5, isStatic: false, x: -120, y: 24, z: 0 },
    { id: 'charge_2', charge: -5, isStatic: false, x: 120, y: 24, z: 0 },
  ],
  selectedChargeId: null,
  isPlaying: false,
  netForce: null,
  vacuumMode: false
};

export const electroSlice = createSlice({
  name: 'electrostatics',
  initialState,
  reducers: {
    setPlaying: (state, action: PayloadAction<boolean>) => { state.isPlaying = action.payload; },
    setSelectedCharge: (state, action: PayloadAction<string | null>) => { state.selectedChargeId = action.payload; },
    setVacuumMode: (state, action: PayloadAction<boolean>) => { state.vacuumMode = action.payload; },
    
    // UI dispatches this, then Phaser reads and updates its engine
    updateChargeValue: (state, action: PayloadAction<{ id: string, charge: number }>) => {
      const c = state.charges.find(ch => ch.id === action.payload.id);
      if (c) c.charge = action.payload.charge;
    },
    
    // Phaser/R3F dispatches this so React can show the list/formula correctly
    syncChargesFromEngine: (state, action: PayloadAction<PointChargeState[]>) => {
      state.charges = action.payload;
    },
    
    // Phaser/R3F dispatches this on update() so React formula panel can display the net force
    updateNetForce: (state, action: PayloadAction<number | null>) => {
      state.netForce = action.payload;
    },

    // Dynamic React/Redux charge modifiers
    addCharge: (state, action: PayloadAction<{ charge: number; x: number; y: number; z?: number; isStatic?: boolean }>) => {
      const id = `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      state.charges.push({
        id,
        charge: action.payload.charge,
        isStatic: action.payload.isStatic ?? false,
        x: action.payload.x,
        y: action.payload.y,
        z: action.payload.z ?? 0,
      });
    },

    moveCharge: (state, action: PayloadAction<{ id: string, x: number, y: number, z: number }>) => {
      const c = state.charges.find(ch => ch.id === action.payload.id);
      if (c) {
        c.x = action.payload.x;
        c.y = action.payload.y;
        c.z = action.payload.z;
      }
    },

    toggleStatic: (state, action: PayloadAction<string>) => {
      const c = state.charges.find(ch => ch.id === action.payload);
      if (c) c.isStatic = !c.isStatic;
    },

    deleteCharge: (state, action: PayloadAction<string>) => {
      state.charges = state.charges.filter(ch => ch.id !== action.payload);
      if (state.selectedChargeId === action.payload) {
        state.selectedChargeId = null;
      }
    },

    resetCharges: (state) => {
      state.charges = [
        { id: 'charge_1', charge: 5, isStatic: false, x: -120, y: 24, z: 0 },
        { id: 'charge_2', charge: -5, isStatic: false, x: 120, y: 24, z: 0 },
      ];
      state.selectedChargeId = null;
      state.isPlaying = false;
      state.netForce = null;
    }
  }
});

export const { 
  setPlaying, 
  setSelectedCharge, 
  setVacuumMode,
  updateChargeValue, 
  syncChargesFromEngine, 
  updateNetForce,
  addCharge,
  moveCharge,
  toggleStatic,
  deleteCharge,
  resetCharges
} = electroSlice.actions;

export default electroSlice.reducer;
