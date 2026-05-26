import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type PendulumScene = 'lab' | 'moon' | 'water';

export interface PendulumPhysicsState {
  time: number;
  angle: number;
  angularVelocity: number;
  velocity: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  period: number;
  oscillations: number;
}

export interface PendulumState {
  length: number;
  mass: number;
  gravity: number;
  initialAngle: number;
  damping: number;
  isPlaying: boolean;
  scene: PendulumScene;
  state: PendulumPhysicsState;
}

const makeInitPhysics = (angle: number, mass: number, gravity: number, length: number): PendulumPhysicsState => {
  const theta = (angle * Math.PI) / 180;
  const pe = mass * gravity * length * (1 - Math.cos(theta));
  return {
    time: 0, angle: theta, angularVelocity: 0, velocity: 0,
    kineticEnergy: 0, potentialEnergy: pe, totalEnergy: pe,
    period: 0, oscillations: 0,
  };
};

const initialState: PendulumState = {
  length: 2.0,
  mass: 1.0,
  gravity: 9.81,
  initialAngle: 30,
  damping: 0.0,
  isPlaying: false,
  scene: 'lab',
  state: makeInitPhysics(30, 1.0, 9.81, 2.0),
};

const pendulumSlice = createSlice({
  name: 'pendulum',
  initialState,
  reducers: {
    setLength: (state, action: PayloadAction<number>) => { state.length = action.payload; },
    setMass: (state, action: PayloadAction<number>) => { state.mass = action.payload; },
    setGravity: (state, action: PayloadAction<number>) => { state.gravity = action.payload; },
    setInitialAngle: (state, action: PayloadAction<number>) => { state.initialAngle = action.payload; },
    setDamping: (state, action: PayloadAction<number>) => { state.damping = action.payload; },
    setPlaying: (state, action: PayloadAction<boolean>) => { state.isPlaying = action.payload; },
    setPendulumScene: (state, action: PayloadAction<PendulumScene>) => { state.scene = action.payload; },
    updatePendulumState: (state, action: PayloadAction<PendulumPhysicsState>) => {
      state.state = action.payload;
    },
    resetPendulum: (state) => {
      state.isPlaying = false;
      state.state = makeInitPhysics(state.initialAngle, state.mass, state.gravity, state.length);
    },
  },
});

export const {
  setLength, setMass, setGravity, setInitialAngle, setDamping,
  setPlaying, setPendulumScene, updatePendulumState, resetPendulum,
} = pendulumSlice.actions;
export default pendulumSlice.reducer;
