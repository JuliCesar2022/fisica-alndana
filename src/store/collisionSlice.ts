import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CollisionType = 'elastic' | 'inelastic' | 'partial';
export type CollisionScene = 'space' | 'ice' | 'billiard';

export interface CollisionResults {
  v1After: number;
  v2After: number;
  pBefore: number;
  pAfter: number;
  keBefore: number;
  keAfter: number;
  keLost: number;
  impulse: number;
}

export interface CollisionState {
  m1: number;
  m2: number;
  v1: number;
  v2: number;
  restitution: number;
  collisionType: CollisionType;
  isPlaying: boolean;
  results: CollisionResults | null;
  simTime: number;
  scene: CollisionScene;
}

const initialState: CollisionState = {
  m1: 2.0,
  m2: 1.0,
  v1: 3.0,
  v2: 0.0,
  restitution: 1.0,
  collisionType: 'elastic',
  isPlaying: false,
  results: null,
  simTime: 0,
  scene: 'space',
};

const collisionSlice = createSlice({
  name: 'collision',
  initialState,
  reducers: {
    setM1: (state, action: PayloadAction<number>) => { state.m1 = action.payload; },
    setM2: (state, action: PayloadAction<number>) => { state.m2 = action.payload; },
    setV1: (state, action: PayloadAction<number>) => { state.v1 = action.payload; },
    setV2: (state, action: PayloadAction<number>) => { state.v2 = action.payload; },
    setRestitution: (state, action: PayloadAction<number>) => { state.restitution = action.payload; },
    setCollisionType: (state, action: PayloadAction<CollisionType>) => {
      state.collisionType = action.payload;
      if (action.payload === 'elastic') state.restitution = 1.0;
      else if (action.payload === 'inelastic') state.restitution = 0.0;
      else state.restitution = 0.6;
    },
    setPlaying: (state, action: PayloadAction<boolean>) => { state.isPlaying = action.payload; },
    setResults: (state, action: PayloadAction<CollisionResults>) => {
      state.results = action.payload;
    },
    setSimTime: (state, action: PayloadAction<number>) => { state.simTime = action.payload; },
    resetSim: (state) => {
      state.isPlaying = false;
      state.results = null;
      state.simTime = 0;
    },
    setCollisionScene: (state, action: PayloadAction<CollisionScene>) => { state.scene = action.payload; },
  },
});

export const {
  setM1, setM2, setV1, setV2,
  setRestitution, setCollisionType,
  setPlaying, setResults, setSimTime, resetSim,
  setCollisionScene,
} = collisionSlice.actions;
export default collisionSlice.reducer;
