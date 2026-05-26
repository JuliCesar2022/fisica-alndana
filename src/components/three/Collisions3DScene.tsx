import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import InfiniteGround from './InfiniteGround';
import { Stars, Text, Line, OrbitControls, Billboard } from '@react-three/drei';
import { useSelector, useDispatch } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../../store/store';
import { setPlaying, setResults, CollisionScene } from '../../store/collisionSlice';

// ─── Scene Configurations ──────────────────────────────────────────
interface ColSceneCfg {
  bg: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientIntensity: number;
  ambientColor: string;
  dirIntensity: number;
  dirColor: string;
  trackColor: string;
  groundBase: string;
  groundCell: string;
  groundSection: string;
  starsCount: number;
}

const COLLISION_SCENES: Record<CollisionScene, ColSceneCfg> = {
  space: {
    bg: '#0a0e17', fogColor: '#0a0e17', fogNear: 22, fogFar: 60,
    ambientIntensity: 0.35, ambientColor: '#ffffff',
    dirIntensity: 1.1, dirColor: '#fffbe6',
    trackColor: '#1e293b',
    groundBase: '#0a0e17', groundCell: '#1e293b', groundSection: '#2d3f52',
    starsCount: 2500,
  },
  ice: {
    bg: '#cce8f5', fogColor: '#cce8f5', fogNear: 20, fogFar: 55,
    ambientIntensity: 1.1, ambientColor: '#e0f7ff',
    dirIntensity: 1.6, dirColor: '#ffffff',
    trackColor: '#5b9fd4',
    groundBase: '#cce8f5', groundCell: '#5b9fd4', groundSection: '#2a6fa8',
    starsCount: 0,
  },
  billiard: {
    bg: '#0a1f0c', fogColor: '#0a1f0c', fogNear: 18, fogFar: 48,
    ambientIntensity: 0.6, ambientColor: '#fffbe6',
    dirIntensity: 1.9, dirColor: '#ffe8a0',
    trackColor: '#1a4020',
    groundBase: '#153317', groundCell: '#1e4a20', groundSection: '#26612a',
    starsCount: 0,
  },
};

// ─── Ball radius scaled by mass ────────────────────────────────────
const ballRadius = (mass: number) => 0.28 + Math.cbrt(mass) * 0.13;

// ─── Velocity Arrow ────────────────────────────────────────────────
function VelArrow({ vel, color, yBase }: { vel: number; color: string; yBase: number }) {
  if (Math.abs(vel) < 0.05) return null;
  const len = Math.min(Math.abs(vel) * 0.35, 2.5);
  const dir = vel > 0 ? 1 : -1;
  const tip: [number, number, number] = [dir * len, yBase + 0.05, 0];
  const base: [number, number, number] = [0, yBase + 0.05, 0];
  const headA: [number, number, number] = [tip[0] - dir * 0.18, yBase + 0.18, 0];
  const headB: [number, number, number] = [tip[0] - dir * 0.18, yBase - 0.08, 0];
  return (
    <group>
      <Line points={[base, tip]} color={color} lineWidth={3} />
      <Line points={[headA, tip, headB]} color={color} lineWidth={3} />
    </group>
  );
}

// ─── Infinite Track / Rail ─────────────────────────────────────────
function Track({ color }: { color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.x = camera.position.x;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[800, 0.14, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.15} />
      </mesh>
    </group>
  );
}

// ─── Separator line showing initial boundary ───────────────────────
function CenterLine({ x }: { x: number }) {
  return (
    <Line
      points={[[x, -0.06, 0], [x, 1.8, 0]]}
      color="#475569"
      lineWidth={1}
      dashed
      dashSize={0.1}
      gapSize={0.08}
    />
  );
}

// ─── Phase display label ────────────────────────────────────────────
function PhaseLabel({ text, color }: { text: string; color: string }) {
  return (
    <Billboard position={[0, 3.2, 0]}>
      <Text fontSize={0.28} color={color} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </Billboard>
  );
}

// ─── Main Scene ────────────────────────────────────────────────────
export default function Collisions3DScene() {
  const dispatch = useDispatch();
  const col = useSelector((s: RootState) => s.collision);
  const sc = COLLISION_SCENES[col.scene ?? 'space'];

  const r1 = ballRadius(col.m1);
  const r2 = ballRadius(col.m2);

  // Physics refs — mutable, no re-renders
  const physRef = useRef({
    x1: -6.0,
    x2: 1.5,
    vel1: col.v1,
    vel2: col.v2,
    phase: 'idle' as 'idle' | 'running' | 'done',
    hasCollided: false,
    flashTime: -1,
    flashX: 0,
    simTime: 0,
  });

  // Group refs for direct position mutation in useFrame
  const group1Ref = useRef<THREE.Group>(null);
  const group2Ref = useRef<THREE.Group>(null);

  // Display state — updated at reduced frequency for React labels
  const [disp, setDisp] = useState({
    x1: -6.0, x2: 1.5,
    vel1: col.v1, vel2: col.v2,
    flashActive: false, flashX: 0,
    phase: 'idle' as 'idle' | 'running' | 'done',
  });
  const frameCount = useRef(0);

  // When play starts: reset physics ref
  useEffect(() => {
    const p = physRef.current;
    if (col.isPlaying) {
      p.x1 = -6.0;
      p.x2 = 1.5;
      p.vel1 = col.v1;
      p.vel2 = col.v2;
      p.phase = 'running';
      p.hasCollided = false;
      p.flashTime = -1;
      p.simTime = 0;
      // Sync groups immediately (Y is fixed to radius so balls sit on track)
      if (group1Ref.current) { group1Ref.current.position.x = p.x1; group1Ref.current.position.y = r1; }
      if (group2Ref.current) { group2Ref.current.position.x = p.x2; group2Ref.current.position.y = r2; }
      setDisp({ x1: p.x1, x2: p.x2, vel1: p.vel1, vel2: p.vel2, flashActive: false, flashX: 0, phase: 'running' });
    } else {
      p.phase = 'idle';
    }
  }, [col.isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // When reset (isPlaying goes false AND no results): restore visuals to initial
  useEffect(() => {
    if (!col.isPlaying && col.results === null) {
      physRef.current.x1 = -6.0;
      physRef.current.x2 = 1.5;
      physRef.current.vel1 = col.v1;
      physRef.current.vel2 = col.v2;
      if (group1Ref.current) { group1Ref.current.position.x = -6.0; group1Ref.current.position.y = r1; }
      if (group2Ref.current) { group2Ref.current.position.x = 1.5;  group2Ref.current.position.y = r2; }
      setDisp({ x1: -6.0, x2: 1.5, vel1: col.v1, vel2: col.v2, flashActive: false, flashX: 0, phase: 'idle' });
    }
  }, [col.isPlaying, col.results, col.v1, col.v2]);

  useFrame((_, delta) => {
    const p = physRef.current;
    if (p.phase !== 'running') return;

    const dt = Math.min(delta, 0.033);
    p.simTime += dt;

    // Substep to avoid tunnelling
    const steps = Math.ceil(Math.abs(p.vel1 - p.vel2) * dt / Math.max(r1 + r2, 0.3));
    const subDt = dt / Math.max(steps, 1);

    for (let i = 0; i < Math.max(steps, 1); i++) {
      p.x1 += p.vel1 * subDt;
      p.x2 += p.vel2 * subDt;

      if (!p.hasCollided && p.x1 + r1 >= p.x2 - r2) {
        p.hasCollided = true;

        const { m1, m2 } = col;
        const e = col.restitution;
        const v1 = p.vel1, v2 = p.vel2;

        const v1p = ((m1 - e * m2) * v1 + m2 * (1 + e) * v2) / (m1 + m2);
        const v2p = ((m2 - e * m1) * v2 + m1 * (1 + e) * v1) / (m1 + m2);

        // Resolve overlap
        const overlap = p.x1 + r1 - (p.x2 - r2);
        p.x1 -= overlap * (m2 / (m1 + m2));
        p.x2 += overlap * (m1 / (m1 + m2));

        p.vel1 = v1p;
        p.vel2 = v2p;
        p.flashX = (p.x1 + p.x2) / 2;
        p.flashTime = 0;

        const pBefore = m1 * v1 + m2 * v2;
        const pAfter  = m1 * v1p + m2 * v2p;
        const keBefore = 0.5 * m1 * v1  * v1  + 0.5 * m2 * v2  * v2;
        const keAfter  = 0.5 * m1 * v1p * v1p + 0.5 * m2 * v2p * v2p;

        dispatch(setResults({
          v1After: v1p, v2After: v2p,
          pBefore, pAfter,
          keBefore, keAfter,
          keLost: keBefore - keAfter,
          impulse: Math.abs(m1 * (v1p - v1)),
        }));
      }
    }

    // Flash timer
    if (p.flashTime >= 0) {
      p.flashTime += dt;
      if (p.flashTime > 0.35) p.flashTime = -1;
    }

    // Update 3D positions directly (no re-render)
    if (group1Ref.current) group1Ref.current.position.x = p.x1;
    if (group2Ref.current) group2Ref.current.position.x = p.x2;

    // Finish conditions
    const bothFar  = p.hasCollided && Math.abs(p.x1) > 13 && Math.abs(p.x2) > 13;
    const bothSlow = p.hasCollided && Math.abs(p.vel1) < 0.08 && Math.abs(p.vel2) < 0.08;
    const timeout  = p.simTime > 18;

    if (bothFar || bothSlow || timeout) {
      p.phase = 'done';
      dispatch(setPlaying(false));
    }

    // React display update every 2 frames
    frameCount.current++;
    if (frameCount.current % 2 === 0) {
      setDisp({
        x1: p.x1, x2: p.x2,
        vel1: p.vel1, vel2: p.vel2,
        flashActive: p.flashTime >= 0,
        flashX: p.flashX,
        phase: p.phase,
      });
    }
  });

  const phaseLabel =
    disp.phase === 'running' ? (col.results ? 'Post-colisión' : 'Aproximándose...') :
    disp.phase === 'done'    ? 'Simulación completada' : '';
  const phaseLabelColor =
    disp.phase === 'done' ? '#10b981' : col.results ? '#f59e0b' : '#94a3b8';

  return (
    <>
      <color attach="background" args={[sc.bg]} />
      <fog attach="fog" args={[sc.fogColor, sc.fogNear, sc.fogFar]} />
      {sc.starsCount > 0 && <Stars radius={50} depth={30} count={sc.starsCount} factor={2.5} />}

      <ambientLight intensity={sc.ambientIntensity} color={sc.ambientColor} />
      <directionalLight
        position={[5, 10, 5]} intensity={sc.dirIntensity} color={sc.dirColor}
        castShadow shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#818cf8" distance={12} />

      <InfiniteGround y={-0.155} baseColor={sc.groundBase} cellColor={sc.groundCell} sectionColor={sc.groundSection} />

      {/* Track */}
      <Track color={sc.trackColor} />

      {/* Initial separator — shows the gap */}
      {!col.isPlaying && col.results === null && (
        <CenterLine x={(disp.x1 + disp.x2) / 2} />
      )}

      {/* Phase label */}
      {phaseLabel !== '' && (
        <PhaseLabel text={phaseLabel} color={phaseLabelColor} />
      )}

      {/* ── Ball 1 (red) ── */}
      <group ref={group1Ref} position={[disp.x1, r1, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[r1, 32, 32]} />
          <meshStandardMaterial
            color="#ef4444" roughness={0.2} metalness={0.7}
            emissive="#ef4444" emissiveIntensity={0.18}
          />
        </mesh>
        {/* Velocity arrow */}
        <VelArrow vel={disp.vel1} color="#ef4444" yBase={r1 + 0.25} />
        {/* Labels */}
        <Billboard position={[0, r1 + 0.95, 0]}>
          <Text fontSize={0.21} color="#f87171" anchorX="center">{`m₁ = ${col.m1} kg`}</Text>
          <Text fontSize={0.17} color="#ef4444" anchorX="center" position={[0, -0.26, 0]}>
            {`v = ${disp.vel1 >= 0 ? '+' : ''}${disp.vel1.toFixed(2)} m/s`}
          </Text>
        </Billboard>
      </group>

      {/* ── Ball 2 (blue) ── */}
      <group ref={group2Ref} position={[disp.x2, r2, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[r2, 32, 32]} />
          <meshStandardMaterial
            color="#3b82f6" roughness={0.2} metalness={0.7}
            emissive="#3b82f6" emissiveIntensity={0.18}
          />
        </mesh>
        <VelArrow vel={disp.vel2} color="#3b82f6" yBase={r2 + 0.25} />
        <Billboard position={[0, r2 + 0.95, 0]}>
          <Text fontSize={0.21} color="#93c5fd" anchorX="center">{`m₂ = ${col.m2} kg`}</Text>
          <Text fontSize={0.17} color="#3b82f6" anchorX="center" position={[0, -0.26, 0]}>
            {`v = ${disp.vel2 >= 0 ? '+' : ''}${disp.vel2.toFixed(2)} m/s`}
          </Text>
        </Billboard>
      </group>

      {/* ── Impact flash ── */}
      {disp.flashActive && (
        <mesh position={[disp.flashX, (r1 + r2) * 0.5, 0]}>
          <sphereGeometry args={[(r1 + r2) * 0.75, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
        </mesh>
      )}

      {/* ── Post-collision result labels (shown after collision) ── */}
      {col.results && !col.isPlaying && (
        <group position={[0, 2.2, 0]}>
          <Billboard>
            <Text fontSize={0.2} color="#10b981" anchorX="center">
              {`p = ${col.results.pAfter.toFixed(3)} kg·m/s  |  ΔKE = ${col.results.keLost.toFixed(3)} J`}
            </Text>
          </Billboard>
        </group>
      )}

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={3}
        maxDistance={22}
        target={[0, 0.5, 0]}
      />
    </>
  );
}
