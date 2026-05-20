import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setHeight, setMass, setGravity, setPlanet, setPlaying } from '../../store/freeFallSlice';
import { ArrowDownToLine, Weight, Globe, Play, Pause, RotateCcw, SlidersHorizontal } from 'lucide-react';

export const EVENT_RESET_FREEFALL = 'evt_reset_freefall';

export default function FreeFallPanel() {
  const dispatch = useDispatch();
  const state = useSelector((root: RootState) => root.freefall);
  const [collapsed, setCollapsed] = useState(false);

  const presets: { name: string; key: 'earth' | 'moon' | 'mars' | 'jupiter'; g: number }[] = [
    { name: 'Tierra', key: 'earth', g: 9.81 },
    { name: 'Luna', key: 'moon', g: 1.62 },
    { name: 'Marte', key: 'mars', g: 3.71 },
    { name: 'Júpiter', key: 'jupiter', g: 24.79 },
  ];

  return (
    <aside className={`panel glass-panel ${collapsed ? 'collapsed' : ''}`} style={{ position: 'absolute', zIndex: 10, right: '20px', top: '80px' }}>
      <div className="panel-header">
        <h2><SlidersHorizontal size={16} /> Controles</h2>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '+' : '−'}
        </button>
      </div>
      
      {!collapsed && (
        <div className="panel-content">
          <div className="control-group">
            <div className="control-label">
              <span><ArrowDownToLine size={14} /> Altura (h)</span>
              <span className="control-value">{state.height} m</span>
            </div>
            <input 
              type="range" min="10" max="500" step="5" 
              value={state.height} 
              onChange={(e) => {
                dispatch(setHeight(Number(e.target.value)));
                if (!state.isPlaying) window.dispatchEvent(new Event(EVENT_RESET_FREEFALL));
              }} 
            />
          </div>

          <div className="control-group">
            <div className="control-label">
              <span><Weight size={14} /> Masa (m)</span>
              <span className="control-value">{state.mass} kg</span>
            </div>
            <input 
              type="range" min="0.1" max="100" step="0.1" 
              value={state.mass} 
              onChange={(e) => dispatch(setMass(Number(e.target.value)))} 
            />
          </div>

          <div className="control-group">
            <div className="control-label">
              <span><Globe size={14} /> Gravedad (g)</span>
              <span className="control-value">{state.gravity} m/s²</span>
            </div>
            <input 
              type="range" min="0.1" max="30" step="0.1" 
              value={state.gravity} 
              onChange={(e) => dispatch(setGravity(Number(e.target.value)))} 
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '8px' }}>
              {presets.map(p => (
                <button
                  key={p.name}
                  onClick={() => dispatch(setPlanet(p.key))}
                  style={{
                    background: state.planet === p.key ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${state.planet === p.key ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                    color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="simulation-controls" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button 
              className={`btn-primary ${state.isPlaying ? 'btn-danger' : 'btn-success'}`} 
              onClick={() => dispatch(setPlaying(!state.isPlaying))}
              style={{ flex: 1 }}
            >
              {state.isPlaying ? <><Pause size={16} /> Pausa</> : <><Play size={16} /> Play</>}
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => {
                dispatch(setPlaying(false));
                window.dispatchEvent(new Event(EVENT_RESET_FREEFALL));
              }}
              style={{ flex: 1 }}
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
