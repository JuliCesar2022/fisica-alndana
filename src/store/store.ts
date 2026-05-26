import { configureStore } from '@reduxjs/toolkit';
import rampReducer from './rampSlice';
import electroReducer from './electroSlice';
import circuitReducer from './circuitSlice';
import freeFallReducer from './freeFallSlice';
import collisionReducer from './collisionSlice';
import pendulumReducer from './pendulumSlice';

export const store = configureStore({
  reducer: {
    ramp: rampReducer,
    electrostatics: electroReducer,
    circuit: circuitReducer,
    freefall: freeFallReducer,
    collision: collisionReducer,
    pendulum: pendulumReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
