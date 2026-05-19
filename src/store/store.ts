import { configureStore } from '@reduxjs/toolkit';
import rampReducer from './rampSlice';
import electroReducer from './electroSlice';
import circuitReducer from './circuitSlice';

export const store = configureStore({
  reducer: {
    ramp: rampReducer,
    electrostatics: electroReducer,
    circuit: circuitReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
