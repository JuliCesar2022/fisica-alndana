import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Triangle, Zap, Swords, Activity, ArrowDown, Atom } from 'lucide-react';

interface MenuCard {
  key: string;
  preview: React.ReactNode;
  title: string;
  description: string;
  color: string;
  path: string;
  available: boolean;
}

// 1. Inclined Plane Preview (Plano Inclinado)
const RampPreview = () => (
  <svg viewBox="0 0 160 90" width="100%" height="90">
    <defs>
      <pattern id="menu-grid" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#menu-grid)" />
    
    {/* Inclined Slope */}
    <path d="M 20 75 L 140 75 L 140 30 Z" fill="none" stroke="rgba(99, 102, 241, 0.3)" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M 20 75 L 140 30" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
    
    {/* Sliding block */}
    <g style={{
      animation: 'slideRamp 3s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      transformOrigin: 'center'
    }}>
      <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#6366f1" stroke="#ffffff" strokeWidth="1" />
      <line x1="0" y1="0" x2="-14" y2="5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="-14,5 -10,1 -8,6" fill="#10b981" />
    </g>
  </svg>
);

// 2. Electric Charges Preview (Cargas Eléctricas)
const ElectrostaticsPreview = () => (
  <svg viewBox="0 0 160 90" width="100%" height="90">
    <rect width="100%" height="100%" fill="url(#menu-grid)" />
    <defs>
      <radialGradient id="menu-pos" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="40%" stopColor="#ec4899" />
        <stop offset="100%" stopColor="#be185d" />
      </radialGradient>
      <radialGradient id="menu-neg" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="40%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </radialGradient>
    </defs>
    
    {/* Field Lines */}
    <path d="M 40 45 C 60 15, 100 15, 120 45" fill="none" stroke="#ec4899" strokeWidth="1.0" strokeDasharray="4 4" className="menu-field-line" style={{ strokeDashoffset: 0 }} />
    <path d="M 40 45 C 60 75, 100 75, 120 45" fill="none" stroke="#ec4899" strokeWidth="1.0" strokeDasharray="4 4" className="menu-field-line" />
    <line x1="40" y1="45" x2="120" y2="45" stroke="#ec4899" strokeWidth="1.2" strokeDasharray="6 3" className="menu-field-line" />
    
    {/* Charges */}
    <circle cx="40" cy="45" r="9" fill="url(#menu-pos)" />
    <text x="40" y="49" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle" style={{ userSelect: 'none' }}>+</text>
    
    <circle cx="120" cy="45" r="9" fill="url(#menu-neg)" />
    <text x="120" y="48" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle" style={{ userSelect: 'none' }}>-</text>
  </svg>
);

// 3. Electrical Circuits Preview (Circuitos Eléctricos)
const CircuitPreview = () => (
  <svg viewBox="0 0 160 90" width="100%" height="90">
    <rect width="100%" height="100%" fill="url(#menu-grid)" />
    
    {/* Wire loop */}
    <rect x="25" y="20" width="110" height="50" rx="8" fill="none" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1.5" />
    
    {/* Battery */}
    <g transform="translate(25, 45)">
      <rect x="-6" y="-12" width="12" height="24" rx="2" fill="#047857" stroke="#34d399" strokeWidth="1" />
      <rect x="-3" y="-15" width="6" height="3" fill="#34d399" />
    </g>
    
    {/* Bulb */}
    <g transform="translate(135, 45)">
      <circle cx="0" cy="0" r="12" fill="rgba(245, 158, 11, 0.15)" className="menu-bulb-glow" />
      <circle cx="0" cy="-3" r="7" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      <rect x="-4" y="4" width="8" height="5" fill="#4b5563" />
    </g>

    {/* Electrons */}
    <path 
      d="M 25 45 L 25 28 A 8 8 0 0 1 33 20 L 127 20 A 8 8 0 0 1 135 28 L 135 45 L 135 62 A 8 8 0 0 1 127 70 L 33 70 A 8 8 0 0 1 25 62 Z" 
      fill="none" 
      stroke="#f59e0b" 
      strokeWidth="2.5" 
      strokeDasharray="4 24" 
      className="menu-electrons" 
    />
  </svg>
);

// 4. Free Fall Preview (Caída Libre)
const FreeFallPreview = () => (
  <svg viewBox="0 0 160 90" width="100%" height="90">
    <rect width="100%" height="100%" fill="url(#menu-grid)" />
    <defs>
      <radialGradient id="menu-sphere-fall" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="40%" stopColor="#06b6d4" />
        <stop offset="100%" stopColor="#0891b2" />
      </radialGradient>
    </defs>
    
    {/* Tube */}
    <line x1="80" y1="10" x2="80" y2="80" stroke="rgba(6, 182, 212, 0.1)" strokeWidth="16" strokeLinecap="round" />
    
    {/* Wind Streams */}
    <line x1="74" y1="20" x2="74" y2="35" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" className="menu-wind menu-wind-1" />
    <line x1="86" y1="35" x2="86" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" className="menu-wind menu-wind-2" />
    <line x1="77" y1="50" x2="77" y2="65" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" className="menu-wind menu-wind-3" />

    {/* Falling ball */}
    <g style={{ animation: 'menuFallSphere 2.5s cubic-bezier(0.55, 0.055, 0.675, 0.19) infinite' }}>
      <circle cx="80" cy="20" r="6" fill="url(#menu-sphere-fall)" />
      <line x1="80" y1="20" x2="80" y2="32" stroke="#ef4444" strokeWidth="1.2" />
      <polygon points="80,32 77,28 83,28" fill="#ef4444" />
    </g>
  </svg>
);

// 5. Collisions Preview (Colisiones - Locked)
const CollisionPreview = () => (
  <svg viewBox="0 0 160 90" width="100%" height="90">
    <rect width="100%" height="100%" fill="url(#menu-grid)" />
    
    {/* Track */}
    <line x1="20" y1="45" x2="140" y2="45" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2 4" />
    
    {/* Colliding spheres */}
    <circle cx="30" cy="45" r="5" fill="#f59e0b" style={{ animation: 'menuCollideLeft 3s ease-in-out infinite' }} />
    <circle cx="130" cy="45" r="5" fill="#ef4444" style={{ animation: 'menuCollideRight 3s ease-in-out infinite' }} />
    
    {/* Impact burst */}
    <circle cx="80" cy="45" r="8" fill="none" stroke="#f59e0b" strokeWidth="1.5" className="menu-collision-spark" />
  </svg>
);

// 6. Pendulum Preview (Péndulo - Locked)
const PendulumPreview = () => (
  <svg viewBox="0 0 160 90" width="100%" height="90">
    <rect width="100%" height="100%" fill="url(#menu-grid)" />
    <defs>
      <radialGradient id="menu-sphere-pend" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="40%" stopColor="#f43f5e" />
        <stop offset="100%" stopColor="#e11d48" />
      </radialGradient>
    </defs>
    
    <line x1="65" y1="12" x2="95" y2="12" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
    
    {/* Swinging Pendulum */}
    <g style={{ animation: 'menuSwingPendulum 2.5s ease-in-out infinite', transformOrigin: '80px 12px' }}>
      <line x1="80" y1="12" x2="80" y2="65" stroke="#f43f5e" strokeWidth="1" />
      <circle cx="80" cy="65" r="6.5" fill="url(#menu-sphere-pend)" />
    </g>
  </svg>
);

export default function DashboardMenu() {
  const navigate = useNavigate();

  const cards: MenuCard[] = [
    {
      key: 'ramp',
      preview: <RampPreview />,
      title: 'Plano Inclinado',
      description: 'Rampa con fricción, fuerzas y energía',
      color: '#6366f1',
      path: '/ramp',
      available: true,
    },
    {
      key: 'electrostatics',
      preview: <ElectrostaticsPreview />,
      title: 'Cargas Eléctricas',
      description: 'Ley de Coulomb, campo eléctrico y fuerzas',
      color: '#ec4899',
      path: '/electrostatics',
      available: true,
    },
    {
      key: 'circuit',
      preview: <CircuitPreview />,
      title: 'Circuitos Eléctricos',
      description: 'Ley de Ohm, rapidez de corriente y electrones',
      color: '#10b981',
      path: '/circuit',
      available: true,
    },
    {
      key: 'freefall',
      preview: <FreeFallPreview />,
      title: 'Caída Libre',
      description: 'Gravedad, velocidad terminal, resistencia',
      color: '#06b6d4',
      path: '/freefall',
      available: true,
    },
    {
      key: 'collision',
      preview: <CollisionPreview />,
      title: 'Colisiones',
      description: 'Momentum, choques elásticos e inelásticos',
      color: '#f59e0b',
      path: '/collision',
      available: true,
    },
    {
      key: 'pendulum',
      preview: <PendulumPreview />,
      title: 'Péndulo',
      description: 'Oscilación, período, energía y amortiguamiento',
      color: '#f43f5e',
      path: '/pendulum',
      available: true,
    },
  ];

  // Sync menu highlights in navigation buttons
  useEffect(() => {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById('btn-menu')?.classList.add('active');
    
    // Hide controls & telemetry panels when on menu
    document.getElementById('control-panel')?.classList.add('hidden');
    document.getElementById('formula-panel')?.classList.add('hidden');
    document.getElementById('data-panel')?.classList.add('hidden');
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      background: '#0a0e17',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '100px 0',
      color: '#f1f5f9'
    }}>
      {/* Visual background grid pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(30, 41, 59, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 41, 59, 0.2) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <style>{`
        /* 1. Ramp Slide Keyframes */
        @keyframes slideRamp {
          0% { transform: translate(30px, 71px) rotate(-20.5deg); }
          40% { transform: translate(122px, 37px) rotate(-20.5deg); }
          55% { transform: translate(122px, 37px) rotate(-20.5deg); }
          95% { transform: translate(30px, 71px) rotate(-20.5deg); }
          100% { transform: translate(30px, 71px) rotate(-20.5deg); }
        }

        /* 2. Electric Field Dash Keyframes */
        @keyframes dashFieldLine {
          to { stroke-dashoffset: -20; }
        }
        .menu-field-line {
          animation: dashFieldLine 2s linear infinite;
        }

        /* 3. Circuit Electrons Flow Keyframes */
        @keyframes flowMenuElectrons {
          to { stroke-dashoffset: -28; }
        }
        .menu-electrons {
          animation: flowMenuElectrons 1.8s linear infinite;
        }
        @keyframes pulseMenuBulb {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.85; }
        }
        .menu-bulb-glow {
          animation: pulseMenuBulb 1.5s ease-in-out infinite;
        }

        /* 4. Free Fall Keyframes */
        @keyframes menuFallSphere {
          0% { transform: translateY(0px); opacity: 0; }
          12% { transform: translateY(0px); opacity: 1; }
          82% { transform: translateY(53px); opacity: 1; }
          92% { transform: translateY(53px); opacity: 0; }
          100% { transform: translateY(0px); opacity: 0; }
        }
        @keyframes menuFlowWind {
          0% { transform: translateY(30px); opacity: 0; }
          50% { opacity: 0.7; }
          100% { transform: translateY(-30px); opacity: 0; }
        }
        .menu-wind {
          animation: menuFlowWind 1.2s linear infinite;
        }
        .menu-wind-1 { animation-delay: 0s; }
        .menu-wind-2 { animation-delay: 0.4s; }
        .menu-wind-3 { animation-delay: 0.8s; }

        /* 5. Collisions Keyframes */
        @keyframes menuCollideLeft {
          0% { transform: translateX(0); }
          35% { transform: translateX(45px); }
          60% { transform: translateX(45px); }
          95% { transform: translateX(0); }
          100% { transform: translateX(0); }
        }
        @keyframes menuCollideRight {
          0% { transform: translateX(0); }
          35% { transform: translateX(-45px); }
          60% { transform: translateX(-45px); }
          95% { transform: translateX(0); }
          100% { transform: translateX(0); }
        }
        @keyframes menuSparkBurst {
          0%, 34% { transform: scale(0); opacity: 0; }
          35% { transform: scale(1); opacity: 1; }
          48% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(0); opacity: 0; }
        }
        .menu-collision-spark {
          transform-origin: 80px 45px;
          animation: menuSparkBurst 3s ease-out infinite;
        }

        /* 6. Pendulum Swing Keyframes */
        @keyframes menuSwingPendulum {
          0%, 100% { transform: rotate(-30deg); }
          50% { transform: rotate(30deg); }
        }
      `}</style>

      {/* Header Container */}
      <div className="dashboard-header-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Atom size={44} style={{ color: '#6366f1' }} className="animate-spin dashboard-icon" />
          <h1 className="dashboard-title">
            Laboratorio de Física - Miguel Aldana
          </h1>
        </div>
        <p className="dashboard-subtitle">
          Aprendizaje Basado en Proyectos • Entorno Científico 3D
        </p>
      </div>

      {/* Cards Grid */}
      <div className="dashboard-grid">
        {cards.map((card) => {
          const hexOpacity = card.available ? '1f' : '0d';
          const cardStyle: React.CSSProperties = {
            background: `${card.color}${hexOpacity}`,
            borderColor: card.available ? card.color + '4d' : 'rgba(255, 255, 255, 0.05)',
            cursor: card.available ? 'pointer' : 'default',
            opacity: card.available ? 1 : 0.4
          };

          return (
            <div
              key={card.key}
              style={cardStyle}
              onClick={() => card.available && navigate(card.path)}
              className={`dashboard-card ${card.available ? 'group hover:-translate-y-1 hover:shadow-2xl' : ''}`}
              onMouseEnter={(e) => {
                if (card.available) {
                  e.currentTarget.style.borderColor = card.color;
                  e.currentTarget.style.boxShadow = `0 10px 30px -10px ${card.color}4d`;
                }
              }}
              onMouseLeave={(e) => {
                if (card.available) {
                  e.currentTarget.style.borderColor = card.color + '4d';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {/* Animated Preview box */}
              <div style={{
                width: '100%',
                height: '110px',
                borderRadius: '12px',
                background: 'rgba(10, 15, 30, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.5)'
              }}>
                {card.preview}
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: card.available ? '#f8fafc' : '#475569',
                margin: '0 0 8px 0',
                letterSpacing: '-0.2px'
              }}>
                {card.title}
              </h3>

              {/* Description */}
              <p style={{
                fontSize: '12px',
                color: '#64748b',
                lineHeight: '1.5',
                margin: 0
              }}>
                {card.description}
              </p>

              {/* Locked Badge */}
              {!card.available && (
                <div style={{
                  marginTop: '12px',
                  fontSize: '10px',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600
                }}>
                  Próximamente
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '48px',
        fontSize: '13px',
        color: '#475569',
        zIndex: 1,
        letterSpacing: '0.5px'
      }}>
        SELECCIONA UN EXPERIMENTO PARA COMENZAR
      </div>
    </div>
  );
}
