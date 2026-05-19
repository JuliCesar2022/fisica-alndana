import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PointChargeState {
  id: string;
  charge: number;
  isStatic: boolean;
  x: number;
  y: number;
}

interface ElectroState {
  charges: PointChargeState[];
  selectedChargeId: string | null;
  isPlaying: boolean;
  netForce: number | null; // Selected charge net force
  vacuumMode: boolean;
}

const initialState: ElectroState = {
  charges: [],
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
    
    // Phaser dispatches this so React can show the list/formula correctly
    syncChargesFromEngine: (state, action: PayloadAction<PointChargeState[]>) => {
      state.charges = action.payload;
    },
    
    // Phaser dispatches this on update() so React formula panel can display the net force
    updateNetForce: (state, action: PayloadAction<number | null>) => {
      state.netForce = action.payload;
    }
  }
});

export const { 
  setPlaying, 
  setSelectedCharge, 
  setVacuumMode,
  updateChargeValue, 
  syncChargesFromEngine, 
  updateNetForce 
} = electroSlice.actions;

export default electroSlice.reducer;
