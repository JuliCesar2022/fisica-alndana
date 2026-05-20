import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { AreaChart, TrendingUp, Zap, Clock, ShieldAlert, Timer, Cpu } from 'lucide-react';

interface HistoryPoint {
  time: number;
  velocity: number;
  position: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
}

const PRUEBAS_DATA = [
  { id: 1, label: 'Ensayo 1', t1: 0.145, t2: 0.091, t3: 0.050, v1: 0.759, v2: 1.209, v3: 2.200 },
  { id: 2, label: 'Ensayo 2', t1: 0.140, t2: 0.084, t3: 0.023, v1: 0.786, v2: 1.310, v3: 4.783 },
  { id: 3, label: 'Ensayo 3', t1: 0.143, t2: 0.091, t3: 0.047, v1: 0.769, v2: 1.209, v3: 2.340 },
  { id: 4, label: 'Ensayo 4', t1: 0.146, t2: 0.087, t3: 0.056, v1: 0.753, v2: 1.264, v3: 1.964 },
  { id: 5, label: 'Ensayo 5', t1: 0.148, t2: 0.088, t3: 0.319, v1: 0.743, v2: 1.250, v3: 0.345 },
  { id: 6, label: 'Ensayo 6', t1: 0.146, t2: 0.086, t3: 0.046, v1: 0.753, v2: 1.279, v3: 2.391 },
  { id: 7, label: 'Promedio (Sin Atípicos)', t1: 0.144, t2: 0.089, t3: 0.050, v1: 0.764, v2: 1.236, v3: 2.200 }
];

export default function RampChartsPanel() {
  const ramp = useSelector((state: RootState) => state.ramp);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'kinetics' | 'energy'>('kinetics');
  const [selectedPrueba, setSelectedPrueba] = useState(7); // Default to Promedio
  
  // History buffer
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const prevTimeRef = useRef<number>(-1);

  // Clear history on reset (time goes back to 0) or changes in angle/mass/gravity
  useEffect(() => {
    const curTime = ramp.state.time;
    
    if (curTime === 0) {
      setHistory([]);
      prevTimeRef.current = 0;
      return;
    }

    // Only add a point if simulation is running and time has moved forward
    if (ramp.isPlaying && curTime > prevTimeRef.current) {
      setHistory(prev => {
        // Prevent duplicate time points
        if (prev.length > 0 && prev[prev.length - 1].time === curTime) {
          return prev;
        }
        
        const next = [
          ...prev,
          {
            time: curTime,
            velocity: ramp.state.velocity,
            position: ramp.state.position,
            kineticEnergy: ramp.state.kineticEnergy,
            potentialEnergy: ramp.state.potentialEnergy,
            totalEnergy: ramp.state.totalEnergy,
          }
        ];
        
        // Cap history to keep rendering ultra smooth
        if (next.length > 180) {
          next.shift();
        }
        return next;
      });
      prevTimeRef.current = curTime;
    }
  }, [ramp.state.time, ramp.isPlaying, ramp.state.velocity, ramp.state.position, ramp.state.kineticEnergy, ramp.state.potentialEnergy, ramp.state.totalEnergy]);

  // Compute SVG Paths
  const renderChart = () => {
    if (history.length < 2) {
      return (
        <div style={{ height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
          <Timer size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <span>Inicia la simulación para graficar en tiempo real</span>
        </div>
      );
    }

    const width = 340;
    const height = 150;
    const padding = { top: 15, right: 15, bottom: 25, left: 35 };

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    // Time is our X-axis
    const xMin = 0;
    const xMax = Math.max(2.0, history[history.length - 1].time); // Min scale of 2.0s

    const getX = (t: number) => padding.left + ((t - xMin) / (xMax - xMin)) * plotW;

    // Determine Y-axis variables and limits
    let yMin = 0;
    let yMax = 1.0;
    
    if (activeTab === 'kinetics') {
      const maxVal = Math.max(
        ...history.map(p => Math.max(p.velocity, p.position))
      );
      yMax = Math.max(1.0, maxVal * 1.15); // Add 15% headroom
    } else {
      const maxVal = Math.max(
        ...history.map(p => Math.max(p.kineticEnergy, p.potentialEnergy, p.totalEnergy))
      );
      yMax = Math.max(5.0, maxVal * 1.15); // Add 15% headroom
    }

    const getY = (val: number) => padding.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

    // Build path helper
    const buildPath = (accessor: (p: HistoryPoint) => number) => {
      let d = '';
      history.forEach((p, idx) => {
        const x = getX(p.time);
        const y = getY(accessor(p));
        if (idx === 0) {
          d += `M ${x} ${y}`;
        } else {
          d += ` L ${x} ${y}`;
        }
      });
      return d;
    };

    // Paths
    let paths: { d: string; color: string; label: string; strokeDash?: string }[] = [];

    if (activeTab === 'kinetics') {
      paths = [
        { d: buildPath(p => p.position), color: '#3b82f6', label: 'Posición (m)' },
        { d: buildPath(p => p.velocity), color: '#10b981', label: 'Velocidad (m/s)' },
      ];
    } else {
      paths = [
        { d: buildPath(p => p.kineticEnergy), color: '#ec4899', label: 'Cinética (J)' },
        { d: buildPath(p => p.potentialEnergy), color: '#f59e0b', label: 'Potencial (J)' },
        { d: buildPath(p => p.totalEnergy), color: '#67e8f9', label: 'Mecánica Total (J)', strokeDash: '4,4' },
      ];
    }

    // Grid lines
    const gridLines = [];
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const ratio = i / ticks;
      const y = padding.top + ratio * plotH;
      const val = yMax - ratio * (yMax - yMin);
      gridLines.push({
        y,
        label: val.toFixed(1),
      });
    }

    return (
      <div style={{ position: 'relative' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          {/* Grid lines & Y Axis Labels */}
          {gridLines.map((line, idx) => (
            <g key={idx} opacity={0.15}>
              <line 
                x1={padding.left} 
                y1={line.y} 
                x2={width - padding.right} 
                y2={line.y} 
                stroke="#ffffff" 
                strokeWidth="1"
              />
              <text 
                x={padding.left - 8} 
                y={line.y + 4} 
                fill="#ffffff" 
                fontSize="9px" 
                fontFamily="'JetBrains Mono', monospace" 
                textAnchor="end"
              >
                {line.label}
              </text>
            </g>
          ))}

          {/* X Axis Labels (Time) */}
          <g opacity={0.25}>
            <line 
              x1={padding.left} 
              y1={padding.top + plotH} 
              x2={width - padding.right} 
              y2={padding.top + plotH} 
              stroke="#ffffff" 
              strokeWidth="1"
            />
            <text 
              x={padding.left} 
              y={padding.top + plotH + 16} 
              fill="#ffffff" 
              fontSize="9px" 
              fontFamily="'JetBrains Mono', monospace"
            >
              0.0s
            </text>
            <text 
              x={width - padding.right} 
              y={padding.top + plotH + 16} 
              fill="#ffffff" 
              fontSize="9px" 
              fontFamily="'JetBrains Mono', monospace" 
              textAnchor="end"
            >
              {xMax.toFixed(1)}s
            </text>
          </g>

          {/* Render paths */}
          {paths.map((path, idx) => (
            <g key={idx}>
              {/* Glow filter layer */}
              <path 
                d={path.d} 
                fill="none" 
                stroke={path.color} 
                strokeWidth="4" 
                opacity="0.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main solid line */}
              <path 
                d={path.d} 
                fill="none" 
                stroke={path.color} 
                strokeWidth="2" 
                strokeDasharray={path.strokeDash}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </svg>

        {/* Dynamic Legends */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
          {paths.map((path, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: path.color }}></span>
              <span style={{ color: '#94a3b8' }}>{path.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside className={`panel glass-panel ${collapsed ? 'collapsed' : ''}`} style={{ position: 'absolute', zIndex: 10, left: '20px', top: '80px', width: '380px' }}>
      <div className="panel-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AreaChart size={16} color="#6366f1" /> Gráficas en Tiempo Real
        </h2>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '+' : '−'}
        </button>
      </div>

      {!collapsed && (
        <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Digital Timer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '8px', boxShadow: 'inset 0 0 10px rgba(99, 102, 241, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#a5b4fc', fontWeight: 500 }}>
              <Clock size={13} className={ramp.isPlaying ? 'pulse-anim' : ''} />
              <span>TIEMPO SIMULADO</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 700, color: '#f8fafc', textShadow: '0 0 8px rgba(255,255,255,0.1)' }}>
              {ramp.state.time.toFixed(3)} <span style={{ fontSize: '12px', color: '#64748b' }}>s</span>
            </div>
          </div>

          {/* Custom Navigation Tabs */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button 
              style={{ flex: 1, padding: '6px 12px', background: activeTab === 'kinetics' ? 'rgba(255,255,255,0.07)' : 'transparent', border: 'none', color: activeTab === 'kinetics' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setActiveTab('kinetics')}
            >
              Cinemática (x, v)
            </button>
            <button 
              style={{ flex: 1, padding: '6px 12px', background: activeTab === 'energy' ? 'rgba(255,255,255,0.07)' : 'transparent', border: 'none', color: activeTab === 'energy' ? '#ffffff' : '#64748b', fontSize: '11px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setActiveTab('energy')}
            >
              Energía (E_k, E_p, E_m)
            </button>
          </div>

          {/* SVG Graph Component */}
          {renderChart()}

          {/* Adquisición de Datos Arduino UNO (Guion.pdf) */}
          <div style={{
            marginTop: '8px',
            padding: '12px',
            background: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            boxShadow: 'inset 0 0 15px rgba(255,255,255,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={14} color="#10b981" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.5px' }}>
                  TELEMETRÍA ARDUINO UNO (LCD I2C)
                </span>
              </div>
              {/* Dropdown for Prueba selection */}
              <select 
                value={selectedPrueba} 
                onChange={(e) => setSelectedPrueba(Number(e.target.value))}
                style={{
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  color: '#e2e8f0',
                  fontSize: '9.5px',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              >
                {PRUEBAS_DATA.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Simulated LCD Screen style badge */}
            <div style={{
              background: 'rgba(6, 78, 59, 0.95)',
              border: '1px solid #10b981',
              borderRadius: '6px',
              padding: '8px 10px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#34d399',
              fontSize: '10px',
              lineHeight: '1.4',
              marginBottom: '10px',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3), inset 0 0 8px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>* SISTEMA LISTO *</span>
                <span>g=9.8m/s2</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6ee7b7' }}>
                <span>S1: {ramp.state.s1Time !== null ? `${(ramp.state.s1Time * 1000).toFixed(0)}ms` : 'ESPERANDO...'}</span>
                <span>S3: {ramp.state.s3Time !== null ? `${(ramp.state.s3Time * 1000).toFixed(0)}ms` : 'ESPERANDO...'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6ee7b7' }}>
                <span>S2: {ramp.state.s2Time !== null ? `${(ramp.state.s2Time * 1000).toFixed(0)}ms` : 'ESPERANDO...'}</span>
                <span>S4: {ramp.state.s4Time !== null ? `${(ramp.state.s4Time * 1000).toFixed(0)}ms` : 'ESPERANDO...'}</span>
              </div>
            </div>

            {/* Comparison Grid */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', color: '#94a3b8' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', color: '#64748b', fontWeight: 600 }}>TRAMO</th>
                  <th style={{ textAlign: 'center', padding: '4px 0', color: '#3b82f6', fontWeight: 600 }}>SIMULADO</th>
                  <th style={{ textAlign: 'center', padding: '4px 0', color: '#ef4444', fontWeight: 600 }}>REAL ({PRUEBAS_DATA.find(p => p.id === selectedPrueba)?.label.split(' ')[0]})</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', color: '#10b981', fontWeight: 600 }}>ERROR %</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const s = ramp.state;
                  const activePrueba = PRUEBAS_DATA.find(p => p.id === selectedPrueba) || PRUEBAS_DATA[6];

                  const t1Sim = s.s1Time !== null && s.s2Time !== null ? (s.s2Time - s.s1Time) : null;
                  const t2Sim = s.s2Time !== null && s.s3Time !== null ? (s.s3Time - s.s2Time) : null;
                  const t3Sim = s.s3Time !== null && s.s4Time !== null ? (s.s4Time - s.s3Time) : null;

                  const data = [
                    { name: 'T1 (S1→S2)', sim: t1Sim, real: activePrueba.t1 },
                    { name: 'T2 (S2→S3)', sim: t2Sim, real: activePrueba.t2 },
                    { name: 'T3 (S3→S4)', sim: t3Sim, real: activePrueba.t3 }
                  ];

                  return data.map((row, idx) => {
                    const simMs = row.sim ? (row.sim * 1000).toFixed(0) + ' ms' : '—';
                    const realMs = (row.real * 1000).toFixed(0) + ' ms';
                    
                    let errStr = '—';
                    if (row.sim) {
                      const err = Math.abs((row.sim - row.real) / row.real) * 100;
                      errStr = err.toFixed(1) + '%';
                    }

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px 0', fontWeight: 500, color: '#f1f5f9' }}>{row.name}</td>
                        <td style={{ textAlign: 'center', padding: '6px 0', fontFamily: "'JetBrains Mono', monospace", color: '#a5b4fc' }}>{simMs}</td>
                        <td style={{ textAlign: 'center', padding: '6px 0', fontFamily: "'JetBrains Mono', monospace", color: '#fca5a5' }}>{realMs}</td>
                        <td style={{ textAlign: 'right', padding: '6px 0', fontFamily: "'JetBrains Mono', monospace", color: errStr !== '—' ? '#34d399' : '#475569' }}>{errStr}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>

            {/* Velocities Comparison */}
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '9px', color: '#64748b', background: 'rgba(0,0,0,0.15)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '3px', marginBottom: '3px' }}>
                Velocidades Medidas (v = d / t)
              </div>
              {(() => {
                const s = ramp.state;
                const activePrueba = PRUEBAS_DATA.find(p => p.id === selectedPrueba) || PRUEBAS_DATA[6];

                const t1Sim = s.s1Time !== null && s.s2Time !== null ? (s.s2Time - s.s1Time) : null;
                const t2Sim = s.s2Time !== null && s.s3Time !== null ? (s.s3Time - s.s2Time) : null;
                const t3Sim = s.s3Time !== null && s.s4Time !== null ? (s.s4Time - s.s3Time) : null;

                const v1Sim = t1Sim ? (0.11 / t1Sim) : null;
                const v2Sim = t2Sim ? (0.11 / t2Sim) : null;
                const v3Sim = t3Sim ? (0.11 / t3Sim) : null;

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#cbd5e1' }}>V₁ (S1→S2):</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#34d399' }}>
                        Sim: {v1Sim ? `${v1Sim.toFixed(3)}m/s` : '—'} | Real: {activePrueba.v1.toFixed(3)}m/s
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#cbd5e1' }}>V₂ (S2→S3):</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#34d399' }}>
                        Sim: {v2Sim ? `${v2Sim.toFixed(3)}m/s` : '—'} | Real: {activePrueba.v2.toFixed(3)}m/s
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#cbd5e1' }}>V₃ (S3→S4):</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#34d399' }}>
                        Sim: {v3Sim ? `${v3Sim.toFixed(3)}m/s` : '—'} | Real: {activePrueba.v3.toFixed(3)}m/s
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
