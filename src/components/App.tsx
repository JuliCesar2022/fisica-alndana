import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Triangle, CircleDashed, Battery, Atom, Orbit, Pin, PinOff, Trash2, RefreshCw, Zap } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { updateChargeValue, addCharge, toggleStatic, deleteCharge, resetCharges } from '../store/electroSlice';
import PhaserGame from './PhaserGame';
import Canvas3D from './Canvas3D';
import DashboardMenu from './DashboardMenu';
import MiroLeftPanel, { EVENT_ADD_CHARGE, EVENT_RESET_ELECTRO } from './panels/MiroLeftPanel';
import ElectroRightPanel from './panels/ElectroRightPanel';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [toastMsg, setToastMsg] = React.useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleNav = (path: string, key: string) => {
    if (['/collision', '/pendulum'].includes(path)) {
      setToastMsg('Esta simulación estará disponible próximamente.');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <header id="top-bar">
      <div className="top-bar-left">
        <div className="logo"><Atom size={24} color="#3b82f6" /></div>
        <h1>Laboratorio de Física - Miguel Aldana</h1>
        <button 
          className="mobile-menu-toggle" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu size={20} />
        </button>
      </div>

      <nav className={`top-bar-center ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <button className={`nav-btn ${location.pathname === '/ramp' ? 'active' : ''}`} onClick={() => handleNav('/ramp', 'ramp')}>
          <Triangle className="nav-icon" size={16} /> Rampa
        </button>
         <button className={`nav-btn ${location.pathname === '/freefall' ? 'active' : ''}`} onClick={() => handleNav('/freefall', 'freefall')}>
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

  const [loading, setLoading] = React.useState(() => {
    return !sessionStorage.getItem('has_loaded_before');
  });
  const [loadingFade, setLoadingFade] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [statusText, setStatusText] = React.useState('Inicializando simuladores...');

  React.useEffect(() => {
    if (!loading) return;
    const phrases = [
      { min: 0, text: 'Inicializando entorno físico...' },
      { min: 20, text: 'Cargando solucionadores de ecuaciones diferenciales...' },
      { min: 45, text: 'Sincronizando mallas de renderizado 3D...' },
      { min: 70, text: 'Equilibrando fuerzas gravitatorias...' },
      { min: 90, text: 'Optimizando telemetría en tiempo real...' },
      { min: 100, text: '¡Entorno Científico Listo!' }
    ];
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setLoadingFade(true);
            setTimeout(() => {
              setLoading(false);
              sessionStorage.setItem('has_loaded_before', 'true');
            }, 800);
          }, 500);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 8) + 2;
        const bounded = Math.min(next, 100);
        const matched = phrases.filter(p => bounded >= p.min).pop();
        if (matched) setStatusText(matched.text);
        return bounded;
      });
    }, 90);
    return () => clearInterval(interval);
  }, [loading]);

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

    const handleAddCharge = (e: any) => {
      const chargeVal = e.detail;
      // Position inside bounds (px-space: -200 to 200, which maps to -2.5 to 2.5 in 3D wx = x/80)
      const rx = (Math.random() - 0.5) * 160;
      const ry = (Math.random() - 0.5) * 160;
      dispatch(addCharge({ charge: chargeVal, x: rx, y: ry, isStatic: false }));
    };

    const handleResetElectro = () => {
      dispatch(resetCharges());
    };

    const handleToggleStatic = (e: any) => {
      dispatch(toggleStatic(e.detail));
    };

    const handleDeleteCharge = (e: any) => {
      dispatch(deleteCharge(e.detail));
    };

    window.addEventListener('evt_show_charge_context_menu', handleShowMenu);
    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('pointerdown', handleCloseMenu);
    window.addEventListener(EVENT_ADD_CHARGE, handleAddCharge);
    window.addEventListener(EVENT_RESET_ELECTRO, handleResetElectro);
    window.addEventListener('evt_toggle_static', handleToggleStatic);
    window.addEventListener('evt_delete_charge', handleDeleteCharge);

    return () => {
      window.removeEventListener('evt_show_charge_context_menu', handleShowMenu);
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('pointerdown', handleCloseMenu);
      window.removeEventListener(EVENT_ADD_CHARGE, handleAddCharge);
      window.removeEventListener(EVENT_RESET_ELECTRO, handleResetElectro);
      window.removeEventListener('evt_toggle_static', handleToggleStatic);
      window.removeEventListener('evt_delete_charge', handleDeleteCharge);
    };
  }, [dispatch]);

  return (
    <>
      {loading && (
        <div className={`loading-screen ${loadingFade ? 'fade-out' : ''}`}>
          <div className="loading-grid" />
          <div className="loading-glow-orb" />
          
          <div className="loading-logo-box" style={{ width: '200px', height: '200px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>
            
            {/* Real-time self-drawing SVG of the official brand logo */}
            <svg 
              viewBox="0 0 24 24" 
              width="100" 
              height="100" 
              fill="none" 
              stroke="#818cf8" 
              strokeWidth="1.0" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{
                filter: 'drop-shadow(0 0 24px rgba(99, 102, 241, 0.75))',
                animation: 'pulseAtom 2s ease-in-out infinite'
              }}
            >
              {/* Custom Particle Gradients */}
              <defs>
                <radialGradient id="particle-grad-single" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="35%" stopColor="#818cf8" />
                  <stop offset="70%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4338ca" />
                </radialGradient>
              </defs>

              {/* Single Nucleus Dot (Pulsing and glowing with living energy) - pops in at 15% progress */}
              <g 
                stroke="none"
                style={{
                  transform: `scale(${progress < 15 ? 0 : Math.min(1, (progress - 15) / 15)})`,
                  transformOrigin: 'center',
                  transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                {/* Central Nucleus Ball */}
                <circle 
                  cx="12" 
                  cy="12" 
                  r="1.8" 
                  fill="url(#particle-grad-single)"
                  className="loading-svg-nucleus-single"
                  style={{ transformOrigin: 'center' }}
                />
                
                {/* Tiny orbital quantum spark zipping around the single ball */}
                <g className="loading-nucleus-spark-orbit" style={{ transformOrigin: 'center' }}>
                  <circle 
                    cx="12" 
                    cy="9.2" 
                    r="0.5" 
                    fill="#10b981" 
                    style={{ filter: 'drop-shadow(0 0 3px #34d399)' }} 
                  />
                </g>
              </g>
              
              {/* First Logo Loop - draws itself at 30% to 60% progress */}
              <path 
                d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" 
                strokeDasharray="120"
                strokeDashoffset={progress < 30 ? 120 : Math.max(0, 120 - (progress - 30) * 4)}
                style={{
                  transition: 'stroke-dashoffset 0.15s ease-out'
                }}
              />
              
              {/* Second Logo Loop - draws itself at 60% to 90% progress */}
              <path 
                d="M3.8 20.2c-2.04-2.03-.02-7.36 4.5-11.9 4.54-4.52 9.87-6.54 11.9-4.5 2.04 2.03.02 7.36-4.5 11.9-4.54 4.52-9.87 6.54-11.9 4.5Z" 
                strokeDasharray="120"
                strokeDashoffset={progress < 60 ? 120 : Math.max(0, 120 - (progress - 60) * 4)}
                style={{
                  transition: 'stroke-dashoffset 0.15s ease-out'
                }}
              />
            </svg>
            
          </div>

          <div className="loading-bar-container" style={{ marginTop: '12px', zIndex: 20 }}>
            <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* PhaserGame only for circuits — the rest use the R3F Canvas3D */}
      <PhaserGame />
      <Canvas3D />

      <Routes>
        {/* Menu — full-screen, no header overlay */}
        <Route path="/" element={<DashboardMenu />} />

        {/* 3D + 2D panels overlay */}
        <Route path="/*" element={
          <div id="ui-overlay">
            <Header />
            <Routes>
              <Route path="/ramp" element={<MiroLeftPanel />} />
              <Route path="/freefall" element={<MiroLeftPanel />} />
              <Route path="/electrostatics" element={<><MiroLeftPanel /><ElectroRightPanel /></>} />
              <Route path="/circuit" element={<MiroLeftPanel />} />
            </Routes>
          </div>
        } />
      </Routes>

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
