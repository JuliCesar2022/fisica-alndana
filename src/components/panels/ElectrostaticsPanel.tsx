import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setPlaying, updateChargeValue, setVacuumMode } from '../../store/electroSlice';
import { PlusCircle, Info, Sliders, Play, Pause, RotateCcw, SlidersHorizontal, CloudRain, Sun } from 'lucide-react';
// We emit a global custom event for Phaser to pick up (since Phaser needs to add a physical body which React cannot do easily)
export const EVENT_ADD_CHARGE = 'evt_add_charge';
export const EVENT_RESET_ELECTRO = 'evt_reset_electro';
export const EVENT_MOVE_CHARGE = 'evt_move_charge';

export default function ElectrostaticsPanel() {
  const dispatch = useDispatch();
  const state = useSelector((s: RootState) => s.electrostatics);
  const [collapsed, setCollapsed] = useState(false);

  const selectedCharge = state.charges.find(c => c.id === state.selectedChargeId);

  return (
    <aside className={`panel glass-panel ${collapsed ? 'collapsed' : ''}`} style={{ position: 'absolute', zIndex: 10, right: '20px', top: '80px', width: '300px' }}>
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
              <span style={{ color: '#ef4444' }}><PlusCircle size={14} /> Nueva Carga</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="material-btn" style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444' }} onClick={() => window.dispatchEvent(new CustomEvent(EVENT_ADD_CHARGE, { detail: 5 }))}>
                + Positiva
              </button>
              <button className="material-btn" style={{ flex: 1, borderColor: '#3b82f6', color: '#3b82f6' }} onClick={() => window.dispatchEvent(new CustomEvent(EVENT_ADD_CHARGE, { detail: -5 }))}>
                - Negativa
              </button>
            </div>
          </div>

          <div className="control-group" style={{ marginTop: '16px' }}>
            <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
              <Info size={12} /> <b>Click</b> en una carga para seleccionarla y fijarla.<br/>
              <Info size={12} /> <b>Arrastra</b> para moverlas.
            </p>
          </div>

          <div className="control-group" style={{ marginTop: '16px' }}>
            <div className="control-label">
              <span>Medio de Simulación</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className={`material-btn ${!state.vacuumMode ? 'active' : ''}`} 
                style={{ flex: 1, padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={() => dispatch(setVacuumMode(false))}
              >
                <CloudRain size={12} /> Atmósfera
              </button>
              <button 
                className={`material-btn ${state.vacuumMode ? 'active' : ''}`} 
                style={{ flex: 1, padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={() => dispatch(setVacuumMode(true))}
              >
                <Sun size={12} /> Vacío
              </button>
            </div>
          </div>

          {selectedCharge && (
            <div className="control-group" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="control-label">
                <span style={{ color: '#a5b4fc' }}><Sliders size={14} /> Editar Seleccionada</span>
                <span className="control-value">{selectedCharge.charge > 0 ? '+' : ''}{selectedCharge.charge} µC</span>
              </div>
              <input 
                type="range" 
                min="-20" max="20" step="1" 
                value={selectedCharge.charge} 
                onChange={(e) => dispatch(updateChargeValue({ id: selectedCharge.id, charge: Number(e.target.value) }))} 
              />
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
                <span className="control-label" style={{ flex: 1 }}>Estado</span>
                <button 
                  className={`material-btn ${selectedCharge.isStatic ? 'active' : ''}`} 
                  style={{ flex: 1, padding: '4px' }}
                  onClick={() => window.dispatchEvent(new CustomEvent('evt_toggle_static', { detail: selectedCharge.id }))}
                >
                  {selectedCharge.isStatic ? 'Fija (Anclada)' : 'Libre'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div className="control-label"><span style={{ fontSize: '10px' }}>Posición X</span></div>
                  <input 
                    type="number" 
                    className="coord-input" 
                    value={Math.round(selectedCharge.x)} 
                    onChange={(e) => window.dispatchEvent(new CustomEvent(EVENT_MOVE_CHARGE, { detail: { id: selectedCharge.id, x: Number(e.target.value), y: selectedCharge.y } }))}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="control-label"><span style={{ fontSize: '10px' }}>Posición Y</span></div>
                  <input 
                    type="number" 
                    className="coord-input" 
                    value={Math.round(selectedCharge.y)} 
                    onChange={(e) => window.dispatchEvent(new CustomEvent(EVENT_MOVE_CHARGE, { detail: { id: selectedCharge.id, x: selectedCharge.x, y: Number(e.target.value) } }))}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="panel-actions" style={{ display: collapsed ? 'none' : 'flex' }}>
        {!state.isPlaying ? (
          <button className="action-btn play-btn" onClick={() => dispatch(setPlaying(true))}><Play size={14} /> Play</button>
        ) : (
          <button className="action-btn pause-btn" onClick={() => dispatch(setPlaying(false))}><Pause size={14} /> Pause</button>
        )}
        <button className="action-btn reset-btn" onClick={() => { dispatch(setPlaying(false)); window.dispatchEvent(new Event(EVENT_RESET_ELECTRO)); }}><RotateCcw size={14} /> Reset</button>
      </div>
    </aside>
  );
}
