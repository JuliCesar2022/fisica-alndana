import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { Sigma, HelpCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import katex from 'katex';
import { MATERIALS } from '../../utils/constants';

interface FormulaPanelProps {
  type: 'ramp' | 'electro' | 'circuit' | 'freefall';
}

export default function FormulaPanel({ type }: FormulaPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const ramp = useSelector((s: RootState) => s.ramp);
  const electro = useSelector((state: RootState) => state.electrostatics);
  const circuit = useSelector((state: RootState) => state.circuit);
  const freefall = useSelector((state: RootState) => state.freefall);

  // Helper to render KaTeX to React HTML dynamically
  const math = (expr: string, block = false) => {
    try {
      const html = katex.renderToString(expr, {
        displayMode: block,
        throwOnError: false
      });
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e) {
      return <span>{expr}</span>;
    }
  };

  const getEffR = (slot: 'resistor' | 'wire' | 'empty', val: number) => {
    if (slot === 'wire') return 0.0001; // short circuit
    if (slot === 'empty') return 1e9; // open circuit
    return val;
  };

  const getSlotLabel = (slot: 'resistor' | 'wire' | 'empty', name: string, rVal: number) => {
    if (slot === 'wire') return `${name} (Cable: 0 \\Omega)`;
    if (slot === 'empty') return `${name} (Vacio: \\infty)`;
    return `${name} (${rVal} \\Omega)`;
  };

  const renderRamp = () => {
    const { angle, mass, material, forces } = ramp;
    const mu = material === 'custom' ? ramp.customFriction : (MATERIALS[material]?.frictionKinetic ?? 0.35);

    return (
      <>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#ef4444' }}>Peso (F_g)</span>
          <span className="formula-value">{forces.weight.toFixed(2)} N</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#3b82f6' }}>F. Normal (N)</span>
          <span className="formula-value">{forces.normalForce.toFixed(2)} N</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#f59e0b' }}>F. Paralela</span>
          <span className="formula-value">{forces.parallelForce.toFixed(2)} N</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#10b981' }}>Fricción (F_f)</span>
          <span className="formula-value">{forces.frictionForce.toFixed(2)} N</span>
        </div>
        <div className="formula-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="formula-name" style={{ color: '#f8fafc', fontWeight: 'bold' }}>Fuerza Neta</span>
          <span className="formula-value" style={{ fontWeight: 'bold' }}>{forces.netForce.toFixed(2)} N</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#a5b4fc' }}>Aceleración</span>
          <span className="formula-value">{forces.acceleration.toFixed(2)} m/s²</span>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
          <div style={{ fontSize: '11px', color: '#f59e0b' }}>{math(`F_g = m \\cdot g = ${mass} \\cdot 9.81 = ${forces.weight.toFixed(2)}\\text{ N}`, true)}</div>
          <div style={{ fontSize: '11px', color: '#3b82f6' }}>{math(`N = F_g \\cdot \\cos(${angle}^\\circ) = ${forces.normalForce.toFixed(2)}\\text{ N}`, true)}</div>
          <div style={{ fontSize: '11px', color: '#10b981' }}>{math(`F_f = \\mu \\cdot N = ${mu} \\cdot ${forces.normalForce.toFixed(2)} = ${forces.frictionForce.toFixed(2)}\\text{ N}`, true)}</div>
          <div style={{ fontSize: '11px', color: '#a5b4fc' }}>{math(`a = \\frac{F_{neta}}{m} = ${forces.acceleration.toFixed(2)}\\text{ m/s}^2`, true)}</div>
        </div>
      </>
    );
  };

  const renderElectro = () => {
    const target = electro.charges.find(c => c.id === electro.selectedChargeId);
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
      <>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#f1f5f9' }}>Carga Seleccionada</span>
          <span className="formula-value">{target ? `${target.charge > 0 ? '+' : ''}${target.charge} µC` : 'Ninguna'}</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#ec4899' }}>Fuerza Neta (F)</span>
          <span className="formula-value">{fStr}</span>
        </div>
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: '#a5b4fc', textAlign: 'center' }}>
          {math(mathStr, true)}
        </div>
      </>
    );
  };

  const renderCircuit = () => {
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
      <>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#ef4444' }}>Voltaje de Entrada (V<sub>g</sub>)</span>
          <span className="formula-value">{voltage.toFixed(1)} V</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#3b82f6' }}>Resistencia Eq. (R<sub>eq</sub>)</span>
          <span className="formula-value">{req >= 1e6 ? '∞ Ω' : `${req.toFixed(1)} Ω`}</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#10b981' }}>Intensidad Total (I<sub>t</sub>)</span>
          <span className="formula-value">{current.toFixed(4)} A</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#ec4899' }}>Potencia Total (P<sub>t</sub>)</span>
          <span className="formula-value">{power.toFixed(2)} W</span>
        </div>

        {isOpen ? (
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
            {math('\\text{Circuito Abierto (Sin Corriente)}') }
          </div>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '6px 8px',
              fontSize: '11px',
              fontWeight: 'bold',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(99,102,241,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'transform 0.1s'
            }}
          >
            <HelpCircle size={12} /> Ver Procedimiento Completo
          </button>
        )}

        {/* Dynamic Reduction Modal */}
        {showModal && createPortal(
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(5, 7, 12, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '85vh',
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              color: '#f1f5f9',
              overflowY: 'auto'
            }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                  <Sigma size={15} /> Reducción y Procedimiento Matemático
                </h3>
                <button 
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '20px',
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ fontSize: '11.5px', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {topology === 'series' && (
                  <>
                    <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 1: Sumar Resistencias en Serie</b>. Como todos los elementos están en serie, la corriente recorre un lazo único y se suman directamente:</p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      {math(`R_{eq} = R_1 + R_2 + R_3 = ${r1} + ${r2} + ${r3} = ${r1+r2+r3}\\text{ }\\Omega`, true)}
                    </div>

                    <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 2: Calcular Corriente Total (Ley de Ohm)</b>:</p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      {math(`I = \\frac{V_g}{R_{eq}} = \\frac{${voltage}\\text{ V}}{${r1+r2+r3}\\text{ }\\Omega} = ${current.toFixed(4)}\\text{ A}`, true)}
                    </div>

                    <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 3: Tensiones Individuales</b>:</p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      {math(`V_1 = I \\cdot R_1 = ${(current*r1).toFixed(2)}\\text{ V}`, true)}
                      {math(`V_2 = I \\cdot R_2 = ${(current*r2).toFixed(2)}\\text{ V}`, true)}
                      {math(`V_3 = I \\cdot R_3 = ${(current*r3).toFixed(2)}\\text{ V}`, true)}
                    </div>
                  </>
                )}

                {topology === 'parallel' && (
                  <>
                    <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 1: Resistencia Equivalente Paralela</b>. Para 3 elementos paralelos:</p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      {math(`R_{eq} = \\left( \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3} \\right)^{-1}`, true)}
                      {math(`R_{eq} = \\left( \\frac{1}{${r1}} + \\frac{1}{${r2}} + \\frac{1}{${r3}} \\right)^{-1} = ${req.toFixed(1)}\\text{ }\\Omega`, true)}
                    </div>

                    <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 2: Corrientes de Rama (Tensión idéntica de {voltage}V)</b>:</p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      {math(`I_1 = \\frac{V_g}{R_1} = ${(voltage/r1).toFixed(4)}\\text{ A}`, true)}
                      {math(`I_2 = \\frac{V_g}{R_2} = ${(voltage/r2).toFixed(4)}\\text{ A}`, true)}
                      {math(`I_3 = \\frac{V_g}{R_3} = ${(voltage/r3).toFixed(4)}\\text{ A}`, true)}
                    </div>

                    <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 3: Corriente Total (Ley de Kirchhoff para Corrientes)</b>:</p>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                      {math(`I_t = I_1 + I_2 + I_3 = ${current.toFixed(4)}\\text{ A}`, true)}
                    </div>
                  </>
                )}

                {(topology === 'mixed' || topology === 'custom') && (() => {
                  const R1_eff = getEffR(slot1, r1);
                  const R2_eff = getEffR(slot2, r2);
                  const R3_eff = getEffR(slot3, r3);
                  const R4_eff = getEffR(slot4, r4);

                  const G2 = 1 / R2_eff;
                  const G3 = 1 / R3_eff;
                  const G4 = 1 / R4_eff;
                  const Gp = G2 + G3 + G4;
                  const Rp = Gp === 0 ? 1e9 : 1 / Gp;

                  return (
                    <>
                      <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 1: Evaluar Configuración de Componentes</b>:</p>
                      <ul style={{ margin: 0, paddingLeft: '16px' }}>
                        <li>{math(getSlotLabel(slot1, 'R_1', r1))}</li>
                        <li>{math(getSlotLabel(slot2, 'R_2', r2))}</li>
                        <li>{math(getSlotLabel(slot3, 'R_3', r3))}</li>
                        {slot4 !== 'empty' && <li>{math(getSlotLabel(slot4, 'R_4', r4))}</li>}
                      </ul>

                      <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 2: Reducir Bloque en Paralelo (R₂ || R₃ {slot4 !== 'empty' ? '|| R₄' : ''})</b>:</p>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                        {slot4 !== 'empty' ? (
                          <>
                            {math(`G_p = \\frac{1}{R_2} + \\frac{1}{R_3} + \\frac{1}{R_4}`, true)}
                            {math(`R_p = \\left( G_p \\right)^{-1} = ${Rp > 1e6 ? '\\infty' : Rp.toFixed(1)}\\text{ }\\Omega`, true)}
                          </>
                        ) : (
                          <>
                            {math(`R_p = \\frac{R_2 \\cdot R_3}{R_2 + R_3}`, true)}
                            {math(`R_p = ${Rp > 1e6 ? '\\infty' : Rp.toFixed(1)}\\text{ }\\Omega`, true)}
                          </>
                        )}
                      </div>

                      <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 3: Resistencia Equivalente Total (R₁ en serie con R_p)</b>:</p>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                        {math(`R_{eq} = R_1 + R_p = ${req >= 1e6 ? '\\infty' : req.toFixed(1)}\\text{ }\\Omega`, true)}
                      </div>

                      <p style={{ margin: 0 }}><CheckCircle2 size={12} color="#10b981" style={{ display: 'inline', marginRight: '4px' }} /> <b>Paso 4: Corrientes y Caídas de Tensión</b>:</p>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', textAlign: 'left', paddingLeft: '14px' }}>
                        <div>• Corriente total: {math(`I_t = \\frac{V_g}{R_{eq}} = ${current.toFixed(4)}\\text{ A}`)}</div>
                        <div>• Caída en $R_1$: {math(`V_1 = I_t \\cdot R_1 = ${(current * R1_eff).toFixed(2)}\\text{ V}`)}</div>
                        <div>• Tensión en bloque paralelo: {math(`V_p = V_g - V_1 = ${Math.max(0, voltage - current * R1_eff).toFixed(2)}\\text{ V}`)}</div>
                        <div>• Corriente en $R_2$: {math(`I_2 = \\frac{V_p}{R_2} = ${slot2 === 'empty' ? '0' : (Math.max(0, voltage - current * R1_eff)/R2_eff).toFixed(4)}\\text{ A}`)}</div>
                        <div>• Corriente en $R_3$: {math(`I_3 = \\frac{V_p}{R_3} = ${slot3 === 'empty' ? '0' : (Math.max(0, voltage - current * R1_eff)/R3_eff).toFixed(4)}\\text{ A}`)}</div>
                        {slot4 !== 'empty' && <div>• Corriente en $R_4$: {math(`I_4 = \\frac{V_p}{R_4} = ${(Math.max(0, voltage - current * R1_eff)/R4_eff).toFixed(4)}\\text{ A}`)}</div>}
                      </div>
                    </>
                  );
                })()}

              </div>

              {/* Modal Footer */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '16px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    padding: '6px 16px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  };

  const renderFreeFall = () => {
    const { height, gravity, mass } = freefall;
    const t_total = Math.sqrt((2 * height) / gravity);
    const v_final = gravity * t_total;

    return (
      <>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#3b82f6' }}>Tiempo de Caída (t)</span>
          <span className="formula-value">{t_total.toFixed(2)} s</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#10b981' }}>Vel. Final (v_f)</span>
          <span className="formula-value">{v_final.toFixed(2)} m/s</span>
        </div>
        <div className="formula-row">
          <span className="formula-name" style={{ color: '#eab308' }}>Energía Potencial (E_p)</span>
          <span className="formula-value">{(mass * gravity * height).toFixed(1)} J</span>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
          <div style={{ fontSize: '11px', color: '#3b82f6' }}>{math(`t = \\sqrt{\\frac{2h}{g}} = \\sqrt{\\frac{2 \\cdot ${height}}{${gravity}}} = ${t_total.toFixed(2)}\\text{ s}`, true)}</div>
          <div style={{ fontSize: '11px', color: '#10b981' }}>{math(`v_f = g \\cdot t = ${gravity} \\cdot ${t_total.toFixed(2)} = ${v_final.toFixed(2)}\\text{ m/s}`, true)}</div>
          <div style={{ fontSize: '11px', color: '#eab308' }}>{math(`E_p = m \\cdot g \\cdot h = ${mass} \\cdot ${gravity} \\cdot ${height} = ${(mass * gravity * height).toFixed(1)}\\text{ J}`, true)}</div>
        </div>
      </>
    );
  };

  return (
    <aside 
      id="formula-panel" 
      className={`panel glass-panel ${collapsed ? 'collapsed' : ''}`}
      style={{
        position: 'absolute',
        left: '20px',
        bottom: '20px',
        width: '380px',
        maxWidth: '380px',
        zIndex: 10
      }}
    >
      <div className="panel-header">
        <h2><Sigma size={16} /> Fórmulas</h2>
        <button className="panel-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '+' : '−'}
        </button>
      </div>
      {!collapsed && (
        <div className="panel-content">
          {type === 'ramp' ? renderRamp() : type === 'electro' ? renderElectro() : type === 'circuit' ? renderCircuit() : renderFreeFall()}
        </div>
      )}
    </aside>
  );
}
