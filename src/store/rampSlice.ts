import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PHYSICS_DEFAULTS } from '../utils/constants';

export type RampScene = 'lab' | 'mountain' | 'moon';

interface RampState {
  angle: number;
  mass: number;
  gravity: number;
  material: string;
  isPlaying: boolean;
  customFriction: number;
  customMaterialName: string;
  rampLength: number;
  sensorDistances: number[];
  scene: RampScene;
  
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
    onRamp: boolean;
    onGround: boolean;
    sensorTimes: (number | null)[];
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
  rampLength: PHYSICS_DEFAULTS.rampLength,
  sensorDistances: PHYSICS_DEFAULTS.sensorDistances,
  scene: 'lab',
  
  forces: {
    weight: 0, normalForce: 0, parallelForce: 0, frictionForce: 0, netForce: 0, acceleration: 0
  },
  state: {
    time: 0, velocity: 0, position: 0, height: 0, kineticEnergy: 0, potentialEnergy: 0, totalEnergy: 0,
    onRamp: true, onGround: false,
    sensorTimes: Array(PHYSICS_DEFAULTS.sensorDistances.length).fill(null)
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
    setRampLength: (state, action: PayloadAction<number>) => { 
      const newLength = action.payload;
      const oldLength = state.rampLength;
      state.rampLength = newLength;
      
      // Adapt sensor positions proportionally to the new ramp length
      if (oldLength > 0) {
        const scale = newLength / oldLength;
        state.sensorDistances = state.sensorDistances.map(d => Number((d * scale).toFixed(4)));
      }
    },
    updateSensorDistance: (state, action: PayloadAction<{index: number, distance: number}>) => {
      let d = action.payload.distance;
      if (d < 0) d = 0;
      if (d > state.rampLength) d = state.rampLength;
      state.sensorDistances[action.payload.index] = d;
    },
    addSensor: (state) => {
      // Add a new sensor near the end of the ramp
      let d = state.rampLength * 0.9;
      // Make sure it doesn't strictly overlap the last one perfectly
      if (state.sensorDistances.length > 0) {
        const last = state.sensorDistances[state.sensorDistances.length - 1];
        if (Math.abs(d - last) < 0.05) {
          d = Math.max(0, last - 0.1);
        }
      }
      state.sensorDistances.push(Number(d.toFixed(4)));
      state.state.sensorTimes.push(null);
    },
    removeSensor: (state, action: PayloadAction<number>) => {
      if (state.sensorDistances.length > 1) {
        state.sensorDistances.splice(action.payload, 1);
        state.state.sensorTimes.splice(action.payload, 1);
      }
    },
    
    updatePhysicsData: (state, action: PayloadAction<{forces: RampState['forces'], state: RampState['state']}>) => {
      state.forces = action.payload.forces;
      state.state = action.payload.state;
    },
    setRampScene: (state, action: PayloadAction<RampScene>) => { state.scene = action.payload; },
    resetSimState: (state) => {
      state.isPlaying = false;
      state.forces = { weight: 0, normalForce: 0, parallelForce: 0, frictionForce: 0, netForce: 0, acceleration: 0 };
      state.state = {
        time: 0, velocity: 0, position: 0, height: 0,
        kineticEnergy: 0, potentialEnergy: 0, totalEnergy: 0,
        onRamp: true, onGround: false,
        sensorTimes: Array(state.sensorDistances.length).fill(null),
      };
    }
  }
});

export const { setAngle, setMass, setGravity, setMaterial, setPlaying, setCustomFriction, setCustomMaterialName, setRampLength, updateSensorDistance, addSensor, removeSensor, updatePhysicsData, resetSimState, setRampScene } = rampSlice.actions;
export default rampSlice.reducer;
