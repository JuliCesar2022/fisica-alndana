import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setAngle, setMass, setGravity, setMaterial, setPlaying, setCustomFriction, setCustomMaterialName, setRampLength, updateSensorDistance } from '../../store/rampSlice';
import { MATERIALS } from '../../utils/constants';
import { Triangle, Weight, Globe, Layers, Play, Pause, RotateCcw, StepForward, SlidersHorizontal, Edit2, Ruler, Target } from 'lucide-react';

export const EVENT_RESET_RAMP = 'evt_reset_ramp';

export default function RampPanel() {
  const dispatch = useDispatch();
  const rampState = useSelector((state: RootState) => state.ramp);
  const [collapsed, setCollapsed] = useState(false);

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
              <span><Triangle size={14} /> Ángulo (θ)</span>
              <span className="control-value">{rampState.angle}°</span>
            </div>
            <input type="range" min="5" max="80" step="1" value={rampState.angle} onChange={(e) => dispatch(setAngle(Number(e.target.value)))} />
          </div>

          <div className="control-group">
            <div className="control-label">
              <span><Weight size={14} /> Masa (m)</span>
              <span className="control-value">{rampState.mass} kg</span>
            </div>
            <input type="range" min="0.5" max="50" step="0.5" value={rampState.mass} onChange={(e) => dispatch(setMass(Number(e.target.value)))} />
          </div>

          <div className="control-group">
            <div className="control-label">
              <span><Globe size={14} /> Gravedad (g)</span>
              <span className="control-value">{rampState.gravity} m/s²</span>
            </div>
            <input type="range" min="1" max="25" step="0.1" value={rampState.gravity} onChange={(e) => dispatch(setGravity(Number(e.target.value)))} />
          </div>

          <div className="control-group">
            <div className="control-label">
              <span><Layers size={14} /> Material</span>
              <span className="control-value">
                μ = {rampState.material === 'custom' ? rampState.customFriction.toFixed(2) : MATERIALS[rampState.material].frictionKinetic}
              </span>
            </div>
            <div className="material-grid">
              {Object.entries(MATERIALS).map(([key, mat]) => (
                <button 
                  key={key} 
                  className={`material-btn ${key === rampState.material ? 'active' : ''}`}
                  onClick={() => dispatch(setMaterial(key))}
                >
                  <span className="material-icon">
                    {/* Presets */}
                  </span>
                  {mat.name}
                  <span className="material-mu">μ={mat.frictionKinetic}</span>
                </button>
              ))}
              <button 
                className={`material-btn ${rampState.material === 'custom' ? 'active' : ''}`}
                onClick={() => dispatch(setMaterial('custom'))}
                style={{ borderColor: rampState.material === 'custom' ? '#ec4899' : '' }}
              >
                Personalizado
                <span className="material-mu" style={{ color: rampState.material === 'custom' ? '#ec4899' : '' }}>
                  μ={rampState.customFriction.toFixed(2)}
                </span>
              </button>
            </div>

            {rampState.material === 'custom' && (
              <div style={{ marginTop: '14px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div className="control-label" style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#ec4899' }}><Edit2 size={10} /> Nombre de Material</span>
                  </div>
                  <input 
                    type="text" 
                    value={rampState.customMaterialName}
                    onChange={(e) => dispatch(setCustomMaterialName(e.target.value))}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <div className="control-label" style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#ec4899' }}>Coeficiente de Fricción (μ)</span>
                    <span className="control-value">{rampState.customFriction.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.00" 
                    max="1.00" 
                    step="0.01" 
                    value={rampState.customFriction} 
                    onChange={(e) => dispatch(setCustomFriction(Number(e.target.value)))} 
                  />
                </div>
              </div>
            )}
          </div>

          <div className="control-group">
            <div className="control-label">
              <span><Ruler size={14} /> Longitud Rampa</span>
              <span className="control-value">{rampState.rampLength.toFixed(2)} m</span>
            </div>
            <input 
              type="range" 
              min="0.10" 
              max="2.00" 
              step="0.01" 
              value={rampState.rampLength} 
              onChange={(e) => {
                dispatch(setRampLength(Number(e.target.value)));
                window.dispatchEvent(new Event(EVENT_RESET_RAMP));
              }} 
            />
          </div>

          <div className="control-group">
            <div className="control-label">
              <span><Target size={14} /> Posición Sensores (m)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              {[1, 2, 3, 4].map((sensorNum, idx) => (
                <div key={`sensor-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Sensor S{sensorNum}</span>
                  <input 
                    type="number" 
                    min="0" 
                    max={rampState.rampLength} 
                    step="0.01" 
                    value={rampState.sensorDistances ? rampState.sensorDistances[idx] : 0} 
                    onChange={(e) => {
                      dispatch(updateSensorDistance({ index: idx, distance: Number(e.target.value) }));
                      window.dispatchEvent(new Event(EVENT_RESET_RAMP));
                    }}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px', borderRadius: '4px', fontSize: '11px', width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="panel-actions" style={{ display: collapsed ? 'none' : 'flex' }}>
        {!rampState.isPlaying ? (
          <button className="action-btn play-btn" onClick={() => dispatch(setPlaying(true))}><Play size={14} /> Play</button>
        ) : (
          <button className="action-btn pause-btn" onClick={() => dispatch(setPlaying(false))}><Pause size={14} /> Pause</button>
        )}
        <button className="action-btn reset-btn" onClick={() => { dispatch(setPlaying(false)); window.dispatchEvent(new Event(EVENT_RESET_RAMP)); }}><RotateCcw size={14} /> Reset</button>
      </div>
    </aside>
  );
}
