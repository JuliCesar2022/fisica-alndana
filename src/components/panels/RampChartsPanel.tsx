import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { AreaChart, TrendingUp, Zap, Clock, ShieldAlert, Timer } from 'lucide-react';

interface HistoryPoint {
  time: number;
  velocity: number;
  position: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
}

export default function RampChartsPanel() {
  const ramp = useSelector((state: RootState) => state.ramp);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'kinetics' | 'energy'>('kinetics');
  
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
        </div>
      )}
    </aside>
  );
}
