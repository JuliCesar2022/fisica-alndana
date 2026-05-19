import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PHYSICS_DEFAULTS } from '../utils/constants';

interface RampState {
  angle: number;
  mass: number;
  gravity: number;
  material: string;
  isPlaying: boolean;
  customFriction: number;
  customMaterialName: string;
  
  // Results from physics engine
  forces: {
    weight: number;
    normalForce: number;
    parallelForce: number;
    frictionForce: number;
    netForce: number;
    acceleration: number;
  };
  state: {
    time: number;
    velocity: number;
    position: number;
    height: number;
    kineticEnergy: number;
    potentialEnergy: number;
    totalEnergy: number;
  };
}

const initialState: RampState = {
  angle: PHYSICS_DEFAULTS.angle,
  mass: PHYSICS_DEFAULTS.mass,
  gravity: PHYSICS_DEFAULTS.gravity,
  material: PHYSICS_DEFAULTS.material,
  isPlaying: false,
  customFriction: 0.25,
  customMaterialName: 'Mi Material',
  
  forces: {
    weight: 0, normalForce: 0, parallelForce: 0, frictionForce: 0, netForce: 0, acceleration: 0
  },
  state: {
    time: 0, velocity: 0, position: 0, height: 0, kineticEnergy: 0, potentialEnergy: 0, totalEnergy: 0
  }
};

export const rampSlice = createSlice({
  name: 'ramp',
  initialState,
  reducers: {
    setAngle: (state, action: PayloadAction<number>) => { state.angle = action.payload; },
    setMass: (state, action: PayloadAction<number>) => { state.mass = action.payload; },
    setGravity: (state, action: PayloadAction<number>) => { state.gravity = action.payload; },
    setMaterial: (state, action: PayloadAction<string>) => { state.material = action.payload; },
    setPlaying: (state, action: PayloadAction<boolean>) => { state.isPlaying = action.payload; },
    setCustomFriction: (state, action: PayloadAction<number>) => { state.customFriction = action.payload; },
    setCustomMaterialName: (state, action: PayloadAction<string>) => { state.customMaterialName = action.payload; },
    
    updatePhysicsData: (state, action: PayloadAction<{forces: RampState['forces'], state: RampState['state']}>) => {
      state.forces = action.payload.forces;
      state.state = action.payload.state;
    }
  }
});

export const { setAngle, setMass, setGravity, setMaterial, setPlaying, setCustomFriction, setCustomMaterialName, updatePhysicsData } = rampSlice.actions;
export default rampSlice.reducer;
