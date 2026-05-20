import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { RootState } from '../../store/store';
import { moveCharge, deleteCharge, setSelectedCharge, updateChargeValue } from '../../store/electroSlice';
import { Crosshair, Trash2, Battery, CheckCircle2, Pin, PinOff } from 'lucide-react';

export default function ElectroRightPanel() {
  const dispatch = useDispatch();
  const location = useLocation();
  const path = location.pathname;

  const electro = useSelector((state: RootState) => state.electrostatics);

  if (path !== '/electrostatics') return null;

  return (
    <div className="miro-right-panel glass-panel">
      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f1f5f9', letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Battery size={14} color="#3b82f6" />
          Inventario de Cargas
        </h2>
        <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 'bold', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
          {electro.charges.length}
        </span>
      </div>

      <div className="panel-content" style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
        {electro.charges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: '12px' }}>
            No hay cargas en la simulación.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {electro.charges.map((charge, idx) => {
              const isSelected = charge.id === electro.selectedChargeId;
              const isPos = charge.charge > 0;
              const color = isPos ? '#ef4444' : '#3b82f6';
              const bgColor = isPos ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.05)';
              const borderColor = isPos ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)';

              return (
                <div 
                  key={charge.id}
                  style={{
                    background: isSelected ? 'rgba(255,255,255,0.08)' : bgColor,
                    border: `1px solid ${isSelected ? '#cbd5e1' : borderColor}`,
                    borderRadius: '8px',
                    padding: '10px',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                >
                  {/* Select Area (Header) */}
                  <div 
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', cursor: 'pointer' }}
                    onClick={() => dispatch(setSelectedCharge(charge.id))}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }}></div>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc' }}>
                        Carga {idx + 1}
                      </span>
                      <span style={{ fontSize: '11px', color, fontWeight: 'bold', background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px' }}>
                        {isPos ? '+' : ''}{charge.charge} µC
                      </span>
                    </div>
                    {isSelected && <CheckCircle2 size={14} color="#10b981" />}
                  </div>

                  {/* Charge value slider */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8' }}>Carga (µC)</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color, fontFamily: 'monospace' }}>{isPos ? '+' : ''}{charge.charge} µC</span>
                    </div>
                    <input
                      type="range"
                      min="-20" max="20" step="1"
                      value={charge.charge}
                      onChange={(e) => dispatch(updateChargeValue({ id: charge.id, charge: Number(e.target.value) }))}
                      style={{ width: '100%', accentColor: color, margin: 0 }}
                    />
                  </div>

                  {/* Coordinates Inputs */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>X</span>
                      <input 
                        type="number" 
                        value={Math.round(charge.x)} 
                        onChange={(e) => dispatch(moveCharge({ id: charge.id, x: Number(e.target.value), y: charge.y, z: charge.z }))}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '10px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Y</span>
                      <input 
                        type="number" 
                        value={Math.round(charge.y)} 
                        onChange={(e) => dispatch(moveCharge({ id: charge.id, x: charge.x, y: Number(e.target.value), z: charge.z }))}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '10px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', marginBottom: '2px' }}>Z</span>
                      <input 
                        type="number" 
                        value={Math.round(charge.z)} 
                        onChange={(e) => dispatch(moveCharge({ id: charge.id, x: charge.x, y: charge.y, z: Number(e.target.value) }))}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '10px' }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      onClick={() => dispatch(setSelectedCharge(charge.id))}
                      style={{ flex: 1, padding: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#cbd5e1', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
                      className="charge-row-btn"
                    >
                      <Crosshair size={12} /> Seleccionar
                    </button>
                    <button 
                      title={charge.isStatic ? 'Desanclar carga' : 'Anclar carga'}
                      onClick={() => window.dispatchEvent(new CustomEvent('evt_toggle_static', { detail: charge.id }))}
                      style={{ width: '28px', padding: '4px', background: charge.isStatic ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${charge.isStatic ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', color: charge.isStatic ? '#f59e0b' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      className="charge-row-btn"
                    >
                      {charge.isStatic ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                    <button 
                      title="Eliminar carga"
                      onClick={() => dispatch(deleteCharge(charge.id))}
                      style={{ width: '28px', padding: '4px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      className="charge-delete-btn"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
