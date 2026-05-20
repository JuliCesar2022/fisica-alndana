import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FreeFallState {
  height: number;      // initial height (m)
  mass: number;        // object mass (kg)
  gravity: number;     // m/s^2
  planet: 'earth' | 'moon' | 'mars' | 'jupiter' | 'custom';
  isPlaying: boolean;
  
  // Real-time physics data
  state: {
    time: number;           // seconds
    y: number;              // current height from ground (m)
    velocity: number;       // current velocity (m/s) downward
    kineticEnergy: number;  // Joules
    potentialEnergy: number;// Joules
    totalEnergy: number;    // Joules
  };
}

const initialState: FreeFallState = {
  height: 100, // default 100m
  mass: 2.0,   // default 2kg
  gravity: 9.81, // Earth
  planet: 'earth',
  isPlaying: false,
  state: {
    time: 0,
    y: 100,
    velocity: 0,
    kineticEnergy: 0,
    potentialEnergy: 2.0 * 9.81 * 100,
    totalEnergy: 2.0 * 9.81 * 100
  }
};

const freeFallSlice = createSlice({
  name: 'freefall',
  initialState,
  reducers: {
    setHeight: (state, action: PayloadAction<number>) => { state.height = action.payload; },
    setMass: (state, action: PayloadAction<number>) => { state.mass = action.payload; },
    setGravity: (state, action: PayloadAction<number>) => { 
      state.gravity = action.payload; 
      state.planet = 'custom';
    },
    setPlanet: (state, action: PayloadAction<FreeFallState['planet']>) => {
      state.planet = action.payload;
      if (action.payload === 'earth') state.gravity = 9.81;
      else if (action.payload === 'moon') state.gravity = 1.62;
      else if (action.payload === 'mars') state.gravity = 3.71;
      else if (action.payload === 'jupiter') state.gravity = 24.79;
    },
    setPlaying: (state, action: PayloadAction<boolean>) => { state.isPlaying = action.payload; },
    updatePhysicsData: (state, action: PayloadAction<FreeFallState['state']>) => {
      state.state = action.payload;
    }
  }
});

export const { setHeight, setMass, setGravity, setPlanet, setPlaying, updatePhysicsData } = freeFallSlice.actions;
export default freeFallSlice.reducer;
