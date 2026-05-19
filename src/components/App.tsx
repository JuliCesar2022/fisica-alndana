import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Triangle, CircleDashed, Battery, Atom, Orbit, Pin, PinOff, Trash2, RefreshCw, Zap } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { updateChargeValue } from '../store/electroSlice';
import PhaserGame from './PhaserGame';
import RampPanel from './panels/RampPanel';
import RampChartsPanel from './panels/RampChartsPanel';
import ElectrostaticsPanel from './panels/ElectrostaticsPanel';
import CircuitPanel from './panels/CircuitPanel';
import FormulaPanel from './panels/FormulaPanel';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [toastMsg, setToastMsg] = React.useState('');

  const handleNav = (path: string, key: string) => {
    if (['/freefall', '/collision', '/pendulum'].includes(path)) {
      setToastMsg('Esta simulación estará disponible próximamente.');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }
    navigate(path);
  };

  return (
    <header id="top-bar">
      <div className="top-bar-left">
        <div className="logo"><Atom size={24} color="#3b82f6" /></div>
        <h1>Laboratorio de Física - Miguel Aldana</h1>
        <span className="badge">ABP</span>
      </div>

      <nav className="top-bar-center">
        <button className={`nav-btn ${location.pathname === '/' ? 'active' : ''}`} onClick={() => handleNav('/', 'menu')}>
          <Menu className="nav-icon" size={16} /> Menú
        </button>
        <button className={`nav-btn ${location.pathname === '/ramp' ? 'active' : ''}`} onClick={() => handleNav('/ramp', 'ramp')}>
          <Triangle className="nav-icon" size={16} /> Rampa
        </button>
        <button className={`nav-btn disabled`} onClick={() => handleNav('/freefall', 'freefall')}>
          <CircleDashed className="nav-icon" size={16} /> Caída Libre
        </button>
        <button className={`nav-btn ${location.pathname === '/electrostatics' ? 'active' : ''}`} onClick={() => handleNav('/electrostatics', 'electrostatics')}>
          <Battery className="nav-icon" size={16} /> Cargas
        </button>
        <button className={`nav-btn ${location.pathname === '/circuit' ? 'active' : ''}`} onClick={() => handleNav('/circuit', 'circuit')}>
          <Zap className="nav-icon" size={16} /> Circuitos
        </button>
        <button className={`nav-btn disabled`} onClick={() => handleNav('/collision', 'collision')}>
          <Orbit className="nav-icon" size={16} /> Colisiones
        </button>
      </nav>

      <div className="top-bar-right"></div>

      {toastMsg && (
        <div className="toast-notification">
          <span>{toastMsg}</span>
        </div>
      )}
    </header>
  );
};

export default function App() {
  const dispatch = useDispatch();
  const [contextMenu, setContextMenu] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    chargeId: string;
    isStatic: boolean;
    chargeVal: number;
  } | null>(null);

  React.useEffect(() => {
    const handleShowMenu = (e: any) => {
      const { id, x, y, charge, isStatic } = e.detail;
      setContextMenu({
        visible: true,
        x,
        y,
        chargeId: id,
        chargeVal: charge,
        isStatic
      });
    };
    
    const handleCloseMenu = () => {
      setContextMenu(null);
    };

    window.addEventListener('evt_show_charge_context_menu', handleShowMenu);
    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('pointerdown', handleCloseMenu);

    return () => {
      window.removeEventListener('evt_show_charge_context_menu', handleShowMenu);
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('pointerdown', handleCloseMenu);
    };
  }, []);

  return (
    <>
      <PhaserGame />
      
      <div id="ui-overlay">
        <Header />
        
        <Routes>
          <Route path="/" element={<div />} /> {/* Menu Scene handles its own UI inside canvas currently, or we can overlay */}
          <Route path="/ramp" element={<><RampPanel /><RampChartsPanel /><FormulaPanel type="ramp" /></>} />
          <Route path="/electrostatics" element={<><ElectrostaticsPanel /><FormulaPanel type="electro" /></>} />
          <Route path="/circuit" element={<><CircuitPanel /><FormulaPanel type="circuit" /></>} />
        </Routes>
      </div>

      {contextMenu && contextMenu.visible && (
        <div 
          className="glass-panel" 
          style={{
            position: 'absolute',
            zIndex: 9999,
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '150px',
            transform: 'translate(5px, 5px)',
            animation: 'scaleIn 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Action: Toggle Pin / Anchor */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('evt_toggle_static', { detail: contextMenu.chargeId }));
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              color: '#f1f5f9',
              fontSize: '12px',
              fontWeight: 500,
              textAlign: 'left',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            className="context-menu-btn"
          >
            {contextMenu.isStatic ? <PinOff size={14} color="#f59e0b" /> : <Pin size={14} color="#3b82f6" />}
            {contextMenu.isStatic ? 'Desfijar Carga' : 'Fijar Carga'}
          </button>

          {/* Action: Invert Polarity */}
          <button
            onClick={() => {
              const newVal = -contextMenu.chargeVal;
              dispatch(updateChargeValue({ id: contextMenu.chargeId, charge: newVal }));
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              color: '#f1f5f9',
              fontSize: '12px',
              fontWeight: 500,
              textAlign: 'left',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            className="context-menu-btn"
          >
            <RefreshCw size={14} color="#10b981" />
            Invertir Signo
          </button>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

          {/* Action: Delete Charge */}
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('evt_delete_charge', { detail: contextMenu.chargeId }));
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              color: '#f87171',
              fontSize: '12px',
              fontWeight: 600,
              textAlign: 'left',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            className="context-menu-btn-danger"
          >
            <Trash2 size={14} color="#ef4444" />
            Eliminar Carga
          </button>
        </div>
      )}
    </>
  );
}
