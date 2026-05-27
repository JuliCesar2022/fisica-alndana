import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { RootState } from '../../store/store';

// Lucide Icons
import { 
  SlidersHorizontal, 
  TrendingUp, 
  Zap, 
  Clock, 
  Home, 
  RotateCcw, 
  Play, 
  Pause, 
  Globe, 
  Weight, 
  Triangle, 
  Layers, 
  Ruler, 
  Target, 
  Edit2, 
  PlusCircle, 
  Info, 
  Sliders, 
  CloudRain, 
  Sun, 
  ArrowDownToLine, 
  Sigma, 
  HelpCircle,
  Hand,
  MousePointer,
  Link,
  Scissors,
  Sparkles,
  Plus,
  Trash2
} from 'lucide-react';

import katex from 'katex';
import { createPortal } from 'react-dom';

// Ramp Actions & Presets
import {
  setAngle,
  setMass as setRampMass,
  setGravity as setRampGravity,
  setMaterial,
  setPlaying as setRampPlaying,
  setCustomFriction,
  setCustomMaterialName,
  setRampLength,
  updateSensorDistance,
  addSensor,
  removeSensor,
  resetSimState as resetRampSimState,
  setRampScene,
  RampScene,
} from '../../store/rampSlice';
import { MATERIALS } from '../../utils/constants';

// Local physics simulation event constants (decoupled from individual panels)
export const EVENT_RESET_RAMP = 'evt_reset_ramp';
export const EVENT_RESET_FREEFALL = 'evt_reset_freefall';
export const EVENT_ADD_CHARGE = 'evt_add_charge';
export const EVENT_RESET_ELECTRO = 'evt_reset_electro';
export const EVENT_MOVE_CHARGE = 'evt_move_charge';
export const EVENT_RESET_PENDULUM = 'evt_reset_pendulum';

// Free Fall Actions & Presets
import {
  setHeight as setFFHeight,
  setMass as setFFMass,
  setGravity as setFFGravity,
  setPlanet,
  setPlaying as setFFPlaying,
  resetSimState as resetFFSimState
} from '../../store/freeFallSlice';

// Electrostatics Actions & Presets
import {
  setPlaying as setElectroPlaying,
  updateChargeValue,
  setVacuumMode,
  moveCharge,
  syncChargesFromEngine,
  deleteCharge,
  setSelectedCharge
} from '../../store/electroSlice';


// Pendulum Actions
import {
  setLength as setPendLength,
  setMass as setPendMass,
  setGravity as setPendGravity,
  setInitialAngle,
  setDamping,
  setPlaying as setPendPlaying,
  setPendulumScene,
  resetPendulum,
  PendulumScene,
} from '../../store/pendulumSlice';

// Collision Actions
import {
  setM1, setM2, setV1, setV2,
  setRestitution, setCollisionType,
  setPlaying as setCollisionPlaying,
  resetSim as resetCollisionSim,
  setCollisionScene,
  CollisionScene,
} from '../../store/collisionSlice';

// Circuit Actions
import {
  setVoltage, 
  setR1, 
  setR2, 
  setR3, 
  setR4, 
  setOpen, 
  setTopology, 
  CircuitTopology, 
  setActiveTool, 
  setDraggedComponent, 
  rotateDraggedComponent 
} from '../../store/circuitSlice';

// Inline SVGs / Charts helper
interface HistoryPoint {
  time: number;
  // Ramp properties
  velocity?: number;
  position?: number;
  kineticEnergy?: number;
  potentialEnergy?: number;
  totalEnergy?: number;
  // Freefall properties
  y?: number;
}

export default function MiroLeftPanel() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  // Active Tab: 'config' | 'formulas' | 'telemetry' | null
  const [activeTab, setActiveTab] = useState<'config' | 'formulas' | 'telemetry' | null>(null);

  const [showCircuitModal, setShowCircuitModal] = useState(false);
  const [circuitTelemetryTab, setCircuitTelemetryTab] = useState<'kinetics' | 'energy'>('kinetics');
  const [showAiTooltip, setShowAiTooltip] = useState(false);


  // Redux Selectors
  const ramp = useSelector((s: RootState) => s.ramp);
  const freefall = useSelector((s: RootState) => s.freefall);
  const electro = useSelector((s: RootState) => s.electrostatics);
  const circuit = useSelector((s: RootState) => s.circuit);
  const collision = useSelector((s: RootState) => s.collision);
  const pendulum = useSelector((s: RootState) => s.pendulum);

  // History buffer for live charts (shared)
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const prevTimeRef = useRef<number>(-1);

  useEffect(() => {
    if (ramp.isPlaying) {
      setActiveTab('formulas');
    }
  }, [ramp.isPlaying]);

  // Animated values for free fall when simulation finishes
  const [animFF, setAnimFF] = useState({ y: 0, velocity: 0, kineticEnergy: 0, potentialEnergy: 0, totalEnergy: 0, timeFall: 0 });
  const animFFFrameRef = useRef<number | null>(null);
  const animFFDoneRef = useRef<boolean>(false);

  const ffTargetRef = useRef({ y: 0, velocity: 0, kineticEnergy: 0, potentialEnergy: 0, totalEnergy: 0, timeFall: 0 });

  useEffect(() => {
    if (freefall.state.time === 0) {
      // Reset — clear animation and go back to zeros
      if (animFFFrameRef.current) { cancelAnimationFrame(animFFFrameRef.current); animFFFrameRef.current = null; }
      animFFDoneRef.current = false;
      setAnimFF({ y: 0, velocity: 0, kineticEnergy: 0, potentialEnergy: 0, totalEnergy: 0, timeFall: 0 });
      return;
    }

    if (freefall.isPlaying) {
      // Simulation started — begin counting, timed to match the visual fall duration
      if (animFFFrameRef.current !== null || animFFDoneRef.current) return;
      setActiveTab('formulas');
      const g = freefall.gravity;
      const h0 = freefall.height;
      const m = freefall.mass;
      const vImpact = Math.sqrt(2 * g * h0);
      const tFall = Math.sqrt(2 * h0 / g);
      const peInitial = m * g * h0;
      const target = { y: h0, velocity: vImpact, kineticEnergy: peInitial, potentialEnergy: peInitial, totalEnergy: peInitial, timeFall: tFall };
      ffTargetRef.current = target;
      // 3D scene runs at 2.2× speed — match animation to visual fall time
      const duration = (tFall / 2.2) * 1000;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        setAnimFF({
          y:               target.y               * ease,
          velocity:        target.velocity        * ease,
          kineticEnergy:   target.kineticEnergy   * ease,
          potentialEnergy: target.potentialEnergy * ease,
          totalEnergy:     target.totalEnergy     * ease,
          timeFall:        target.timeFall        * ease,
        });
        if (t < 1) {
          animFFFrameRef.current = requestAnimationFrame(tick);
        } else {
          animFFFrameRef.current = null;
          animFFDoneRef.current = true;
          setAnimFF({ ...target });
        }
      };
      animFFFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    if (!freefall.isPlaying && freefall.state.time > 0) {
      // Simulation ended — snap to final values if count is still running
      if (animFFFrameRef.current !== null) {
        cancelAnimationFrame(animFFFrameRef.current);
        animFFFrameRef.current = null;
      }
      animFFDoneRef.current = true;
      setAnimFF({ ...ffTargetRef.current });
    }
  }, [freefall.isPlaying, freefall.state.time]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear or sync telemetry history buffer based on running simulations
  useEffect(() => {
    if (path === '/ramp') {
      const curTime = ramp.state.time;
      if (curTime === 0) {
        setHistory([]);
        prevTimeRef.current = 0;
        return;
      }
      if (ramp.isPlaying && curTime > prevTimeRef.current) {
        setHistory(prev => {
          if (prev.length > 0 && prev[prev.length - 1].time === curTime) return prev;
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
          return next.slice(-150);
        });
        prevTimeRef.current = curTime;
      }
    } else if (path === '/freefall') {
      const curTime = freefall.state.time;
      if (curTime === 0) {
        setHistory([]);
        prevTimeRef.current = 0;
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
              totalEnergy: freefall.state.totalEnergy,
            }
          ];
          return next.slice(-150);
        });
        prevTimeRef.current = curTime;
      }
    } else {
      setHistory([]);
    }
  }, [
    path,
    ramp.state.time,
    ramp.isPlaying,
    ramp.state.velocity,
    ramp.state.position,
    ramp.state.kineticEnergy,
    ramp.state.potentialEnergy,
    ramp.state.totalEnergy,
    freefall.state.time,
    freefall.isPlaying,
    freefall.state.y,
    freefall.state.velocity,
    freefall.state.kineticEnergy,
    freefall.state.potentialEnergy,
    freefall.state.totalEnergy,
  ]);

  // Keep layout active tab sensible when switching routes
  useEffect(() => {
    if (path === '/electrostatics' || path === '/circuit') {
      if (activeTab === 'telemetry') {
        setActiveTab('config');
      }
    }
  }, [path]);

  // Keybindings listener for Circuit Topology = 'custom' (CAD tools)
  useEffect(() => {
    if (path !== '/circuit' || circuit.topology !== 'custom') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (circuit.draggedComponent) {
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
  }, [dispatch, path, circuit.topology, circuit.draggedComponent]);

  // Helpers
  const math = (expr: string, block = false) => {
    try {
      const html = katex.renderToString(expr, { displayMode: block, throwOnError: false, output: 'html' });
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e) {
      return <span>{expr}</span>;
    }
  };

  const getEffR = (slot: 'resistor' | 'wire' | 'empty', val: number) => {
    if (slot === 'wire') return 0.0001;
    if (slot === 'empty') return 1e9;
    return val;
  };

  const getDisplayR = (slot: 'resistor' | 'wire' | 'empty', val: number) => {
    if (slot === 'wire') return 'Cable';
    if (slot === 'empty') return 'Vacío';
    return `${val} Ω`;
  };

  const getSlotLabel = (slot: 'resistor' | 'wire' | 'empty', name: string, rVal: number) => {
    if (slot === 'wire') return `${name} (Cable: 0 \\Omega)`;
    if (slot === 'empty') return `${name} (Vacio: \\infty)`;
    return `${name} (${rVal} \\Omega)`;
  };

  // ----------------------------------------------------
  // RAMP PANEL RENDER
  // ----------------------------------------------------
  const renderRampConfig = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="control-group">
          <div className="control-label">
            <span><Triangle size={14} /> Ángulo (θ)</span>
            <span className="control-value">{ramp.angle}°</span>
          </div>
          <input type="range" min="5" max="80" step="1" value={ramp.angle} onChange={(e) => dispatch(setAngle(Number(e.target.value)))} />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span><Weight size={14} /> Masa (m)</span>
            <span className="control-value">{ramp.mass} kg</span>
          </div>
          <input type="range" min="0.5" max="50" step="0.5" value={ramp.mass} onChange={(e) => dispatch(setRampMass(Number(e.target.value)))} />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span><Globe size={14} /> Gravedad (g)</span>
            <span className="control-value">{ramp.gravity} m/s²</span>
          </div>
          <input type="range" min="1" max="25" step="0.1" value={ramp.gravity} onChange={(e) => dispatch(setRampGravity(Number(e.target.value)))} />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span><Layers size={14} /> Material</span>
            <span className="control-value">
              μ = {ramp.material === 'custom' ? ramp.customFriction.toFixed(2) : MATERIALS[ramp.material].frictionKinetic}
            </span>
          </div>
          <div className="material-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
            {Object.entries(MATERIALS).map(([key, mat]) => (
              <button 
                key={key} 
                className={`material-btn ${key === ramp.material ? 'active' : ''}`}
                onClick={() => dispatch(setMaterial(key))}
                style={{ fontSize: '11px', padding: '6px' }}
              >
                {mat.name}
                <span className="material-mu" style={{ display: 'block', fontSize: '9px', opacity: 0.7 }}>μ={mat.frictionKinetic}</span>
              </button>
            ))}
            <button 
              className={`material-btn ${ramp.material === 'custom' ? 'active' : ''}`}
              onClick={() => dispatch(setMaterial('custom'))}
              style={{ fontSize: '11px', padding: '6px', borderColor: ramp.material === 'custom' ? '#ec4899' : '' }}
            >
              Personalizado
              <span className="material-mu" style={{ display: 'block', fontSize: '9px', color: ramp.material === 'custom' ? '#ec4899' : '', opacity: 0.7 }}>
                μ={ramp.customFriction.toFixed(2)}
              </span>
            </button>
          </div>

          {ramp.material === 'custom' && (
            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <div className="control-label" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#ec4899' }}><Edit2 size={10} /> Nombre de Material</span>
                </div>
                <input 
                  type="text" 
                  value={ramp.customMaterialName}
                  onChange={(e) => dispatch(setCustomMaterialName(e.target.value))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                />
              </div>
              <div>
                <div className="control-label" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#ec4899' }}>Coeficiente de Fricción (μ)</span>
                  <span className="control-value">{ramp.customFriction.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.00" 
                  max="1.00" 
                  step="0.01" 
                  value={ramp.customFriction} 
                  onChange={(e) => dispatch(setCustomFriction(Number(e.target.value)))} 
                />
              </div>
            </div>
          )}
        </div>

        <div className="control-group">
          <div className="control-label">
            <span><Ruler size={14} /> Longitud Rampa</span>
            <span className="control-value">{ramp.rampLength.toFixed(2)} m</span>
          </div>
          <input 
            type="range" 
            min="0.10" 
            max="2.00" 
            step="0.01" 
            value={ramp.rampLength} 
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginTop: '6px' }}>
            {ramp.sensorDistances.map((dist, idx) => (
              <div key={`sensor-${idx}`} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>Sensor S{idx + 1}</span>
                  <input 
                    type="number" 
                    min="0" 
                    max={ramp.rampLength} 
                    step="0.01" 
                    value={dist} 
                    onChange={(e) => {
                      dispatch(updateSensorDistance({ index: idx, distance: Number(e.target.value) }));
                      window.dispatchEvent(new Event(EVENT_RESET_RAMP));
                    }}
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px', borderRadius: '4px', fontSize: '11px', width: '100%' }}
                  />
                </div>
                {ramp.sensorDistances.length > 1 && (
                  <button
                    onClick={() => dispatch(removeSensor(idx))}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', height: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Eliminar sensor"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => dispatch(addSensor())}
              style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px dashed rgba(59, 130, 246, 0.4)', color: '#60a5fa', borderRadius: '4px', padding: '6px', fontSize: '11px', cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              <Plus size={12} /> Añadir Sensor
            </button>
          </div>
        </div>

        {/* ── Scene Selector ── */}
        <div className="control-group">
          <div className="control-label">
            <span><Globe size={14} /> Escenario</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px' }}>
            {([
              { key: 'lab',      label: '🔬 Laboratorio' },
              { key: 'mountain', label: '⛰️ Montaña'     },
              { key: 'moon',     label: '🌕 Luna'         },
            ] as { key: RampScene; label: string }[]).map(s => (
              <button
                key={s.key}
                className={`material-btn ${(ramp.scene ?? 'lab') === s.key ? 'active' : ''}`}
                onClick={() => dispatch(setRampScene(s.key))}
                style={{ fontSize: '10px', padding: '7px 4px', textAlign: 'center' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRampFormulas = () => {
    const { angle, mass, gravity, material } = ramp;
    const mu = material === 'custom' ? ramp.customFriction : (MATERIALS[material]?.frictionKinetic ?? 0.35);
    const simFinished = !ramp.isPlaying && ramp.state.time > 0;
    const f = ramp.forces;
    const dash = '—';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, margin: '0 0 6px 0' }}>Teorema de la Rampa</h3>
          <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
            Análisis de descomposición de fuerzas gravitatorias en un plano inclinado con rozamiento cinético.
          </p>
        </div>

        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#ef4444' }}>Peso (F_g)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{simFinished ? `${f.weight.toFixed(2)} N` : dash}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#3b82f6' }}>F. Normal (N)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{simFinished ? `${f.normalForce.toFixed(2)} N` : dash}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#f59e0b' }}>F. Paralela</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{simFinished ? `${f.parallelForce.toFixed(2)} N` : dash}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#10b981' }}>Fricción (F_f)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{simFinished ? `${f.frictionForce.toFixed(2)} N` : dash}</span>
        </div>
        <div className="formula-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#f8fafc', fontWeight: 'bold' }}>Fuerza Neta</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{simFinished ? `${f.netForce.toFixed(2)} N` : dash}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#a5b4fc' }}>Aceleración</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{simFinished ? `${f.acceleration.toFixed(2)} m/s²` : dash}</span>
        </div>

        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
          {simFinished ? (
            <>
              <div style={{ fontSize: '10px', color: '#ef4444', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                {math(`F_g = m \\cdot g = ${mass} \\cdot ${gravity} = ${f.weight.toFixed(2)}\\text{ N}`, true)}
              </div>
              <div style={{ fontSize: '10px', color: '#3b82f6', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                {math(`N = F_g \\cdot \\cos(${angle}^\\circ) = ${f.normalForce.toFixed(2)}\\text{ N}`, true)}
              </div>
              <div style={{ fontSize: '10px', color: '#10b981', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                {math(`F_f = \\mu \\cdot N = ${mu} \\cdot ${f.normalForce.toFixed(2)} = ${f.frictionForce.toFixed(2)}\\text{ N}`, true)}
              </div>
              <div style={{ fontSize: '10px', color: '#a5b4fc', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                {math(`a = \\frac{F_{neta}}{m} = ${f.acceleration.toFixed(2)}\\text{ m/s}^2`, true)}
              </div>
            </>
          ) : ramp.isPlaying ? (
            <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
              Simulación en curso...
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
              Inicia la simulación para ver los resultados
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // FREE FALL PANEL RENDER
  // ----------------------------------------------------
  const renderFreeFallConfig = () => {
    const presets: { name: string; key: 'earth' | 'moon' | 'mars' | 'jupiter'; g: number }[] = [
      { name: 'Tierra', key: 'earth', g: 9.81 },
      { name: 'Luna', key: 'moon', g: 1.62 },
      { name: 'Marte', key: 'mars', g: 3.71 },
      { name: 'Júpiter', key: 'jupiter', g: 24.79 },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="control-group">
          <div className="control-label">
            <span><ArrowDownToLine size={14} /> Altura Inicial (h)</span>
            <span className="control-value">{freefall.height} m</span>
          </div>
          <input 
            type="range" min="10" max="500" step="5" 
            value={freefall.height} 
            onChange={(e) => {
              dispatch(setFFHeight(Number(e.target.value)));
              if (!freefall.isPlaying) window.dispatchEvent(new Event(EVENT_RESET_FREEFALL));
            }} 
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span><Weight size={14} /> Masa (m)</span>
            <span className="control-value">{freefall.mass} kg</span>
          </div>
          <input 
            type="range" min="0.1" max="100" step="0.1" 
            value={freefall.mass} 
            onChange={(e) => dispatch(setFFMass(Number(e.target.value)))} 
          />
        </div>

        <div className="control-group">
          <div className="control-label">
            <span><Globe size={14} /> Gravedad (g)</span>
            <span className="control-value">{freefall.gravity} m/s²</span>
          </div>
          <input 
            type="range" min="0.1" max="30" step="0.1" 
            value={freefall.gravity} 
            onChange={(e) => dispatch(setFFGravity(Number(e.target.value)))} 
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
            {presets.map(p => (
              <button
                key={p.name}
                className={`material-btn ${freefall.planet === p.key ? 'active' : ''}`}
                onClick={() => dispatch(setPlanet(p.key))}
                style={{ fontSize: '11px', padding: '6px' }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderFreeFallFormulas = () => {
    const { gravity: g, mass: m, height: h0 } = freefall;
    const simFinished = !freefall.isPlaying && freefall.state.time > 0;
    const f = animFF;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 600, margin: '0 0 6px 0' }}>Leyes de la Caída Libre</h3>
          <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
            Conservación de la energía mecánica total en condiciones de vacío clásico.
          </p>
        </div>

        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#3b82f6' }}>Altura inicial (h₀)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{`${f.y.toFixed(1)} m`}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#10b981' }}>Vel. impacto (v)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{`${f.velocity.toFixed(2)} m/s`}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#eab308' }}>E. Potencial (E_p)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{`${f.potentialEnergy.toFixed(1)} J`}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#ef4444' }}>E. Cinética (E_k)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{`${f.kineticEnergy.toFixed(1)} J`}</span>
        </div>
        <div className="formula-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#f8fafc', fontWeight: 'bold' }}>E. Mecánica Total</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{`${f.totalEnergy.toFixed(1)} J`}</span>
        </div>

        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
          {simFinished ? (
            <>
              <div style={{ fontSize: '10px', color: '#eab308', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                {math(`E_p = m \\cdot g \\cdot h_0 = ${m} \\cdot ${g} \\cdot ${h0} = ${f.potentialEnergy.toFixed(1)}\\text{ J}`, true)}
              </div>
              <div style={{ fontSize: '10px', color: '#ef4444', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                {math(`v = \\sqrt{2gh_0} = ${f.velocity.toFixed(2)}\\text{ m/s}`, true)}
              </div>
              <div style={{ fontSize: '10px', color: '#a5b4fc', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                {math(`t = \\sqrt{\\frac{2h_0}{g}} = ${f.timeFall.toFixed(3)}\\text{ s}`, true)}
              </div>
            </>
          ) : freefall.isPlaying ? (
            <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
              Simulación en curso...
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
              Inicia la simulación para ver los resultados
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // ELECTROSTATICS PANEL RENDER
  // ----------------------------------------------------
  const renderElectroConfig = () => {
    const selectedCharge = electro.charges.find(c => c.id === electro.selectedChargeId);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="control-group">
          <div className="control-label">
            <span style={{ color: '#ef4444', fontWeight: 600 }}><PlusCircle size={14} /> Nueva Carga</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button 
              className="material-btn" 
              style={{ flex: 1, borderColor: '#ef4444', color: '#ef4444', padding: '6px', fontSize: '11px' }} 
              onClick={() => window.dispatchEvent(new CustomEvent(EVENT_ADD_CHARGE, { detail: 5 }))}
            >
              + Positiva (+5 µC)
            </button>
            <button 
              className="material-btn" 
              style={{ flex: 1, borderColor: '#3b82f6', color: '#3b82f6', padding: '6px', fontSize: '11px' }} 
              onClick={() => window.dispatchEvent(new CustomEvent(EVENT_ADD_CHARGE, { detail: -5 }))}
            >
              - Negativa (-5 µC)
            </button>
          </div>
          <button 
            className="material-btn" 
            style={{ width: '100%', marginTop: '8px', borderColor: '#a5b4fc', color: '#a5b4fc', padding: '6px', fontSize: '11px' }} 
            onClick={() => {
              dispatch(syncChargesFromEngine([
                { id: `eq_${Date.now()}_1`, charge: 9, isStatic: true, x: -150, y: 24, z: 0 },
                { id: `eq_${Date.now()}_2`, charge: 4, isStatic: true, x: 100, y: 24, z: 0 },
                { id: `eq_${Date.now()}_3`, charge: -2, isStatic: false, x: 0, y: 24, z: 0 }
              ]));
            }}
          >
            <Target size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Cargar Set: Punto de Equilibrio
          </button>
        </div>

        <div className="control-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <p style={{ fontSize: '10.5px', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
            <Info size={11} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#3b82f6' }} /> 
            <b>Click</b> en una carga para seleccionarla o anclarla en el espacio.<br/>
            <Info size={11} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#3b82f6' }} /> 
            <b>Arrastra</b> libremente para reposicionarla y ver líneas de campo.
          </p>
        </div>



      </div>
    );
  };

  const renderElectroFormulas = () => {
    const effectiveId = electro.selectedChargeId
      ?? electro.charges.find(c => !c.isStatic)?.id
      ?? electro.charges[0]?.id
      ?? null;
    const target = electro.charges.find(c => c.id === effectiveId);
    let fStr = '—';
    if (target && electro.netForce !== null) {
      fStr = electro.netForce > 1000 || (electro.netForce < 0.001 && electro.netForce > 0)
        ? electro.netForce.toExponential(2) + ' N'
        : electro.netForce.toFixed(2) + ' N';
    }

    const others = target ? electro.charges.filter(c => c.id !== target.id) : [];
    const terms = others.map(other => {
      const dx = other.x - target!.x;
      const dy = other.y - target!.y;
      let distPx = Math.sqrt(dx*dx + dy*dy);
      if (distPx < 1) distPx = 1;
      const r = (distPx / 100).toFixed(2);
      return `8.99\\times10^9 \\frac{|${target!.charge}\\mu \\cdot ${other.charge}\\mu|}{(${r})^2}`;
    });

    const mathStr = target 
      ? `F_n = ` + terms.join(' + ') + (electro.netForce !== null ? ` = ${electro.netForce.toFixed(2)}\\text{ N}` : '')
      : 'F_{neta} = \\sum k \\frac{q_i q_j}{r^2}';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '12px', color: '#ec4899', fontWeight: 600, margin: '0 0 6px 0' }}>Ley de Coulomb & Campo</h3>
          <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
            Superposición vectorial de fuerzas electrostáticas provocadas por un conjunto de cargas puntuales.
          </p>
        </div>

        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#cbd5e1' }}>Cargas en escena</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{electro.charges.length}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#cbd5e1' }}>Carga Seleccionada</span>
          <span className="formula-value" style={{ fontWeight: 'bold', color: target ? (target.charge > 0 ? '#ef4444' : '#3b82f6') : '#475569' }}>
            {target
              ? `${target.charge > 0 ? '+' : ''}${target.charge} µC${!electro.selectedChargeId ? ' (auto)' : ''}`
              : 'Sin cargas'}
          </span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#ec4899' }}>Fuerza Neta</span>
          <span className="formula-value" style={{ fontWeight: 'bold', color: '#ec4899' }}>{fStr}</span>
        </div>

        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '9.5px', color: '#a5b4fc', textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
          {math(mathStr, true)}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // COLLISIONS PANEL RENDER
  // ----------------------------------------------------
  const renderCollisionConfig = () => {
    const typeBtn = (type: 'elastic' | 'inelastic' | 'partial', label: string, color: string) => (
      <button
        onClick={() => dispatch(setCollisionType(type))}
        style={{
          flex: 1, padding: '7px 4px', borderRadius: '8px', border: 'none',
          background: collision.collisionType === type ? color : 'rgba(255,255,255,0.05)',
          color: collision.collisionType === type ? '#fff' : '#94a3b8',
          fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
        }}
      >{label}</button>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Collision type selector */}
        <div>
          <span style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Tipo de Colisión</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {typeBtn('elastic',    'Elástica',   '#10b981')}
            {typeBtn('inelastic',  'Inelástica', '#ef4444')}
            {typeBtn('partial',    'Parcial',    '#f59e0b')}
          </div>
        </div>

        {/* Custom restitution */}
        {collision.collisionType === 'partial' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Coef. Restitución (e)</span>
              <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 'bold' }}>{collision.restitution.toFixed(2)}</span>
            </div>
            <input type="range" min="0.01" max="0.99" step="0.01"
              value={collision.restitution}
              onChange={e => dispatch(setRestitution(Number(e.target.value)))}
              style={{ width: '100%', accentColor: '#f59e0b' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#475569' }}>
              <span>0 (inelástica)</span><span>1 (elástica)</span>
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
          <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>Cuerpo 1 (Rojo)</span>
        </div>

        {/* Mass 1 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Masa (m₁)</span>
            <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 'bold' }}>{collision.m1.toFixed(1)} kg</span>
          </div>
          <input type="range" min="0.5" max="10" step="0.1"
            value={collision.m1}
            onChange={e => dispatch(setM1(Number(e.target.value)))}
            style={{ width: '100%', accentColor: '#ef4444' }}
          />
        </div>

        {/* Velocity 1 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Velocidad inicial (v₁)</span>
            <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 'bold' }}>{collision.v1 >= 0 ? '+' : ''}{collision.v1.toFixed(1)} m/s</span>
          </div>
          <input type="range" min="-10" max="10" step="0.5"
            value={collision.v1}
            onChange={e => dispatch(setV1(Number(e.target.value)))}
            style={{ width: '100%', accentColor: '#ef4444' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#475569' }}>
            <span>← izquierda</span><span>derecha →</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
          <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600 }}>Cuerpo 2 (Azul)</span>
        </div>

        {/* Mass 2 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Masa (m₂)</span>
            <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 'bold' }}>{collision.m2.toFixed(1)} kg</span>
          </div>
          <input type="range" min="0.5" max="10" step="0.1"
            value={collision.m2}
            onChange={e => dispatch(setM2(Number(e.target.value)))}
            style={{ width: '100%', accentColor: '#3b82f6' }}
          />
        </div>

        {/* Velocity 2 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Velocidad inicial (v₂)</span>
            <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 'bold' }}>{collision.v2 >= 0 ? '+' : ''}{collision.v2.toFixed(1)} m/s</span>
          </div>
          <input type="range" min="-10" max="10" step="0.5"
            value={collision.v2}
            onChange={e => dispatch(setV2(Number(e.target.value)))}
            style={{ width: '100%', accentColor: '#3b82f6' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#475569' }}>
            <span>← izquierda</span><span>derecha →</span>
          </div>
        </div>

        {/* Info */}
        <div style={{ background: 'rgba(129,140,248,0.07)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: '8px', padding: '10px', fontSize: '10px', color: '#94a3b8', lineHeight: 1.5 }}>
          <strong style={{ color: '#818cf8' }}>Positivo (+)</strong> = mueve hacia la derecha<br />
          <strong style={{ color: '#818cf8' }}>Negativo (−)</strong> = mueve hacia la izquierda<br />
          El cuerpo 1 empieza a la izquierda del cuerpo 2.
        </div>

        {/* ── Scene Selector ── */}
        <div>
          <span style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Escenario</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            {([
              { key: 'space',   label: '🌌 Espacio'  },
              { key: 'ice',     label: '🧊 Hielo'    },
              { key: 'billiard',label: '🎱 Billar'   },
            ] as { key: CollisionScene; label: string }[]).map(s => (
              <button
                key={s.key}
                className={`material-btn ${(collision.scene ?? 'space') === s.key ? 'active' : ''}`}
                onClick={() => dispatch(setCollisionScene(s.key))}
                style={{ fontSize: '10px', padding: '7px 4px', textAlign: 'center' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCollisionFormulas = () => {
    const r = collision.results;
    const done = !collision.isPlaying && r !== null;
    const dash = '—';

    const fmtV = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)} m/s`;
    const fmtN = (n: number) => `${n.toFixed(4)}`;

    const typeLabel =
      collision.collisionType === 'elastic'   ? 'Elástica (e = 1)'   :
      collision.collisionType === 'inelastic' ? 'Perfectamente Inelástica (e = 0)' :
                                                 `Parcialmente Elástica (e = ${collision.restitution.toFixed(2)})`;
    const typeColor =
      collision.collisionType === 'elastic'   ? '#10b981' :
      collision.collisionType === 'inelastic' ? '#ef4444' : '#f59e0b';

    const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px 0' }}>
        <span style={{ color: color ?? '#94a3b8' }}>{label}</span>
        <span style={{ fontWeight: 700, color: color ?? '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Header */}
        <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: '10px', padding: '10px 12px' }}>
          <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 700, marginBottom: '4px' }}>Conservación de Cantidad de Movimiento</div>
          <span style={{ fontSize: '10px', color: typeColor, fontWeight: 600 }}>{typeLabel}</span>
          <p style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.4, margin: '4px 0 0 0' }}>
            La cantidad de movimiento total se conserva en cualquier tipo de colisión.
          </p>
        </div>

        {/* Antes */}
        <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '10px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: '#f87171', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Antes de la colisión</div>
          <Row label="v₁ inicial" value={fmtV(collision.v1)} color="#f87171" />
          <Row label="v₂ inicial" value={fmtV(collision.v2)} color="#93c5fd" />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '4px', paddingTop: '4px' }}>
            <Row label="p total" value={done ? `${fmtN(r!.pBefore)} kg·m/s` : dash} color="#a5b4fc" />
            <Row label="E cinética" value={done ? `${fmtN(r!.keBefore)} J` : dash} color="#eab308" />
          </div>
        </div>

        {/* Después */}
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', padding: '10px 12px' }}>
          <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Después de la colisión</div>
          <Row label="v₁ final" value={done ? fmtV(r!.v1After) : dash} color={done ? '#f87171' : '#475569'} />
          <Row label="v₂ final" value={done ? fmtV(r!.v2After) : dash} color={done ? '#93c5fd' : '#475569'} />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '4px', paddingTop: '4px' }}>
            <Row label="p total" value={done ? `${fmtN(r!.pAfter)} kg·m/s` : dash} color="#a5b4fc" />
            <Row label="E cinética" value={done ? `${fmtN(r!.keAfter)} J` : dash} color="#eab308" />
          </div>
        </div>

        {/* Resumen */}
        <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', padding: '4px 0' }}>
            <span style={{ fontWeight: 700, color: '#f8fafc' }}>Energía perdida (ΔKE)</span>
            <span style={{ fontWeight: 700, color: done && r!.keLost > 0.001 ? '#ef4444' : '#10b981', fontVariantNumeric: 'tabular-nums' }}>
              {done ? `${fmtN(r!.keLost)} J` : dash}
            </span>
          </div>
          <Row label="Impulso (J)" value={done ? `${fmtN(r!.impulse)} N·s` : dash} color="#a5b4fc" />
        </div>

        {/* Fórmulas KaTeX */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {done ? (
            <>
              <div style={{ fontSize: '10px', color: '#a5b4fc', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px' }}>
                {math(`v_1' = \\frac{(m_1 - e\\,m_2)v_1 + m_2(1+e)v_2}{m_1+m_2} = ${r!.v1After.toFixed(3)}\\text{ m/s}`, true)}
              </div>
              <div style={{ fontSize: '10px', color: '#a5b4fc', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px' }}>
                {math(`v_2' = \\frac{(m_2 - e\\,m_1)v_2 + m_1(1+e)v_1}{m_1+m_2} = ${r!.v2After.toFixed(3)}\\text{ m/s}`, true)}
              </div>
              <div style={{ fontSize: '10px', color: '#10b981', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px' }}>
                {math(`p_{total} = ${r!.pBefore.toFixed(3)} \\approx ${r!.pAfter.toFixed(3)}\\text{ kg·m/s}\\;\\checkmark`, true)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
              {collision.isPlaying ? 'Simulación en curso...' : 'Ejecuta la simulación para ver los resultados'}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // CIRCUITS PANEL RENDER
  // ----------------------------------------------------
  const renderCircuitConfig = () => {
    const { voltage, r1, r2, r3, r4, topology, activeTool } = circuit;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="control-group">
          <div className="control-label">
            <span><Layers size={14} /> Topología</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
            <button 
              className={`material-btn ${topology === 'series' ? 'active' : ''}`}
              onClick={() => dispatch(setTopology('series'))}
              style={{ fontSize: '11px', padding: '6px' }}
            >
              Serie (3 R)
            </button>
            <button 
              className={`material-btn ${topology === 'parallel' ? 'active' : ''}`}
              onClick={() => dispatch(setTopology('parallel'))}
              style={{ fontSize: '11px', padding: '6px' }}
            >
              Paralelo (3 R)
            </button>
            <button 
              className={`material-btn ${topology === 'mixed' ? 'active' : ''}`}
              onClick={() => dispatch(setTopology('mixed'))}
              style={{ fontSize: '11px', padding: '6px' }}
            >
              Mixto (R1 + (R2||R3))
            </button>
            <button 
              className={`material-btn ${topology === 'custom' ? 'active' : ''}`}
              onClick={() => dispatch(setTopology('custom'))}
              style={{ fontSize: '11px', padding: '6px', borderColor: topology === 'custom' ? '#818cf8' : '' }}
            >
              Creador CAD
            </button>
          </div>
        </div>

        {/* CAD Toolbar Indicator - Explains that editing tools are now on the floating sidebar! */}
        {topology === 'custom' && (
          <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.12)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MousePointer size={12} /> Creador de Circuitos
            </div>
            <p style={{ fontSize: '9.5px', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>
              Las herramientas de edición (Mover, Resistencia, Cable, Borrar) están disponibles en la <b>barra lateral flotante</b>.
            </p>
            <p style={{ fontSize: '9px', color: '#cbd5e1', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>💡 Usa <b>R</b> o <b>Espacio</b> para rotar la resistencia seleccionada.</span>
            </p>
          </div>
        )}

        <div className="control-group">
          <div className="control-label">
            <span><Zap size={14} /> Voltaje Fuente (V_g)</span>
            <span className="control-value">{voltage} V</span>
          </div>
          <input type="range" min="1" max="48" step="1" value={voltage} onChange={(e) => dispatch(setVoltage(Number(e.target.value)))} />
        </div>

        {/* Dynamic Sliders based on active slots */}
        {(topology === 'series' || topology === 'parallel' || topology === 'mixed' || circuit.slot1 === 'resistor') && (
          <div className="control-group">
            <div className="control-label">
              <span style={{ color: '#f43f5e' }}><Sliders size={14} /> Resistencia 1 (R1)</span>
              <span className="control-value">{r1} Ω</span>
            </div>
            <input type="range" min="1" max="100" step="1" value={r1} onChange={(e) => dispatch(setR1(Number(e.target.value)))} />
          </div>
        )}

        {(topology === 'series' || topology === 'parallel' || topology === 'mixed' || circuit.slot2 === 'resistor') && (
          <div className="control-group">
            <div className="control-label">
              <span style={{ color: '#3b82f6' }}><Sliders size={14} /> Resistencia 2 (R2)</span>
              <span className="control-value">{r2} Ω</span>
            </div>
            <input type="range" min="1" max="100" step="1" value={r2} onChange={(e) => dispatch(setR2(Number(e.target.value)))} />
          </div>
        )}

        {(topology === 'series' || topology === 'parallel' || topology === 'mixed' || circuit.slot3 === 'resistor') && (
          <div className="control-group">
            <div className="control-label">
              <span style={{ color: '#10b981' }}><Sliders size={14} /> Resistencia 3 (R3)</span>
              <span className="control-value">{r3} Ω</span>
            </div>
            <input type="range" min="1" max="100" step="1" value={r3} onChange={(e) => dispatch(setR3(Number(e.target.value)))} />
          </div>
        )}

        {(topology === 'custom' && circuit.slot4 === 'resistor') && (
          <div className="control-group">
            <div className="control-label">
              <span style={{ color: '#c084fc' }}><Sliders size={14} /> Resistencia 4 (R4)</span>
              <span className="control-value">{r4} Ω</span>
            </div>
            <input type="range" min="1" max="100" step="1" value={r4} onChange={(e) => dispatch(setR4(Number(e.target.value)))} />
          </div>
        )}
      </div>
    );
  };

  const renderCircuitFormulas = () => {
    const { voltage, r1, r2, r3, r4, isOpen, topology, slot1, slot2, slot3, slot4 } = circuit;

    let req = 0;
    if (topology === 'series') {
      req = r1 + r2 + r3;
    } else if (topology === 'parallel') {
      req = 1 / (1/r1 + 1/r2 + 1/r3);
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
      if (req < 0.1) req = 0.1;
    }

    const current = isOpen ? 0 : voltage / req;
    const power = current * voltage;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, margin: '0 0 6px 0' }}>Resolución de Ley de Ohm</h3>
          <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
            Reducción y cálculo de magnitudes eléctricas equivalentes en mallas de resistencias.
          </p>
        </div>

        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#ef4444' }}>Voltaje Entrada (V_g)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{voltage.toFixed(1)} V</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#3b82f6' }}>Resistencia Eq. (R_eq)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{req >= 1e6 ? '∞ Ω' : `${req.toFixed(1)} Ω`}</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#10b981' }}>Intensidad Total (I_t)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{current.toFixed(4)} A</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span className="formula-name" style={{ color: '#ec4899' }}>Potencia Total (P_t)</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{power.toFixed(2)} W</span>
        </div>

        {isOpen ? (
          <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed rgba(239, 68, 68, 0.2)', borderRadius: '6px', fontSize: '10.5px', color: '#f87171', textAlign: 'center' }}>
            Interruptor Abierto. Cierra el circuito en la barra izquierda para simular el flujo eléctrico.
          </div>
        ) : (
          <button
            onClick={() => setShowCircuitModal(true)}
            style={{
              marginTop: '10px',
              width: '100%',
              padding: '8px',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(79,70,229,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'transform 0.1s'
            }}
          >
            <HelpCircle size={12} /> Ver Procedimiento de Reducción
          </button>
        )}

        {/* Procedural Modal Rendered via React Portal */}
        {showCircuitModal && createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(5, 7, 12, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '80vh',
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              color: '#f1f5f9',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                  <Sigma size={15} /> Memoria de Cálculo & Ley de Ohm
                </h3>
                <button 
                  onClick={() => setShowCircuitModal(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Dynamic steps text according to topology */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11.5px', lineHeight: 1.5 }}>
                {topology === 'series' && (
                  <>
                    <p><b>Paso 1: Reducción de Resistencias en Serie</b></p>
                    <p>En serie, la resistencia equivalente es la suma directa de los valores parciales:</p>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', color: '#818cf8' }}>
                      {math(`R_{eq} = R_1 + R_2 + R_3 = ${r1} + ${r2} + ${r3} = ${req.toFixed(1)}\\text{ }\\Omega`, true)}
                    </div>
                    <p><b>Paso 2: Cálculo de la Intensidad Total (Ley de Ohm)</b></p>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', color: '#10b981' }}>
                      {math(`I_t = \\frac{V_g}{R_{eq}} = \\frac{${voltage}}{${req.toFixed(1)}} = ${current.toFixed(4)}\\text{ A}`, true)}
                    </div>
                    <p>En serie, la corriente que fluye por cada elemento es idéntica: {math(`I_1 = I_2 = I_3 = I_t`)}.</p>
                  </>
                )}

                {topology === 'parallel' && (
                  <>
                    <p><b>Paso 1: Resistencia Equivalente en Paralelo</b></p>
                    <p>En paralelo, la conductancia equivalente es la suma de las conductancias inversas:</p>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', color: '#818cf8' }}>
                      {math(`\\frac{1}{R_{eq}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3} = \\frac{1}{${r1}} + \\frac{1}{${r2}} + \\frac{1}{${r3}}`, true)}
                      {math(`R_{eq} = ${req.toFixed(2)}\\text{ }\\Omega`, true)}
                    </div>
                    <p><b>Paso 2: Corrientes por Rama e Intensidad Total</b></p>
                    <p>Cada rama experimenta el mismo voltaje de la fuente ({voltage}V):</p>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', color: '#10b981' }}>
                      {math(`I_1 = \\frac{${voltage}}{${r1}} = ${(voltage/r1).toFixed(3)}\\text{ A}`, true)}
                      {math(`I_2 = \\frac{${voltage}}{${r2}} = ${(voltage/r2).toFixed(3)}\\text{ A}`, true)}
                      {math(`I_3 = \\frac{${voltage}}{${r3}} = ${(voltage/r3).toFixed(3)}\\text{ A}`, true)}
                      {math(`I_t = I_1 + I_2 + I_3 = ${current.toFixed(4)}\\text{ A}`, true)}
                    </div>
                  </>
                )}

                {(topology === 'mixed' || topology === 'custom') && (
                  <>
                    <p><b>Paso 1: Resolución de la sección en Paralelo (Bloque B)</b></p>
                    <p>Resolvemos el paralelo formado por las ramas paralelas activas:</p>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', color: '#818cf8' }}>
                      {math(`\\frac{1}{R_p} = \\sum \\frac{1}{R_{rama}}`, true)}
                      {math(`R_p = ${(req - getEffR(slot1, r1)).toFixed(2)}\\text{ }\\Omega`, true)}
                    </div>
                    <p><b>Paso 2: Suma en Serie con R1</b></p>
                    <p>La resistencia total equivalente de la red es la suma del elemento en serie R1 y el bloque paralelo Rp:</p>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                      {math(`R_{eq} = R_1 + R_p = ${getEffR(slot1, r1).toFixed(1)} + ${(req - getEffR(slot1, r1)).toFixed(2)} = ${req.toFixed(1)}\\text{ }\\Omega`, true)}
                    </div>
                  </>
                )}
              </div>

              <button 
                onClick={() => setShowCircuitModal(false)}
                style={{ marginTop: '20px', padding: '8px', border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
              >
                Cerrar Procedimiento
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  };

  // ----------------------------------------------------
  // TELEMETRY/CHARTS RENDER (Shared for /ramp & /freefall)
  // ----------------------------------------------------
  const renderTelemetryCharts = () => {
    const renderSensorTimes = () => {
      if (path !== '/ramp') return null;
      return (
        <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={14} color="#3b82f6" /> Tiempos de Sensores
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {ramp.sensorDistances.map((dist, idx) => {
              const t = ramp.state.sensorTimes?.[idx];
              return (
                <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>S{idx + 1} ({dist}m)</span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: t !== null && t !== undefined ? '#10b981' : '#64748b', fontWeight: 'bold' }}>
                    {t !== null && t !== undefined ? `${t.toFixed(3)} s` : '---'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    if (history.length < 2) {
      return (
        <>
          {renderSensorTimes()}
        <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '11.5px', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '12px', background: 'rgba(0,0,0,0.2)', padding: '20px', textAlign: 'center' }}>
          <Clock size={28} style={{ marginBottom: '10px', opacity: 0.5, color: '#3b82f6' }} />
          <span>Inicia la simulación para trazar gráficas de magnitudes físicas en tiempo real</span>
        </div>
        </>
      );
    }

    const width = 290;
    const height = 140;
    const padding = { top: 12, right: 10, bottom: 20, left: 30 };

    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const xMin = 0;
    const xMax = Math.max(1.5, history[history.length - 1].time);

    const getX = (t: number) => padding.left + ((t - xMin) / (xMax - xMin)) * plotW;

    // Resolve Y Max dynamically
    let yMin = 0;
    let yMax = 1.0;

    if (path === '/ramp') {
      if (circuitTelemetryTab === 'kinetics') {
        const maxVal = Math.max(...history.map(p => Math.max(p.velocity || 0, p.position || 0)));
        yMax = Math.max(1.0, maxVal * 1.15);
      } else {
        const maxVal = Math.max(...history.map(p => Math.max(p.kineticEnergy || 0, p.potentialEnergy || 0, p.totalEnergy || 0)));
        yMax = Math.max(5.0, maxVal * 1.15);
      }
    } else {
      if (circuitTelemetryTab === 'kinetics') {
        const maxVal = Math.max(...history.map(p => Math.max(p.y || 0, p.velocity || 0)));
        yMax = Math.max(10.0, maxVal * 1.15);
      } else {
        const maxVal = Math.max(...history.map(p => Math.max(p.kineticEnergy || 0, p.potentialEnergy || 0, p.totalEnergy || 0)));
        yMax = Math.max(100.0, maxVal * 1.15);
      }
    }

    const getY = (val: number) => padding.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

    const buildPath = (accessor: (p: HistoryPoint) => number) => {
      let d = '';
      history.forEach((p, idx) => {
        const x = getX(p.time);
        const y = getY(accessor(p));
        if (idx === 0) d += `M ${x} ${y}`;
        else d += ` L ${x} ${y}`;
      });
      return d;
    };

    let paths: { d: string; color: string; label: string; strokeDash?: string }[] = [];

    if (path === '/ramp') {
      if (circuitTelemetryTab === 'kinetics') {
        paths = [
          { d: buildPath(p => p.position || 0), color: '#3b82f6', label: 'Posición (m)' },
          { d: buildPath(p => p.velocity || 0), color: '#10b981', label: 'Velocidad (m/s)' },
        ];
      } else {
        paths = [
          { d: buildPath(p => p.kineticEnergy || 0), color: '#ec4899', label: 'Cinética (J)' },
          { d: buildPath(p => p.potentialEnergy || 0), color: '#f59e0b', label: 'Potencial (J)' },
          { d: buildPath(p => p.totalEnergy || 0), color: '#67e8f9', label: 'Mecánica (J)', strokeDash: '3,3' },
        ];
      }
    } else {
      if (circuitTelemetryTab === 'kinetics') {
        paths = [
          { d: buildPath(p => p.y || 0), color: '#3b82f6', label: 'Altura (y)' },
          { d: buildPath(p => p.velocity || 0), color: '#10b981', label: 'Velocidad (m/s)' },
        ];
      } else {
        paths = [
          { d: buildPath(p => p.kineticEnergy || 0), color: '#ef4444', label: 'Cinética (J)' },
          { d: buildPath(p => p.potentialEnergy || 0), color: '#eab308', label: 'Potencial (J)' },
          { d: buildPath(p => p.totalEnergy || 0), color: '#38bdf8', label: 'Total Mecánica', strokeDash: '3,3' },
        ];
      }
    }

    const gridLines = [];
    const ticksCount = 3;
    for (let i = 0; i <= ticksCount; i++) {
      const ratio = i / ticksCount;
      const y = padding.top + ratio * plotH;
      const val = yMax - ratio * (yMax - yMin);
      gridLines.push({ y, label: val.toFixed(0) });
    }

    const lastPoint = history[history.length - 1];

    return (
      <>
        {renderSensorTimes()}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '2px' }}>
          <button 
            style={{ flex: 1, padding: '8px', background: circuitTelemetryTab === 'kinetics' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', border: 'none', borderBottom: circuitTelemetryTab === 'kinetics' ? '2px solid #3b82f6' : '2px solid transparent', color: circuitTelemetryTab === 'kinetics' ? '#60a5fa' : '#94a3b8', cursor: 'pointer', fontSize: '10.5px', fontWeight: 600 }}
            onClick={() => setCircuitTelemetryTab('kinetics')}
          >
            Cinemática
          </button>
          <button 
            style={{ flex: 1, padding: '8px', background: circuitTelemetryTab === 'energy' ? 'rgba(234, 179, 8, 0.15)' : 'transparent', border: 'none', borderBottom: circuitTelemetryTab === 'energy' ? '2px solid #eab308' : '2px solid transparent', color: circuitTelemetryTab === 'energy' ? '#fde047' : '#94a3b8', cursor: 'pointer', fontSize: '10.5px', fontWeight: 600 }}
            onClick={() => setCircuitTelemetryTab('energy')}
          >
            Energías
          </button>
        </div>

        {/* Live Numbers Overlay */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>Tiempo</span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{lastPoint.time.toFixed(2)}s</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>
              {path === '/ramp' ? 'Posición' : 'Altura'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#3b82f6' }}>
              {path === '/ramp' ? (lastPoint.position || 0).toFixed(2) + 'm' : (lastPoint.y || 0).toFixed(1) + 'm'}
            </span>
          </div>
        </div>

        {/* The SVG Plot */}
        <div style={{ position: 'relative', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            {gridLines.map((line, idx) => (
              <g key={idx} opacity={0.1}>
                <line x1={padding.left} y1={line.y} x2={width - padding.right} y2={line.y} stroke="#fff" strokeWidth="1" />
                <text x={padding.left - 6} y={line.y + 3} fill="#fff" fontSize="8px" fontFamily="monospace" textAnchor="end">{line.label}</text>
              </g>
            ))}

            <g opacity={0.2}>
              <line x1={padding.left} y1={padding.top + plotH} x2={width - padding.right} y2={padding.top + plotH} stroke="#fff" strokeWidth="1" />
              <text x={padding.left} y={padding.top + plotH + 12} fill="#fff" fontSize="8px" fontFamily="monospace">0.0s</text>
              <text x={width - padding.right} y={padding.top + plotH + 12} fill="#fff" fontSize="8px" fontFamily="monospace" textAnchor="end">{xMax.toFixed(1)}s</text>
            </g>

            {paths.map((path, idx) => (
              <g key={idx}>
                <path d={path.d} fill="none" stroke={path.color} strokeWidth="3" opacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d={path.d} fill="none" stroke={path.color} strokeWidth="1.5" strokeDasharray={path.strokeDash} strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ))}
          </svg>

          {/* Color legends */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            {paths.map((path, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: path.color }}></span>
                <span style={{ color: '#94a3b8' }}>{path.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
    );
  };

  // ----------------------------------------------------
  // PENDULUM PANEL RENDER
  // ----------------------------------------------------
  const renderPendulumConfig = () => {
    const gravPresets = [
      { name: 'Tierra', g: 9.81 }, { name: 'Luna', g: 1.62 },
      { name: 'Marte', g: 3.71 }, { name: 'Júpiter', g: 24.79 },
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Longitud (L)</span>
            <span style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 'bold' }}>{pendulum.length.toFixed(2)} m</span>
          </div>
          <input type="range" min="0.3" max="5.0" step="0.05" value={pendulum.length}
            onChange={e => { dispatch(setPendLength(Number(e.target.value))); window.dispatchEvent(new Event(EVENT_RESET_PENDULUM)); }}
            style={{ width: '100%', accentColor: '#a5b4fc' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Masa (m)</span>
            <span style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 'bold' }}>{pendulum.mass.toFixed(1)} kg</span>
          </div>
          <input type="range" min="0.1" max="10.0" step="0.1" value={pendulum.mass}
            onChange={e => dispatch(setPendMass(Number(e.target.value)))}
            style={{ width: '100%', accentColor: '#a5b4fc' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Ángulo inicial (θ₀)</span>
            <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 'bold' }}>{pendulum.initialAngle}°</span>
          </div>
          <input type="range" min="5" max="85" step="1" value={pendulum.initialAngle}
            onChange={e => { dispatch(setInitialAngle(Number(e.target.value))); window.dispatchEvent(new Event(EVENT_RESET_PENDULUM)); }}
            style={{ width: '100%', accentColor: '#f59e0b' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Amortiguamiento (b)</span>
            <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 'bold' }}>{pendulum.damping.toFixed(2)}</span>
          </div>
          <input type="range" min="0.00" max="0.5" step="0.01" value={pendulum.damping}
            onChange={e => dispatch(setDamping(Number(e.target.value)))}
            style={{ width: '100%', accentColor: '#f87171' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#475569' }}>
            <span>Sin fricción</span><span>Muy amortiguado</span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>Gravedad (g)</span>
            <span style={{ fontSize: '11px', color: '#a5b4fc', fontWeight: 'bold' }}>{pendulum.gravity.toFixed(2)} m/s²</span>
          </div>
          <input type="range" min="0.5" max="30" step="0.1" value={pendulum.gravity}
            onChange={e => { dispatch(setPendGravity(Number(e.target.value))); window.dispatchEvent(new Event(EVENT_RESET_PENDULUM)); }}
            style={{ width: '100%', accentColor: '#a5b4fc' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
            {gravPresets.map(p => (
              <button key={p.name}
                className={`material-btn ${Math.abs(pendulum.gravity - p.g) < 0.01 ? 'active' : ''}`}
                onClick={() => { dispatch(setPendGravity(p.g)); window.dispatchEvent(new Event(EVENT_RESET_PENDULUM)); }}
                style={{ fontSize: '11px', padding: '6px' }}>{p.name}</button>
            ))}
          </div>
        </div>

        {/* Scene selector */}
        <div>
          <span style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '6px', display: 'block' }}>Escenario</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            {([
              { key: 'lab',   label: '🔬 Laboratorio' },
              { key: 'moon',  label: '🌕 Luna'         },
              { key: 'water', label: '💧 Agua'          },
            ] as { key: PendulumScene; label: string }[]).map(s => (
              <button key={s.key}
                className={`material-btn ${(pendulum.scene ?? 'lab') === s.key ? 'active' : ''}`}
                onClick={() => dispatch(setPendulumScene(s.key))}
                style={{ fontSize: '10px', padding: '7px 4px', textAlign: 'center' }}
              >{s.label}</button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPendulumFormulas = () => {
    const { length: L, mass: m, gravity: g, initialAngle, damping: b } = pendulum;
    const theta0 = (initialAngle * Math.PI) / 180;
    const T = 2 * Math.PI * Math.sqrt(L / g);
    const vMax = Math.sqrt(2 * g * L * (1 - Math.cos(theta0)));
    const Etotal = m * g * L * (1 - Math.cos(theta0));
    const { state: ps } = pendulum;
    const running = pendulum.isPlaying || ps.time > 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          <h3 style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 600, margin: '0 0 6px 0' }}>Péndulo Simple</h3>
          <p style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
            Oscilación bajo gravedad con integración numérica RK4. La energía se conserva sin amortiguamiento.
          </p>
        </div>

        {/* Theoretical values (always shown) */}
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#a5b4fc' }}>Período teórico (T)</span>
          <span style={{ fontWeight: 'bold' }}>{T.toFixed(3)} s</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#f59e0b' }}>v_max (en base)</span>
          <span style={{ fontWeight: 'bold' }}>{vMax.toFixed(3)} m/s</span>
        </div>
        <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: '#10b981' }}>E. Mecánica total</span>
          <span style={{ fontWeight: 'bold' }}>{Etotal.toFixed(3)} J</span>
        </div>

        {/* Live values */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#ef4444' }}>E. Cinética (KE)</span>
            <span style={{ fontWeight: 'bold' }}>{running ? `${ps.kineticEnergy.toFixed(3)} J` : '—'}</span>
          </div>
          <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#3b82f6' }}>E. Potencial (PE)</span>
            <span style={{ fontWeight: 'bold' }}>{running ? `${ps.potentialEnergy.toFixed(3)} J` : '—'}</span>
          </div>
          <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#94a3b8' }}>Período medido</span>
            <span style={{ fontWeight: 'bold' }}>{ps.period > 0 ? `${ps.period.toFixed(3)} s` : '—'}</span>
          </div>
          <div className="formula-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#94a3b8' }}>Oscilaciones (n)</span>
            <span style={{ fontWeight: 'bold' }}>{running ? ps.oscillations : '—'}</span>
          </div>
        </div>

        {/* KaTeX equations */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '10px', color: '#a5b4fc', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
            {math(`T = 2\\pi\\sqrt{\\frac{L}{g}} = 2\\pi\\sqrt{\\frac{${L}}{${g}}} = ${T.toFixed(3)}\\text{ s}`, true)}
          </div>
          <div style={{ fontSize: '10px', color: '#f59e0b', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
            {math(`v_{max} = \\sqrt{2gL(1-\\cos\\theta_0)} = ${vMax.toFixed(3)}\\text{ m/s}`, true)}
          </div>
          <div style={{ fontSize: '10px', color: '#10b981', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
            {math(`E = mgL(1-\\cos\\theta_0) = ${Etotal.toFixed(3)}\\text{ J}`, true)}
          </div>
          {b > 0 && (
            <div style={{ fontSize: '10px', color: '#f87171', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
              {math(`\\ddot{\\theta} = -\\frac{g}{L}\\sin\\theta - b\\dot{\\theta},\\quad b=${b}`, true)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Dispatch play actions based on current active route
  const handlePlayToggle = () => {
    if (path === '/ramp') {
      dispatch(setRampPlaying(!ramp.isPlaying));
    } else if (path === '/freefall') {
      dispatch(setFFPlaying(!freefall.isPlaying));
    } else if (path === '/collision') {
      dispatch(setCollisionPlaying(!collision.isPlaying));
    } else if (path === '/pendulum') {
      dispatch(setPendPlaying(!pendulum.isPlaying));
    } else if (path === '/electrostatics') {
      dispatch(setElectroPlaying(!electro.isPlaying));
    } else if (path === '/circuit') {
      dispatch(setOpen(!circuit.isOpen)); // toggles circuit switch closed/open
    }
  };

  const handleReset = () => {
    if (path === '/ramp') {
      dispatch(resetRampSimState());
      window.dispatchEvent(new Event(EVENT_RESET_RAMP));
    } else if (path === '/collision') {
      dispatch(resetCollisionSim());
    } else if (path === '/pendulum') {
      dispatch(resetPendulum());
      window.dispatchEvent(new Event(EVENT_RESET_PENDULUM));
    } else if (path === '/freefall') {
      dispatch(resetFFSimState());
      window.dispatchEvent(new Event(EVENT_RESET_FREEFALL));
    } else if (path === '/electrostatics') {
      dispatch(setElectroPlaying(false));
      window.dispatchEvent(new Event(EVENT_RESET_ELECTRO));
    }
  };

  // Determine standard title inside panel header
  const getPanelTitle = () => {
    switch (path) {
      case '/ramp': return 'Plano Inclinado';
      case '/freefall': return 'Caída Libre';
      case '/electrostatics': return 'Cargas Eléctricas';
      case '/circuit': return 'Resistencias CAD';
      case '/collision': return 'Colisiones';
      default: return 'Física 3D';
    }
  };

  const isSimPlaying = () => {
    if (path === '/ramp') return ramp.isPlaying;
    if (path === '/freefall') return freefall.isPlaying;
    if (path === '/electrostatics') return electro.isPlaying;
    if (path === '/circuit') return !circuit.isOpen; // closed circuit is running
    if (path === '/collision') return collision.isPlaying;
    if (path === '/pendulum') return pendulum.isPlaying;
    return false;
  };

  // Main Miro Layout
  return (
    <div className="miro-left-container">
      
      {/* 1. Far-left Vertical Miro Toolbar */}
      <div className="miro-toolbar">
        
        {/* Navigation Home */}
        <button 
          className="miro-toolbar-btn" 
          onClick={() => navigate('/')} 
          title="Regresar al Menú"
          style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <Home size={18} style={{ margin: 'auto' }} />
        </button>

        <div className="miro-toolbar-divider" />

        {/* Tab 0: Cursor / Selection (Miro default) */}
        <button 
          className={`miro-toolbar-btn ${activeTab === null ? 'active' : ''}`}
          onClick={() => setActiveTab(null)}
          title="Herramienta Seleccionar (V)"
          style={{
            width: '36px', height: '36px', borderRadius: '10px', border: 'none',
            background: activeTab === null ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            color: activeTab === null ? '#3b82f6' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
            boxShadow: activeTab === null ? '0 0 8px rgba(59, 130, 246, 0.25)' : 'none'
          }}
        >
          <MousePointer size={18} style={{ margin: 'auto', transform: 'rotate(-25deg)' }} />
        </button>

        <div className="miro-toolbar-divider" />

        {/* Tab 1: Config */}
        <button 
          className={`miro-toolbar-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab(activeTab === 'config' ? null : 'config')}
          title="Ajustes y Controles"
          style={{
            width: '36px', height: '36px', borderRadius: '10px', border: 'none',
            background: activeTab === 'config' ? 'linear-gradient(135deg, #3b82f6, #818cf8)' : 'transparent',
            color: activeTab === 'config' ? '#ffffff' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
            boxShadow: activeTab === 'config' ? '0 2px 10px rgba(99,102,241,0.4)' : 'none'
          }}
        >
          <SlidersHorizontal size={18} style={{ margin: 'auto' }} />
        </button>

        {/* Tab 2: Formulas */}
        <button 
          className={`miro-toolbar-btn ${activeTab === 'formulas' ? 'active' : ''}`}
          onClick={() => setActiveTab(activeTab === 'formulas' ? null : 'formulas')}
          title="Fórmulas y Procedimiento"
          style={{
            width: '36px', height: '36px', borderRadius: '10px', border: 'none',
            background: activeTab === 'formulas' ? 'linear-gradient(135deg, #3b82f6, #818cf8)' : 'transparent',
            color: activeTab === 'formulas' ? '#ffffff' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
            boxShadow: activeTab === 'formulas' ? '0 2px 10px rgba(99,102,241,0.4)' : 'none'
          }}
        >
          <Sigma size={18} style={{ margin: 'auto' }} />
        </button>

        {/* Tab 3: Telemetry Charts (Only for Ramp and Freefall) */}
        {(path === '/ramp' || path === '/freefall') && (
          <button 
            className={`miro-toolbar-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab(activeTab === 'telemetry' ? null : 'telemetry')}
            title="Gráficas en Tiempo Real"
            style={{
              width: '36px', height: '36px', borderRadius: '10px', border: 'none',
              background: activeTab === 'telemetry' ? 'linear-gradient(135deg, #3b82f6, #818cf8)' : 'transparent',
              color: activeTab === 'telemetry' ? '#ffffff' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
              boxShadow: activeTab === 'telemetry' ? '0 2px 10px rgba(99,102,241,0.4)' : 'none'
            }}
          >
            <TrendingUp size={18} style={{ margin: 'auto' }} />
          </button>
        )}

        {/* Tab 4: AI Assist (Disabled / Coming soon) */}
        <div 
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowAiTooltip(true)}
          onMouseLeave={() => setShowAiTooltip(false)}
        >
          <button 
            className="miro-toolbar-btn"
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))',
              border: '1px dashed rgba(168, 85, 247, 0.3)',
              color: '#d8b4fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              cursor: 'not-allowed', transition: 'all 0.25s ease',
              opacity: 0.7
            }}
          >
            <Sparkles size={18} style={{ margin: 'auto' }} />
          </button>
          
          {/* Glowing dot */}
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '6px',
            height: '6px',
            background: '#ec4899',
            borderRadius: '50%',
            boxShadow: '0 0 8px #ec4899'
          }} />

          {/* Premium Tooltip */}
          {showAiTooltip && (
            <div style={{
              position: 'absolute',
              left: '52px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.2)',
              color: '#f3e8ff',
              fontSize: '11px',
              zIndex: 1000,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              animation: 'fadeIn 0.15s ease-out'
            }}>
              <Sparkles size={12} style={{ color: '#a855f7' }} />
              <span>Miguel AI <strong style={{ color: '#ec4899', textTransform: 'uppercase', fontSize: '9px', background: 'rgba(236, 72, 153, 0.15)', padding: '2px 4px', borderRadius: '4px', marginLeft: '4px' }}>Próximamente</strong></span>
            </div>
          )}

        </div>

        {/* CAD Tools (Only active inside /circuit custom Creador CAD) */}
        {path === '/circuit' && circuit.topology === 'custom' && (
          <>
            <div className="miro-toolbar-divider" />
            
            {/* Mover/Pan */}
            <button
              onClick={() => dispatch(setActiveTool('pan'))}
              title="Herramienta Mover Tablero (M)"
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                background: circuit.activeTool === 'pan' ? '#4f46e5' : 'transparent',
                color: circuit.activeTool === 'pan' ? '#fff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
                boxShadow: circuit.activeTool === 'pan' ? '0 0 8px rgba(79, 70, 229, 0.4)' : 'none'
              }}
              onMouseEnter={(e) => { if (circuit.activeTool !== 'pan') e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (circuit.activeTool !== 'pan') e.currentTarget.style.background = 'transparent'; }}
            >
              <Hand size={18} />
            </button>

            {/* Resistor */}
            <button
              onClick={() => dispatch(setActiveTool('resistor'))}
              title="Colocar Resistencia (R)"
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                background: circuit.activeTool === 'resistor' ? '#f43f5e' : 'transparent',
                color: circuit.activeTool === 'resistor' ? '#fff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
                boxShadow: circuit.activeTool === 'resistor' ? '0 0 8px rgba(244, 63, 94, 0.4)' : 'none'
              }}
              onMouseEnter={(e) => { if (circuit.activeTool !== 'resistor') e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (circuit.activeTool !== 'resistor') e.currentTarget.style.background = 'transparent'; }}
            >
              <Zap size={18} />
            </button>

            {/* Wire */}
            <button
              onClick={() => dispatch(setActiveTool('wire'))}
              title="Colocar Cable Directo (C)"
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                background: circuit.activeTool === 'wire' ? '#10b981' : 'transparent',
                color: circuit.activeTool === 'wire' ? '#fff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
                boxShadow: circuit.activeTool === 'wire' ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'
              }}
              onMouseEnter={(e) => { if (circuit.activeTool !== 'wire') e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (circuit.activeTool !== 'wire') e.currentTarget.style.background = 'transparent'; }}
            >
              <Link size={18} style={{ transform: 'rotate(-45deg)' }} />
            </button>

            {/* Eraser */}
            <button
              onClick={() => dispatch(setActiveTool('eraser'))}
              title="Borrador (E / B)"
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                background: circuit.activeTool === 'eraser' ? '#ef4444' : 'transparent',
                color: circuit.activeTool === 'eraser' ? '#fff' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
                boxShadow: circuit.activeTool === 'eraser' ? '0 0 8px rgba(239, 68, 68, 0.4)' : 'none'
              }}
              onMouseEnter={(e) => { if (circuit.activeTool !== 'eraser') e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { if (circuit.activeTool !== 'eraser') e.currentTarget.style.background = 'transparent'; }}
            >
              <Scissors size={18} />
            </button>
          </>
        )}

        <div className="miro-toolbar-divider" />


        {/* Play / Pause simulation */}
        <button 
          className={`miro-toolbar-btn ${isSimPlaying() ? 'simulating' : ''}`}
          onClick={handlePlayToggle}
          title={isSimPlaying() ? "Pausar Simulación" : "Iniciar Simulación"}
          style={{
            width: '36px', height: '36px', borderRadius: '10px', border: 'none',
            background: isSimPlaying() ? 'linear-gradient(135deg, #ef4444, #f43f5e)' : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}
        >
          {isSimPlaying() ? <Pause size={18} style={{ margin: 'auto' }} /> : <Play size={18} style={{ margin: 'auto', transform: 'translateX(1px)' }} />}
        </button>

        {/* Reset (not for Circuit) */}
        {path !== '/circuit' && (
          <button 
            className="miro-toolbar-btn"
            onClick={handleReset}
            title="Reiniciar Simulación"
            style={{ width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: 'transparent', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <RotateCcw size={18} style={{ margin: 'auto' }} />
          </button>
        )}
      </div>

      {/* 2. Collapsible Slide-out Content Board (Miro style) */}
      {activeTab && (
        <div className="miro-content-board glass-panel">

        
        {/* Panel Header */}
        <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 'bold', color: '#f1f5f9', letterSpacing: '0.02em', textTransform: 'uppercase', margin: 0 }}>
            {getPanelTitle()}
          </h2>
          <span style={{ fontSize: '9px', color: '#818cf8', fontWeight: 'bold', textTransform: 'uppercase', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
            {activeTab === 'config' ? 'Ajustes' : activeTab === 'formulas' ? 'Fórmulas' : 'Gráficas'}
          </span>
        </div>

        {/* Panel Body */}
        <div className="panel-content" style={{ padding: '16px', overflowY: 'auto', flex: 1, maxHeight: 'none' }}>
          {activeTab === 'config' && (
            <>
              {path === '/ramp' && renderRampConfig()}
              {path === '/freefall' && renderFreeFallConfig()}
              {path === '/electrostatics' && renderElectroConfig()}
              {path === '/circuit' && renderCircuitConfig()}
              {path === '/collision' && renderCollisionConfig()}
              {path === '/pendulum' && renderPendulumConfig()}
            </>
          )}

          {activeTab === 'formulas' && (
            <>
              {path === '/ramp' && renderRampFormulas()}
              {path === '/freefall' && renderFreeFallFormulas()}
              {path === '/electrostatics' && renderElectroFormulas()}
              {path === '/circuit' && renderCircuitFormulas()}
              {path === '/collision' && renderCollisionFormulas()}
              {path === '/pendulum' && renderPendulumFormulas()}
            </>
          )}

          {activeTab === 'telemetry' && (
            <>
              {(path === '/ramp' || path === '/freefall') && renderTelemetryCharts()}
            </>
          )}
        </div>
      </div>
      )}
    </div>


  );
}
