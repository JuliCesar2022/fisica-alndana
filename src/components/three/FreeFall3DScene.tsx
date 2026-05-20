import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars, Text, Line, OrbitControls } from '@react-three/drei';
import { useSelector, useDispatch } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../../store/store';
import { updatePhysicsData, setPlaying, setPlanet } from '../../store/freeFallSlice';

// ─── Planet Theme Definitions ──────────────────────────────────────
const PLANET_CONFIG = {
  earth:   { sky: '#87ceeb', ground: '#22c55e', fog: '#b0e0ff', ambientInt: 0.6, sunColor: '#fffbe6', hazeColor: '#b0e0ff' },
  moon:    { sky: '#050812', ground: '#5a6272', fog: '#0a0e1a', ambientInt: 0.15, sunColor: '#c8d8ff', hazeColor: '#050812' },
  mars:    { sky: '#8b3a10', ground: '#9a3412', fog: '#6b2800', ambientInt: 0.5, sunColor: '#ff9966', hazeColor: '#6b2800' },
  jupiter: { sky: '#1e1b4b', ground: '#b45309', fog: '#1a1640', ambientInt: 0.4, sunColor: '#f5c842', hazeColor: '#1e1b4b' },
  custom:  { sky: '#0a0e17', ground: '#1e293b', fog: '#0a0e17', ambientInt: 0.4, sunColor: '#d0e0ff', hazeColor: '#0a0e17' },
};

// ─── Ruler Tick Marks ──────────────────────────────────────────────
function Ruler({ maxH }: { maxH: number }) {
  const ticks = [];
  for (let h = 0; h <= maxH; h += 50) {
    const yPos = (h / maxH) * 10;
    ticks.push(
      <group key={h} position={[-1.2, yPos, 0]}>
        <Line
          points={[[-0.15, 0, 0], [0, 0, 0]]}
          color="#94a3b8"
          lineWidth={1}
        />
        <Text
          position={[-0.3, 0, 0]}
          fontSize={0.18}
          color="#94a3b8"
          anchorX="right"
          anchorY="middle"
          font={undefined}
        >
          {`${h}m`}
        </Text>
      </group>
    );
  }
  return (
    <group>
      {/* Vertical ruler line */}
      <Line
        points={[[-1.2, 0, 0], [-1.2, 10, 0]]}
        color="#475569"
        lineWidth={1.5}
      />
      {ticks}
    </group>
  );
}

// ─── Trail Spheres ─────────────────────────────────────────────────
function Trail({ points, color }: { points: THREE.Vector3[]; color: string }) {
  return (
    <>
      {points.map((p, i) => {
        const opacity = (i + 1) / points.length * 0.5;
        const size = 0.03 + (i / points.length) * 0.07;
        return (
          <mesh key={i} position={p}>
            <sphereGeometry args={[size, 8, 8]} />
            <meshStandardMaterial color={color} transparent opacity={opacity} />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Ground Plane ─────────────────────────────────────────────────
function Ground({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color={color} roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

// ─── Grid overlay on ground ────────────────────────────────────────
function GridOverlay() {
  return (
    <gridHelper args={[30, 30, '#1e293b', '#1e293b']} position={[0, 0.001, 0]} />
  );
}

// ─── Physics Ball (the main interactive element) ───────────────────
function PhysicsBall({
  yNorm,       // 0..1 normalized height (0 = ground, 1 = maxH)
  ballColor,
  trailColor,
  isPlaying,
  onDragStart,
  onDrag,
}: {
  yNorm: number;
  ballColor: string;
  trailColor: string;
  isPlaying: boolean;
  onDragStart: () => void;
  onDrag: (newNorm: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, gl } = useThree();
  const [trail, setTrail] = useState<THREE.Vector3[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));

  const yWorld = yNorm * 10;

  // Sync position
  useFrame(() => {
    if (meshRef.current && !isDragging) {
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, yWorld, 0.25);
    }
    if (isPlaying && meshRef.current) {
      const pos = meshRef.current.position.clone();
      setTrail(prev => {
        const newTrail = [...prev, pos];
        return newTrail.slice(-30);
      });
    } else if (!isPlaying) {
      setTrail([]);
    }
  });

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    setIsDragging(true);
    onDragStart();
    gl.domElement.style.cursor = 'grabbing';
  }, [onDragStart, gl]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging) return;
    // Project to Y axis
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersect);
    const newNorm = THREE.MathUtils.clamp(intersect.y / 10, 0, 1);
    onDrag(newNorm);
    if (meshRef.current) meshRef.current.position.y = intersect.y;
  }, [isDragging, onDrag, raycaster]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    gl.domElement.style.cursor = 'auto';
  }, [gl]);

  return (
    <>
      <Trail points={trail} color={trailColor} />
      <mesh
        ref={meshRef}
        position={[0, yWorld, 0]}
        castShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial
          color={ballColor}
          roughness={0.1}
          metalness={0.7}
          emissive={ballColor}
          emissiveIntensity={0.1}
        />
      </mesh>
    </>
  );
}

// ─── Main Scene (no Canvas, used INSIDE a Canvas) ─────────────────
export default function FreeFall3DScene() {
  const dispatch = useDispatch();
  const ff = useSelector((s: RootState) => s.freefall);

  const simTimeRef = useRef(0);
  const isPlayingRef = useRef(false);

  // Keep ref in sync with redux
  useEffect(() => { isPlayingRef.current = ff.isPlaying; }, [ff.isPlaying]);

  const planet = ff.planet ?? 'earth';
  const cfg = PLANET_CONFIG[planet];
  const maxH = 500;

  // Normalized height: 0 at ground, 1 at maxH
  const yNorm = ff.state.y / maxH;

  // Ball and trail colors per planet
  const ballColors: Record<string, string> = {
    earth: '#f8fafc', moon: '#e2e8f0', mars: '#fef08a', jupiter: '#f8fafc', custom: '#e2e8f0'
  };
  const trailColors: Record<string, string> = {
    earth: '#3b82f6', moon: '#94a3b8', mars: '#ea580c', jupiter: '#f59e0b', custom: '#3b82f6'
  };

  // Reset timer on planet/height change
  useEffect(() => {
    simTimeRef.current = 0;
  }, [ff.planet, ff.height]);

  // Physics loop via useFrame
  function PhysicsLoop() {
    useFrame((_, delta) => {
      if (!isPlayingRef.current) return;
      simTimeRef.current += delta;
      const t = simTimeRef.current;
      const g = ff.gravity;
      const h0 = ff.height;
      let currentY = h0 - 0.5 * g * t * t;
      let vel = g * t;
      if (currentY <= 0) {
        currentY = 0;
        vel = Math.sqrt(2 * g * h0);
        simTimeRef.current = 0;
        dispatch(setPlaying(false));
      }
      const pe = ff.mass * g * currentY;
      const ke = 0.5 * ff.mass * vel * vel;
      dispatch(updatePhysicsData({
        time: t, y: currentY, velocity: vel,
        potentialEnergy: pe, kineticEnergy: ke, totalEnergy: pe + ke
      }));
    });
    return null;
  }

  const handleDragStart = useCallback(() => {
    dispatch(setPlaying(false));
    simTimeRef.current = 0;
  }, [dispatch]);

  const handleDrag = useCallback((newNorm: number) => {
    const newH = Math.round(newNorm * maxH);
    const clamped = Math.max(10, Math.min(500, newH));
    dispatch({ type: 'freefall/setHeight', payload: clamped });
    dispatch(updatePhysicsData({
      time: 0, y: clamped, velocity: 0,
      potentialEnergy: ff.mass * ff.gravity * clamped,
      kineticEnergy: 0,
      totalEnergy: ff.mass * ff.gravity * clamped,
    }));
  }, [dispatch, ff.mass, ff.gravity, maxH]);

  return (
    <>
      <PhysicsLoop />

      {/* Fog */}
      <fog attach="fog" args={[cfg.fog, 20, 80]} />

      {/* Lighting */}
      <ambientLight intensity={cfg.ambientInt} color={cfg.hazeColor} />
      <directionalLight
        position={[5, 15, 8]}
        intensity={1.2}
        color={cfg.sunColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Stars (only moon) */}
      {planet === 'moon' && <Stars radius={40} depth={30} count={4000} factor={3} />}
      {planet === 'jupiter' && <Stars radius={60} depth={20} count={1000} factor={2} />}

      {/* Environment */}
      <color attach="background" args={[cfg.sky]} />
      <Ground color={cfg.ground} />
      <GridOverlay />

      {/* Ruler */}
      <Ruler maxH={maxH} />

      {/* Ball */}
      <PhysicsBall
        yNorm={yNorm}
        ballColor={ballColors[planet]}
        trailColor={trailColors[planet]}
        isPlaying={ff.isPlaying}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
      />

      {/* Camera Control */}
      <OrbitControls
        target={[0, 5, 0]}
        minDistance={3}
        maxDistance={40}
        enablePan={false}
        makeDefault
      />
    </>
  );
}
