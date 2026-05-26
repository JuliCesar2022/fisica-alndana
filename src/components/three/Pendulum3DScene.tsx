import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import InfiniteGround from './InfiniteGround';
import { Stars, Text, Line, OrbitControls, Billboard } from '@react-three/drei';
import { useSelector, useDispatch } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../../store/store';
import {
  updatePendulumState, setPlaying,
  PendulumScene, PendulumPhysicsState,
} from '../../store/pendulumSlice';
import { EVENT_RESET_PENDULUM } from '../panels/MiroLeftPanel';

// ─── Scene Configurations ──────────────────────────────────────────
interface PendSceneCfg {
  bg: string; fogColor: string; fogNear: number; fogFar: number;
  ambientIntensity: number; ambientColor: string;
  dirIntensity: number; dirColor: string;
  groundBase: string; groundCell: string; groundSection: string;
  starsCount: number;
  bobColor: string; stringColor: string; pivotColor: string;
}

const PENDULUM_SCENES: Record<PendulumScene, PendSceneCfg> = {
  lab: {
    bg: '#0a0e17', fogColor: '#0a0e17', fogNear: 20, fogFar: 55,
    ambientIntensity: 0.4, ambientColor: '#ffffff',
    dirIntensity: 1.2, dirColor: '#fffbe6',
    groundBase: '#0a0e17', groundCell: '#1e293b', groundSection: '#2d3f52',
    starsCount: 1500, bobColor: '#6366f1', stringColor: '#94a3b8', pivotColor: '#475569',
  },
  moon: {
    bg: '#04050a', fogColor: '#07090f', fogNear: 22, fogFar: 60,
    ambientIntensity: 0.18, ambientColor: '#b0c4de',
    dirIntensity: 0.85, dirColor: '#dde8ff',
    groundBase: '#111318', groundCell: '#1c1f28', groundSection: '#252932',
    starsCount: 4000, bobColor: '#94a3b8', stringColor: '#64748b', pivotColor: '#374151',
  },
  water: {
    bg: '#061a2e', fogColor: '#082040', fogNear: 12, fogFar: 35,
    ambientIntensity: 0.6, ambientColor: '#38bdf8',
    dirIntensity: 0.8, dirColor: '#7dd3fc',
    groundBase: '#061a2e', groundCell: '#0c2d4a', groundSection: '#103860',
    starsCount: 0, bobColor: '#06b6d4', stringColor: '#0ea5e9', pivotColor: '#0369a1',
  },
};

// ─── RK4 Integration ───────────────────────────────────────────────
function rk4Step(
  theta: number, omega: number, dt: number,
  g: number, L: number, b: number
): [number, number] {
  const deriv = (th: number, om: number): [number, number] => [
    om,
    -(g / L) * Math.sin(th) - b * om,
  ];
  const [k1t, k1o] = deriv(theta, omega);
  const [k2t, k2o] = deriv(theta + 0.5 * dt * k1t, omega + 0.5 * dt * k1o);
  const [k3t, k3o] = deriv(theta + 0.5 * dt * k2t, omega + 0.5 * dt * k2o);
  const [k4t, k4o] = deriv(theta + dt * k3t, omega + dt * k3o);
  return [
    theta + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
    omega + (dt / 6) * (k1o + 2 * k2o + 2 * k3o + k4o),
  ];
}

// ─── Pivot Bracket ─────────────────────────────────────────────────
function PivotBracket({ y, color }: { y: number; color: string }) {
  return (
    <group position={[0, y, 0]}>
      {/* Ceiling mount plate */}
      <mesh castShadow>
        <boxGeometry args={[2.4, 0.1, 0.18]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Pivot axle */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.22, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Support legs */}
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, -0.32, 0]} castShadow>
          <boxGeometry args={[0.09, 0.55, 0.09]} />
          <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Angle Arc indicator ────────────────────────────────────────────
function AngleArc({ pivotY, radius, angle }: { pivotY: number; radius: number; angle: number }) {
  if (Math.abs(angle) < 0.03) return null;
  const steps = 28;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = angle * (i / steps);
    pts.push([radius * Math.sin(t), pivotY - radius * Math.cos(t), 0.04]);
  }
  return <Line points={pts} color="#f59e0b" lineWidth={1.5} />;
}

// ─── Main Scene ────────────────────────────────────────────────────
export default function Pendulum3DScene() {
  const dispatch = useDispatch();
  const pend = useSelector((s: RootState) => s.pendulum);
  const sc = PENDULUM_SCENES[pend.scene ?? 'lab'];

  const L = pend.length;
  const PIVOT_Y = L + 0.8;
  const BOB_R = Math.max(0.08, Math.min(0.24, 0.1 + pend.mass * 0.03));

  // Physics mutable state — no re-renders
  const physRef = useRef({
    theta: (pend.initialAngle * Math.PI) / 180,
    omega: 0.0,
    time: 0.0,
    oscillations: 0,
    lastZeroTime: -1.0,
    measuredPeriod: 0.0,
    prevSign: pend.initialAngle >= 0 ? 1 : -1,
    phase: 'idle' as 'idle' | 'running',
  });

  const trailRef = useRef<THREE.Vector3[]>([]);
  const bobRef = useRef<THREE.Mesh>(null);
  const frameCount = useRef(0);

  // React display state (for labels only)
  const [disp, setDisp] = useState({
    bobX: L * Math.sin((pend.initialAngle * Math.PI) / 180),
    bobY: PIVOT_Y - L * Math.cos((pend.initialAngle * Math.PI) / 180),
    theta: (pend.initialAngle * Math.PI) / 180,
    velocity: 0,
    period: 0,
    oscillations: 0,
  });

  // Start / stop
  useEffect(() => {
    const p = physRef.current;
    if (pend.isPlaying) {
      p.phase = 'running';
    } else {
      if (p.phase === 'running') p.phase = 'idle';
    }
  }, [pend.isPlaying]);

  // Reset event
  useEffect(() => {
    const onReset = () => {
      const p = physRef.current;
      const theta0 = (pend.initialAngle * Math.PI) / 180;
      p.theta = theta0;
      p.omega = 0;
      p.time = 0;
      p.oscillations = 0;
      p.lastZeroTime = -1;
      p.measuredPeriod = 0;
      p.prevSign = pend.initialAngle >= 0 ? 1 : -1;
      p.phase = 'idle';
      trailRef.current = [];
      const bX = pend.length * Math.sin(theta0);
      const bY = PIVOT_Y - pend.length * Math.cos(theta0);
      if (bobRef.current) { bobRef.current.position.x = bX; bobRef.current.position.y = bY; }
      setDisp({ bobX: bX, bobY: bY, theta: theta0, velocity: 0, period: 0, oscillations: 0 });
    };
    window.addEventListener(EVENT_RESET_PENDULUM, onReset);
    return () => window.removeEventListener(EVENT_RESET_PENDULUM, onReset);
  }, [pend.initialAngle, pend.length, PIVOT_Y]);

  // Sync display when params change while idle
  useEffect(() => {
    if (!pend.isPlaying && physRef.current.phase !== 'running') {
      const theta0 = (pend.initialAngle * Math.PI) / 180;
      physRef.current.theta = theta0;
      physRef.current.omega = 0;
      const bX = L * Math.sin(theta0);
      const bY = PIVOT_Y - L * Math.cos(theta0);
      if (bobRef.current) { bobRef.current.position.x = bX; bobRef.current.position.y = bY; }
      setDisp(d => ({ ...d, bobX: bX, bobY: bY, theta: theta0, velocity: 0 }));
    }
  }, [pend.initialAngle, pend.length, pend.isPlaying, L, PIVOT_Y]);

  useFrame((_, delta) => {
    const p = physRef.current;
    if (p.phase !== 'running') return;

    const dt = Math.min(delta, 0.033);
    const { gravity: g, mass: m, damping: b } = pend;

    // Sub-step RK4 for accuracy
    const SUBS = 4;
    const subDt = dt / SUBS;
    for (let i = 0; i < SUBS; i++) {
      const [nt, no] = rk4Step(p.theta, p.omega, subDt, g, L, b);
      // Count oscillations: zero crossing going positive
      const prevNeg = p.theta < 0;
      const nowPos = nt >= 0;
      if (prevNeg && nowPos && no > 0) {
        p.oscillations += 1;
        if (p.lastZeroTime >= 0) p.measuredPeriod = p.time - p.lastZeroTime;
        p.lastZeroTime = p.time;
      }
      p.theta = nt;
      p.omega = no;
    }
    p.time += dt;

    const KE = 0.5 * m * L * L * p.omega * p.omega;
    const PE = m * g * L * (1 - Math.cos(p.theta));
    const v = L * Math.abs(p.omega);

    const bX = L * Math.sin(p.theta);
    const bY = PIVOT_Y - L * Math.cos(p.theta);

    // Direct mesh mutation (no re-render)
    if (bobRef.current) {
      bobRef.current.position.x = bX;
      bobRef.current.position.y = bY;
    }

    // Trail
    trailRef.current.push(new THREE.Vector3(bX, bY, 0));
    if (trailRef.current.length > 120) trailRef.current.shift();

    // Auto-stop when damping has settled the pendulum
    if (b > 0.01 && Math.abs(p.theta) < 0.005 && Math.abs(p.omega) < 0.005) {
      p.phase = 'idle';
      dispatch(setPlaying(false));
    }

    // React display every 3 frames, Redux every 9
    frameCount.current++;
    if (frameCount.current % 3 === 0) {
      setDisp({ bobX: bX, bobY: bY, theta: p.theta, velocity: v, period: p.measuredPeriod, oscillations: p.oscillations });
      if (frameCount.current % 9 === 0) {
        dispatch(updatePendulumState({
          time: p.time, angle: p.theta, angularVelocity: p.omega,
          velocity: v, kineticEnergy: KE, potentialEnergy: PE, totalEnergy: KE + PE,
          period: p.measuredPeriod, oscillations: p.oscillations,
        }));
      }
    }
  });

  const theta0 = (pend.initialAngle * Math.PI) / 180;
  const showBobX = pend.isPlaying || pend.state.time > 0 ? disp.bobX : L * Math.sin(theta0);
  const showBobY = pend.isPlaying || pend.state.time > 0 ? disp.bobY : PIVOT_Y - L * Math.cos(theta0);
  const showTheta = pend.isPlaying || pend.state.time > 0 ? disp.theta : theta0;
  const theoreticalT = 2 * Math.PI * Math.sqrt(L / pend.gravity);
  const arcRadius = Math.min(L * 0.28, 0.75);

  return (
    <>
      <color attach="background" args={[sc.bg]} />
      <fog attach="fog" args={[sc.fogColor, sc.fogNear, sc.fogFar]} />
      {sc.starsCount > 0 && <Stars radius={50} depth={30} count={sc.starsCount} factor={2} />}

      <ambientLight intensity={sc.ambientIntensity} color={sc.ambientColor} />
      <directionalLight position={[5, 10, 5]} intensity={sc.dirIntensity} color={sc.dirColor} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[showBobX, showBobY, 1.5]} intensity={0.6} color={sc.bobColor} distance={L * 2.5} />

      <InfiniteGround y={0} baseColor={sc.groundBase} cellColor={sc.groundCell} sectionColor={sc.groundSection} />

      {/* Pivot */}
      <PivotBracket y={PIVOT_Y} color={sc.pivotColor} />

      {/* Vertical reference (dashed) */}
      <Line
        points={[[0, PIVOT_Y - 0.06, 0], [0, PIVOT_Y - arcRadius - 0.05, 0]]}
        color="#334155"
        lineWidth={1}
        dashed
        dashSize={0.07}
        gapSize={0.05}
      />

      {/* Angle arc */}
      <AngleArc pivotY={PIVOT_Y} radius={arcRadius} angle={showTheta} />

      {/* String */}
      <Line
        points={[[0, PIVOT_Y, 0], [showBobX, showBobY, 0]]}
        color={sc.stringColor}
        lineWidth={2.5}
      />

      {/* Trail */}
      {trailRef.current.length > 2 && (
        <Line
          points={trailRef.current}
          color={sc.bobColor}
          lineWidth={2}
          transparent
          opacity={0.22}
        />
      )}

      {/* Bob */}
      <mesh ref={bobRef} position={[showBobX, showBobY, 0]} castShadow>
        <sphereGeometry args={[BOB_R, 32, 32]} />
        <meshStandardMaterial
          color={sc.bobColor}
          metalness={0.75}
          roughness={0.15}
          emissive={sc.bobColor}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Bob label */}
      <Billboard position={[showBobX + BOB_R + 0.18, showBobY + 0.1, 0]}>
        <Text fontSize={0.17} color={sc.bobColor} anchorX="left" anchorY="middle">
          {`θ = ${(showTheta * 180 / Math.PI).toFixed(1)}°`}
        </Text>
        {pend.isPlaying && (
          <Text fontSize={0.14} color="#94a3b8" anchorX="left" anchorY="middle" position={[0, -0.22, 0]}>
            {`v = ${disp.velocity.toFixed(2)} m/s`}
          </Text>
        )}
      </Billboard>

      {/* Period / oscillation counter at top */}
      <Billboard position={[0, PIVOT_Y + 0.75, 0]}>
        <Text fontSize={0.2} color="#a5b4fc" anchorX="center" anchorY="middle">
          {pend.isPlaying && disp.oscillations > 0 && disp.period > 0
            ? `T medido = ${disp.period.toFixed(3)} s  |  n = ${disp.oscillations}`
            : `T teórico ≈ ${theoreticalT.toFixed(3)} s`}
        </Text>
      </Billboard>

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={2}
        maxDistance={20}
        target={[0, PIVOT_Y / 2, 0]}
      />
    </>
  );
}
