import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Triangle, Zap, Swords, Activity, ArrowDown, Atom } from 'lucide-react';

interface MenuCard {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  path: string;
  available: boolean;
}

export default function DashboardMenu() {
  const navigate = useNavigate();

  const cards: MenuCard[] = [
    {
      key: 'ramp',
      icon: <Triangle size={32} className="text-indigo-400" />,
      title: 'Plano Inclinado',
      description: 'Rampa con fricción, fuerzas y energía',
      color: '#6366f1',
      path: '/ramp',
      available: true,
    },
    {
      key: 'electrostatics',
      icon: <Zap size={32} className="text-pink-400" />,
      title: 'Cargas Eléctricas',
      description: 'Ley de Coulomb, campo eléctrico y fuerzas',
      color: '#ec4899',
      path: '/electrostatics',
      available: true,
    },
    {
      key: 'circuit',
      icon: <Zap size={32} className="text-emerald-400" />,
      title: 'Circuitos Eléctricos',
      description: 'Ley de Ohm, rapidez de corriente y electrones',
      color: '#10b981',
      path: '/circuit',
      available: true,
    },
    {
      key: 'freefall',
      icon: <ArrowDown size={32} className="text-cyan-400" />,
      title: 'Caída Libre',
      description: 'Gravedad, velocidad terminal, resistencia',
      color: '#06b6d4',
      path: '/freefall',
      available: true,
    },
    {
      key: 'collision',
      icon: <Swords size={32} className="text-amber-400" />,
      title: 'Colisiones',
      description: 'Momentum, choques elásticos e inelásticos',
      color: '#f59e0b',
      path: '#',
      available: false,
    },
    {
      key: 'pendulum',
      icon: <Activity size={32} className="text-rose-400" />,
      title: 'Péndulo',
      description: 'Oscilación, período, energía',
      color: '#f43f5e',
      path: '#',
      available: false,
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
      justifyContent: 'center',
      background: '#0a0e17',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
      overflow: 'hidden',
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

      {/* Header Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1,
        marginBottom: '48px',
        textAlign: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Atom size={44} style={{ color: '#6366f1' }} className="animate-spin" />
          <h1 style={{
            fontSize: '42px',
            fontWeight: 800,
            letterSpacing: '-1px',
            margin: 0,
            background: 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Laboratorio de Física - Miguel Aldana
          </h1>
        </div>
        <p style={{ fontSize: '16px', color: '#64748b', margin: 0, fontWeight: 500 }}>
          Aprendizaje Basado en Proyectos • Entorno Científico 3D
        </p>
      </div>

      {/* Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 240px)',
        gap: '24px',
        zIndex: 1,
        maxWidth: '800px'
      }}>
        {cards.map((card) => {
          const hexOpacity = card.available ? '1f' : '0d';
          const cardStyle: React.CSSProperties = {
            background: `${card.color}${hexOpacity}`,
            border: `1px solid ${card.available ? card.color + '4d' : 'rgba(255, 255, 255, 0.05)'}`,
            borderRadius: '16px',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: card.available ? 'pointer' : 'default',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(12px)',
            position: 'relative',
            opacity: card.available ? 1 : 0.4
          };

          return (
            <div
              key={card.key}
              style={cardStyle}
              onClick={() => card.available && navigate(card.path)}
              className={card.available ? 'group hover:-translate-y-1 hover:shadow-2xl' : ''}
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
              {/* Icon container */}
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)'
              }}>
                {card.icon}
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
