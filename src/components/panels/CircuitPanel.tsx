import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setVoltage, setR1, setR2, setR3, setR4, setOpen, setTopology, CircuitTopology, setActiveTool, CircuitTool, setDraggedComponent, rotateDraggedComponent } from '../../store/circuitSlice';
import { Zap, Info, Power, ToggleLeft, ToggleRight, Sparkles, Layers, Sliders, Edit3, Hand, Link, Scissors } from 'lucide-react';

export default function CircuitPanel() {
  const dispatch = useDispatch();
  const state = useSelector((s: RootState) => s.circuit);
  const [collapsed, setCollapsed] = useState(false);

  const { voltage, r1, r2, r3, r4, isOpen, topology, slot1, slot2, slot3, slot4, activeTool, draggedComponent } = state;

  const getEffR = (slot: 'resistor' | 'wire' | 'empty', val: number) => {
    if (slot === 'wire') return 0.0001; // short circuit
    if (slot === 'empty') return 1e9; // open circuit
    return val;
  };

  const getDisplayR = (slot: 'resistor' | 'wire' | 'empty', val: number) => {
    if (slot === 'wire') return 'Cable';
    if (slot === 'empty') return 'Vacío';
    return `${val} Ω`;
  };

  // Solve network based on current topology and slot configurations
  let req = 0;
  let it = 0;
  
  let details = [
    { name: 'R1', r: getDisplayR(slot1, r1), v: 0, i: 0, p: 0, color: '#f43f5e', active: slot1 !== 'empty' },
    { name: 'R2', r: getDisplayR(slot2, r2), v: 0, i: 0, p: 0, color: '#3b82f6', active: slot2 !== 'empty' },
    { name: 'R3', r: getDisplayR(slot3, r3), v: 0, i: 0, p: 0, color: '#10b981', active: slot3 !== 'empty' },
    { name: 'R4', r: getDisplayR(slot4, r4), v: 0, i: 0, p: 0, color: '#c084fc', active: slot4 !== 'empty' }
  ];

  if (!isOpen) {
    if (topology === 'series') {
      req = r1 + r2 + r3;
      it = voltage / req;
      details[0].v = it * r1;
      details[0].i = it;
      details[0].p = details[0].v * it;

      details[1].v = it * r2;
      details[1].i = it;
      details[1].p = details[1].v * it;

      details[2].v = it * r3;
      details[2].i = it;
      details[2].p = details[2].v * it;
    } else if (topology === 'parallel') {
      req = 1 / (1/r1 + 1/r2 + 1/r3);
      it = voltage / req;

      details[0].v = voltage;
      details[0].i = voltage / r1;
      details[0].p = voltage * details[0].i;

      details[1].v = voltage;
      details[1].i = voltage / r2;
      details[1].p = voltage * details[1].i;

      details[2].v = voltage;
      details[2].i = voltage / r3;
      details[2].p = voltage * details[2].i;
    } else if (topology === 'mixed' || topology === 'custom') {
      const R1_eff = getEffR(slot1, r1);
      const R2_eff = getEffR(slot2, r2);
      const R3_eff = getEffR(slot3, r3);
      const R4_eff = getEffR(slot4, r4);

      const G2 = 1 / R2_eff;
      const G3 = 1 / R3_eff;
      const G4 = 1 / R4_eff;
      const Gp = G2 + G3 + G4;
      const Rp = Gp === 0 ? 1e9 : 1 / Gp;

      req = R1_eff + Rp;
      
      // Safety threshold against absolute short circuit
      if (req < 0.1) req = 0.1;

      it = voltage / req;

      const V1 = it * R1_eff;
      const Vp = Math.max(0, voltage - V1);

      details[0].v = V1;
      details[0].i = it;
      details[0].p = V1 * it;

      details[1].v = Vp;
      details[1].i = slot2 === 'empty' ? 0 : Vp / R2_eff;
      details[1].p = details[1].v * details[1].i;

      details[2].v = Vp;
      details[2].i = slot3 === 'empty' ? 0 : Vp / R3_eff;
      details[2].p = details[2].v * details[2].i;

      details[3].v = Vp;
      details[3].i = slot4 === 'empty' ? 0 : Vp / R4_eff;
      details[3].p = details[3].v * details[3].i;
    }
  }

  const handleTopologyChange = (top: CircuitTopology) => {
    dispatch(setTopology(top));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (topology !== 'custom') return;
      const key = e.key.toLowerCase();
      
      if (draggedComponent) {
        if (key === 'r' || key === ' ') {
          e.preventDefault();
          dispatch(rotateDraggedComponent());
        } else if (e.key === 'Escape') {
          dispatch(setDraggedComponent(null));
        }
        return;
      }

      if (key === 'h' || key === 'm' || key === ' ') {
        dispatch(setActiveTool('pan'));
      } else if (key === 'r') {
        dispatch(setActiveTool('resistor'));
      } else if (key === 'c') {
        dispatch(setActiveTool('wire'));
      } else if (key === 'e' || key === 'b') {
        dispatch(setActiveTool('eraser'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, topology, draggedComponent]);

  // Filter components active in current topology/slots
  const activeDetails = topology === 'custom' 
    ? details.filter(d => d.active) 
    : details.slice(0, 3);

  return (
    <>
      {topology === 'custom' && (
        <div 
          className="glass-panel"
          style={{
            position: 'absolute',
            left: '20px',
            top: '120px',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '8px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 0 0 1px rgba(99, 102, 241, 0.15)',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '2px', width: '100%', textAlign: 'center' }}>
            CAD
          </div>

          {/* Tool: Pan */}
          <button
            onClick={() => dispatch(setActiveTool('pan'))}
            title="Herramienta Mover Tablero (M / H / Espacio)"
            style={{
              background: activeTool === 'pan' ? 'rgba(99,102,241,0.25)' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              color: activeTool === 'pan' ? '#a5b4fc' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activeTool === 'pan' ? 'inset 0 0 8px rgba(99,102,241,0.2), 0 0 10px rgba(99,102,241,0.15)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Hand size={18} />
          </button>

          {/* Tool: Resistor */}
          <button
            onClick={() => dispatch(setActiveTool('resistor'))}
            title="Colocar Resistencia (R)"
            style={{
              background: activeTool === 'resistor' ? 'rgba(244,63,94,0.2)' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              color: activeTool === 'resistor' ? '#f43f5e' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activeTool === 'resistor' ? 'inset 0 0 8px rgba(244,63,94,0.2), 0 0 10px rgba(244,63,94,0.15)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Zap size={18} />
          </button>

          {/* Tool: Wire */}
          <button
            onClick={() => dispatch(setActiveTool('wire'))}
            title="Colocar Cable Directo (C)"
            style={{
              background: activeTool === 'wire' ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              color: activeTool === 'wire' ? '#cbd5e1' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activeTool === 'wire' ? 'inset 0 0 8px rgba(255,255,255,0.1), 0 0 10px rgba(255,255,255,0.05)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Link size={18} style={{ transform: 'rotate(-45deg)' }} />
          </button>

          {/* Tool: Eraser */}
          <button
            onClick={() => dispatch(setActiveTool('eraser'))}
            title="Borrador / Vaciar Tramo (E / B)"
            style={{
              background: activeTool === 'eraser' ? 'rgba(239,68,68,0.2)' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              color: activeTool === 'eraser' ? '#f87171' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activeTool === 'eraser' ? 'inset 0 0 8px rgba(239,68,68,0.2), 0 0 10px rgba(239,68,68,0.15)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Scissors size={18} />
          </button>

          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', width: '100%', textAlign: 'center', marginTop: '4px' }}>
            Paleta
          </div>

          {/* Component: Drag Resistor */}
          <button
            onClick={() => dispatch(setDraggedComponent({ type: 'resistor', angle: 0 }))}
            title="Click para arrastrar nueva Resistencia al tablero (R / Espacio para rotar)"
            style={{
              background: 'rgba(244,63,94,0.15)',
              border: '1px dashed rgba(244,63,94,0.4)',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'grab',
              color: '#f43f5e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <Zap size={18} />
          </button>

          {/* Component: Drag Wire */}
          <button
            onClick={() => dispatch(setDraggedComponent({ type: 'wire', angle: 0 }))}
            title="Click para arrastrar nuevo Tramo de Cable al tablero (R / Espacio para rotar)"
            style={{
              background: 'rgba(148,163,184,0.15)',
              border: '1px dashed rgba(148,163,184,0.4)',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'grab',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
          >
            <Link size={18} style={{ transform: 'rotate(-45deg)' }} />
          </button>
        </div>
      )}

      {topology === 'custom' && draggedComponent && (
        <div 
          className="glass-panel"
          style={{
            position: 'absolute',
            left: '78px',
            top: '120px',
            zIndex: 101,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '12px',
            padding: '10px 14px',
            color: '#cbd5e1',
            fontSize: '11px',
            width: '200px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.6), 0 0 15px rgba(99, 102, 241, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            animation: 'scaleIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <div style={{ fontWeight: 'bold', color: draggedComponent.type === 'resistor' ? '#f43f5e' : '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Arrastrando:</span>
            <span style={{ textTransform: 'capitalize', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
              {draggedComponent.type === 'resistor' ? 'Resistencia 🔴' : 'Cable 🔗'}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
            • Pulsa <b style={{ color: '#f1f5f9' }}>R</b> o <b style={{ color: '#f1f5f9' }}>Espacio</b> para girar.
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>
            • Haz click en una ranura para colocar.
          </div>
          <div style={{ fontSize: '10px', color: '#f87171' }}>
            • Pulsa <b style={{ color: '#ef4444' }}>Esc</b> o click derecho para cancelar.
          </div>
        </div>
      )}

      <aside className={`panel glass-panel ${collapsed ? 'collapsed' : ''}`} style={{ position: 'absolute', zIndex: 10, right: '20px', top: '80px', width: '330px' }}>
        <div className="panel-header">
          <h2><Zap size={16} color="#6366f1" /> Red de Resistencias</h2>
          <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '+' : '−'}
          </button>
        </div>

      {!collapsed && (
        <div className="panel-content" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingRight: '4px' }}>
          
          {/* Selector de Topología */}
          <div className="control-group">
            <div className="control-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={13} color="#a5b4fc" /> Configuración</span>
            </div>
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
              {(['series', 'parallel', 'mixed', 'custom'] as CircuitTopology[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTopologyChange(t)}
                  style={{
                    flex: '1 1 auto',
                    padding: '5px 3px',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    background: topology === t ? 'rgba(99,102,241,0.25)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: topology === t ? '#a5b4fc' : '#94a3b8',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: topology === t ? 'inset 0 0 8px rgba(99,102,241,0.2)' : 'none',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: topology === t ? 'rgba(99,102,241,0.3)' : 'transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  {t === 'series' ? 'Serie' : t === 'parallel' ? 'Paralelo' : t === 'mixed' ? 'Mixto' : 'Creador'}
                </button>
              ))}
            </div>
          </div>

          {/* Helper instructions for Custom Mode */}
          {topology === 'custom' && (
            <div className="control-group" style={{ 
              marginTop: '12px', 
              padding: '10px', 
              background: 'rgba(99,102,241,0.08)', 
              borderRadius: '8px', 
              border: '1px dashed rgba(99,102,241,0.3)',
              fontSize: '10px',
              color: '#cbd5e1',
              lineHeight: '1.4'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#a5b4fc', fontWeight: 'bold', marginBottom: '4px' }}>
                <Edit3 size={11} /> ¡Modo Creador Activo!
              </span>
              <ul style={{ margin: 0, paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <li><b>Click Derecho</b> en tramos vacíos o cables para <b>Agregar Resistencia</b>, cable o cortarla.</li>
                <li><b>Pasar cursor (Hover)</b> sobre resistencias para medir tensión (V) e intensidad (I).</li>
                <li><b>Click Izquierdo</b> directo sobre el interruptor en el lienzo para activarlo.</li>
              </ul>
            </div>
          )}

          {/* Voltaje Slider */}
          <div className="control-group" style={{ marginTop: '14px' }}>
            <div className="control-label">
              <span>Voltaje de Fuente (V<sub>g</sub>)</span>
              <span className="control-value" style={{ color: '#ec4899' }}>{voltage} V</span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={voltage}
              onChange={(e) => dispatch(setVoltage(Number(e.target.value)))}
            />
          </div>

          {/* Resistencias Sliders */}
          <div className="control-group" style={{ marginTop: '14px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <span style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
              <Sliders size={12} /> Ajustar Resistencias
            </span>
            
            {/* R1 */}
            {(topology !== 'custom' || slot1 === 'resistor') ? (
              <div style={{ marginBottom: '10px' }}>
                <div className="control-label" style={{ marginBottom: '2px' }}>
                  <span style={{ color: '#f43f5e', fontSize: '11px' }}>R₁ (Serie o Principal)</span>
                  <span className="control-value" style={{ color: '#f43f5e', fontSize: '11px' }}>{r1} Ω</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={r1}
                  onChange={(e) => dispatch(setR1(Number(e.target.value)))}
                  style={{ height: '3px' }}
                />
              </div>
            ) : null}

            {/* R2 */}
            {(topology !== 'custom' || slot2 === 'resistor') ? (
              <div style={{ marginBottom: '10px' }}>
                <div className="control-label" style={{ marginBottom: '2px' }}>
                  <span style={{ color: '#3b82f6', fontSize: '11px' }}>R₂</span>
                  <span className="control-value" style={{ color: '#3b82f6', fontSize: '11px' }}>{r2} Ω</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={r2}
                  onChange={(e) => dispatch(setR2(Number(e.target.value)))}
                  style={{ height: '3px' }}
                />
              </div>
            ) : null}

            {/* R3 */}
            {(topology !== 'custom' || slot3 === 'resistor') ? (
              <div style={{ marginBottom: '10px' }}>
                <div className="control-label" style={{ marginBottom: '2px' }}>
                  <span style={{ color: '#10b981', fontSize: '11px' }}>R₃</span>
                  <span className="control-value" style={{ color: '#10b981', fontSize: '11px' }}>{r3} Ω</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={r3}
                  onChange={(e) => dispatch(setR3(Number(e.target.value)))}
                  style={{ height: '3px' }}
                />
              </div>
            ) : null}

            {/* R4 */}
            {(topology === 'custom' && slot4 === 'resistor') ? (
              <div>
                <div className="control-label" style={{ marginBottom: '2px' }}>
                  <span style={{ color: '#c084fc', fontSize: '11px' }}>R₄ (Nueva Rama)</span>
                  <span className="control-value" style={{ color: '#c084fc', fontSize: '11px' }}>{r4} Ω</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="10"
                  value={r4}
                  onChange={(e) => dispatch(setR4(Number(e.target.value)))}
                  style={{ height: '3px' }}
                />
              </div>
            ) : null}

            {topology === 'custom' && slot1 !== 'resistor' && slot2 !== 'resistor' && slot3 !== 'resistor' && slot4 !== 'resistor' && (
              <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '8px 0' }}>
                No hay resistencias activas en la cuadrícula.
              </div>
            )}
          </div>

          {/* Interruptor Switch Toggle */}
          <div className="control-group" style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="control-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Power size={13} color={isOpen ? '#f87171' : '#10b981'} />
                Interruptor de Circuito
              </span>
              <button
                onClick={() => dispatch(setOpen(!isOpen))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {isOpen ? (
                  <ToggleLeft size={32} color="#ef4444" />
                ) : (
                  <ToggleRight size={32} color="#10b981" />
                )}
              </button>
            </div>
          </div>

          {/* Tabla de análisis individual */}
          <div className="control-group" style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
              <Sparkles size={12} /> Análisis de Componentes
            </span>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '4px 2px' }}>Comp.</th>
                  <th style={{ padding: '4px 2px' }}>R</th>
                  <th style={{ padding: '4px 2px' }}>V (V)</th>
                  <th style={{ padding: '4px 2px' }}>I (A)</th>
                  <th style={{ padding: '4px 2px' }}>P (W)</th>
                </tr>
              </thead>
              <tbody>
                {activeDetails.map((d) => (
                  <tr key={d.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: d.r.includes('Vacío') ? 0.35 : 1 }}>
                    <td style={{ padding: '6px 2px', fontWeight: 'bold', color: d.color }}>{d.name}</td>
                    <td style={{ padding: '6px 2px', fontFamily: 'monospace' }}>{d.r}</td>
                    <td style={{ padding: '6px 2px', fontFamily: 'monospace', color: '#a5b4fc' }}>{d.r.includes('Vacío') ? '-' : d.v.toFixed(2)}</td>
                    <td style={{ padding: '6px 2px', fontFamily: 'monospace', color: '#38bdf8' }}>{d.r.includes('Vacío') ? '-' : d.i.toFixed(4)}</td>
                    <td style={{ padding: '6px 2px', fontFamily: 'monospace', color: '#f472b6' }}>{d.r.includes('Vacío') ? '-' : d.p.toFixed(2)}</td>
                  </tr>
                ))}
                {/* Equivalent Row */}
                <tr style={{ background: 'rgba(255,255,255,0.02)', fontWeight: 'bold' }}>
                  <td style={{ padding: '6px 2px', color: '#c084fc' }}>Total</td>
                  <td style={{ padding: '6px 2px', fontFamily: 'monospace', color: '#c084fc' }}>{req >= 1e6 ? '∞ Ω' : `${req.toFixed(1)} Ω`}</td>
                  <td style={{ padding: '6px 2px', fontFamily: 'monospace' }}>{isOpen ? '0.0' : voltage.toFixed(1)}</td>
                  <td style={{ padding: '6px 2px', fontFamily: 'monospace', color: '#38bdf8' }}>{it.toFixed(4)}</td>
                  <td style={{ padding: '6px 2px', fontFamily: 'monospace', color: '#f472b6' }}>{(isOpen ? 0 : voltage * it).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '10px' }}>
            <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.4, margin: 0 }}>
              <Info size={11} /> <b>Análisis Avanzado</b>: Coloca el cursor en el simulador para realizar mediciones localizadas.
            </p>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
