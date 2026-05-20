import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { AreaChart, TrendingUp, Zap, Clock } from 'lucide-react';

interface HistoryPoint {
  time: number;
  y: number;
  velocity: number;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
}

export default function FreeFallChartsPanel() {
  const freefall = useSelector((state: RootState) => state.freefall);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'kinetics' | 'energy'>('kinetics');
  
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const prevTimeRef = useRef<number>(-1);

  useEffect(() => {
    const curTime = freefall.state.time;
    
    if (curTime === 0 || !freefall.isPlaying) {
      if (curTime === 0) {
        setHistory([]);
        prevTimeRef.current = 0;
      }
      return;
    }

    if (freefall.isPlaying && curTime > prevTimeRef.current) {
      setHistory(prev => {
        if (prev.length > 0 && prev[prev.length - 1].time === curTime) return prev;
        
        const next = [
          ...prev,
          {
            time: curTime,
            y: freefall.state.y,
            velocity: freefall.state.velocity,
            kineticEnergy: freefall.state.kineticEnergy,
            potentialEnergy: freefall.state.potentialEnergy,
            totalEnergy: freefall.state.totalEnergy
          }
        ];
        if (next.length > 150) return next.slice(next.length - 150);
        return next;
      });
      prevTimeRef.current = curTime;
    }
  }, [freefall.state.time, freefall.isPlaying, freefall.state]);

  const lastPoint = history.length > 0 ? history[history.length - 1] : {
    time: 0, y: freefall.height, velocity: 0,
    kineticEnergy: 0, potentialEnergy: freefall.mass * freefall.gravity * freefall.height,
    totalEnergy: freefall.mass * freefall.gravity * freefall.height
  };

  const renderSVGChart = (dataKey1: keyof HistoryPoint, color1: string, dataKey2?: keyof HistoryPoint, color2?: string) => {
    if (history.length < 2) {
      return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '12px' }}>Esperando datos...</div>;
    }

    const maxPoints = 150;
    const pts = history.slice(-maxPoints);
    const minT = pts[0].time;
    const maxT = Math.max(pts[pts.length - 1].time, minT + 0.1);
    
    let maxVal = 0;
    pts.forEach(p => {
      maxVal = Math.max(maxVal, p[dataKey1] as number);
      if (dataKey2) maxVal = Math.max(maxVal, p[dataKey2] as number);
    });
    if (maxVal === 0) maxVal = 1;

    const generatePath = (key: keyof HistoryPoint) => {
      return pts.map((p, i) => {
        const x = ((p.time - minT) / (maxT - minT)) * 100;
        const y = 100 - (((p[key] as number) / maxVal) * 100);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');
    };

    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <path d={generatePath(dataKey1)} fill="none" stroke={color1} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {dataKey2 && color2 && (
          <path d={generatePath(dataKey2)} fill="none" stroke={color2} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
    );
  };

  return (
    <aside className={`panel glass-panel ${collapsed ? 'collapsed' : ''}`} style={{ position: 'absolute', zIndex: 10, left: '20px', top: '80px', minWidth: '320px' }}>
      <div className="panel-header">
        <h2><AreaChart size={16} /> Gráficas en Tiempo Real</h2>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '+' : '−'}
        </button>
      </div>

      {!collapsed && (
        <div className="panel-content" style={{ padding: '0' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <button 
              style={{ flex: 1, padding: '10px', background: activeTab === 'kinetics' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', border: 'none', borderBottom: activeTab === 'kinetics' ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === 'kinetics' ? '#60a5fa' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}
              onClick={() => setActiveTab('kinetics')}
            >
              <TrendingUp size={14} /> Cinemática
            </button>
            <button 
              style={{ flex: 1, padding: '10px', background: activeTab === 'energy' ? 'rgba(234, 179, 8, 0.2)' : 'transparent', border: 'none', borderBottom: activeTab === 'energy' ? '2px solid #eab308' : '2px solid transparent', color: activeTab === 'energy' ? '#fde047' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', fontWeight: 600 }}
              onClick={() => setActiveTab('energy')}
            >
              <Zap size={14} /> Energía
            </button>
          </div>

          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> Tiempo</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{lastPoint.time.toFixed(2)}s</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>Altura (y)</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#3b82f6' }}>{lastPoint.y.toFixed(2)}m</div>
              </div>
            </div>

            {activeTab === 'kinetics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '6px', color: '#94a3b8' }}>
                    <span style={{ color: '#3b82f6' }}>Altura (m)</span>
                    <span style={{ color: '#10b981' }}>Velocidad (m/s)</span>
                  </div>
                  <div style={{ height: '120px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                    {renderSVGChart('y', '#3b82f6', 'velocity', '#10b981')}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'energy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '6px', color: '#94a3b8' }}>
                    <span style={{ color: '#eab308' }}>Potencial (J)</span>
                    <span style={{ color: '#ef4444' }}>Cinética (J)</span>
                  </div>
                  <div style={{ height: '120px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                    {renderSVGChart('potentialEnergy', '#eab308', 'kineticEnergy', '#ef4444')}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ color: '#94a3b8' }}>Energía Mecánica Total:</span>
                  <span style={{ fontWeight: 'bold', color: '#fff' }}>{lastPoint.totalEnergy.toFixed(1)} J</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
