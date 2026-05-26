import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import InfiniteGround from './InfiniteGround';
import { Stars, Text, Line, OrbitControls, Billboard } from '@react-three/drei';
import { useSelector, useDispatch } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../../store/store';
import { updatePhysicsData, setPlaying, RampScene } from '../../store/rampSlice';
import { ForceCalculator } from '../../physics/ForceCalculator';
import { MATERIALS } from '../../utils/constants';
import { EVENT_RESET_RAMP } from '../panels/MiroLeftPanel';

// ─── Scene Configurations ──────────────────────────────────────────
interface RampSceneCfg {
  bg: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientIntensity: number;
  ambientColor: string;
  dirIntensity: number;
  dirColor: string;
  groundBase: string;
  groundCell: string;
  groundSection: string;
  starsCount: number;
}

const RAMP_SCENES: Record<RampScene, RampSceneCfg> = {
  lab: {
    bg: '#0a0e17', fogColor: '#0a0e17', fogNear: 20, fogFar: 60,
    ambientIntensity: 0.4, ambientColor: '#ffffff',
    dirIntensity: 1.2, dirColor: '#fffbe6',
    groundBase: '#0a0e17', groundCell: '#1e293b', groundSection: '#2d3f52',
    starsCount: 2000,
  },
  mountain: {
    bg: '#7ec8e3', fogColor: '#b8dde8', fogNear: 25, fogFar: 80,
    ambientIntensity: 0.9, ambientColor: '#fffbe6',
    dirIntensity: 2.2, dirColor: '#fff5d0',
    groundBase: '#2d5a1b', groundCell: '#3a7024', groundSection: '#4a8c2e',
    starsCount: 0,
  },
  moon: {
    bg: '#04050a', fogColor: '#07090f', fogNear: 22, fogFar: 65,
    ambientIntensity: 0.18, ambientColor: '#b0c4de',
    dirIntensity: 0.85, dirColor: '#dde8ff',
    groundBase: '#111318', groundCell: '#1c1f28', groundSection: '#252932',
    starsCount: 4500,
  },
};

// ─── Material Colors ───────────────────────────────────────────────
const MAT_COLORS: Record<string, string> = {
  ice: '#93c5fd',
  wood: '#c2956a',
  rubber: '#6b7280',
  steel: '#9ca3af',
  sandpaper: '#d6b896',
  custom: '#a78bfa',
};

// ─── Arrow (force vector) with Billboard label ─────────────────────
function ForceArrow({
  origin, direction, magnitude, color, label
}: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  magnitude: number;
  color: string;
  label: string;
}) {
  const len = Math.min(magnitude * 0.04, 1.5);
  if (len < 0.05) return null;
  const norm = direction.clone().normalize();
  const end = origin.clone().addScaledVector(norm, len);
  return (
    <group>
      <Line points={[origin, end]} color={color} lineWidth={2.5} />
      {/* Billboard ensures text always faces camera — fixes the mirrored labels */}
      <Billboard position={end}>
        <Text fontSize={0.14} color={color} anchorX="center" anchorY="bottom">
          {`${label}: ${magnitude.toFixed(2)}N`}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Procedural Texture Generator ──────────────────────────────────
const createProceduralTexture = (materialType: string): THREE.Texture => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (materialType === 'wood') {
    // 🪵 Wood Grain Texture
    ctx.fillStyle = '#c2956a';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 3.5;
    for (let i = -size; i < size * 2; i += 28) {
      ctx.beginPath();
      for (let y = 0; y < size; y++) {
        const x = i + Math.sin(y * 0.025) * 12 + Math.cos(i * 0.04) * 6;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (materialType === 'ice') {
    // ❄️ Glowing Ice Texture
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2.0;
    for (let i = 0; i < 28; i++) {
      ctx.beginPath();
      let cx = Math.random() * size;
      let cy = Math.random() * size;
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 4; j++) {
        cx += (Math.random() - 0.5) * 80;
        cy += (Math.random() - 0.5) * 80;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  } else if (materialType === 'steel') {
    // ⚙️ Brushed Steel Texture
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#9ca3af');
    grad.addColorStop(0.3, '#e5e7eb');
    grad.addColorStop(0.5, '#6b7280');
    grad.addColorStop(0.7, '#d1d5db');
    grad.addColorStop(1, '#9ca3af');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 180; i++) {
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
  } else if (materialType === 'sandpaper') {
    // ⏳ Sandpaper Texture (Granular Noise)
    ctx.fillStyle = '#d6b896';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#b49c7f';
    for (let i = 0; i < 16000; i++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      ctx.fillRect(rx, ry, 1.8, 1.8);
    }
  } else if (materialType === 'rubber') {
    // 🛞 Textured Treaded Rubber
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 6;
    for (let i = 0; i < size; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, size);
      ctx.moveTo(0, i); ctx.lineTo(size, i);
      ctx.stroke();
    }
  } else {
    // Custom/Default Grid
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    for (let i = 0; i < size; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, size);
      ctx.moveTo(0, i); ctx.lineTo(size, i);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1); // scale wrapping cleanly
  return texture;
};

// ─── Ramp Geometry ─────────────────────────────────────────────────
function RampMesh({ angleRad, length, material }: { angleRad: number; length: number; material: string }) {
  const h = Math.sin(angleRad) * length;
  const w = Math.cos(angleRad) * length;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, 0);
  shape.lineTo(0, h);
  shape.lineTo(0, 0);

  const extrudeSettings = { depth: 0.6, bevelEnabled: false };
  const texture = React.useMemo(() => createProceduralTexture(material), [material]);

  return (
    <group position={[-w / 2, 0, -0.3]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial 
          map={texture} 
          roughness={material === 'ice' ? 0.05 : material === 'steel' ? 0.15 : 0.8} 
          metalness={material === 'steel' ? 0.95 : 0.0} 
        />
      </mesh>
      {/* Ramp surface edge highlight */}
      <Line
        points={[[0, h, 0.6], [w, 0, 0.6]]}
        color="#ffffff"
        lineWidth={1.5}
      />
    </group>
  );
}

// ─── Flat Platform (right-only, anchored at ramp base) ──────────────
// Extends 800 units to the right; left edge sits exactly at the ramp foot.
function PlatformMesh({ rampBaseX, material }: { rampBaseX: number; material: string }) {
  const WIDTH = 800;
  const centerX = rampBaseX + WIDTH / 2;

  const texture = React.useMemo(() => {
    const tex = createProceduralTexture(material);
    tex.repeat.set(80, 1);
    return tex;
  }, [material]);

  return (
    <mesh position={[centerX, -0.05, 0]} castShadow receiveShadow>
      <boxGeometry args={[WIDTH, 0.1, 0.6]} />
      <meshStandardMaterial
        map={texture}
        roughness={material === 'ice' ? 0.05 : material === 'steel' ? 0.15 : 0.8}
        metalness={material === 'steel' ? 0.95 : 0.0}
      />
    </mesh>
  );
}

// ─── Photoelectric Sensor Gate ──────────────────────────────────────
function SensorGate({
  dist,
  label,
  isTriggered,
  angleRad,
  rampOriginX,
  rampH,
  tangentX,
  tangentY,
  normalX,
  normalY,
  ballRadius,
}: {
  dist: number;
  label: string;
  isTriggered: boolean;
  angleRad: number;
  rampOriginX: number;
  rampH: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  ballRadius: number;
}) {
  // Point on the ramp surface
  const ptX = rampOriginX + tangentX * dist;
  const ptY = rampH + tangentY * dist;

  // Color for the laser and indicator
  const activeColor = isTriggered ? '#ef4444' : '#10b981';
  const laserMaterialColor = isTriggered ? '#ef4444' : '#10b981';

  // Dynamic pillar height based on ball radius so it always fits perfectly
  const pillarHeight = Math.max(0.08, ballRadius * 1.25);
  const laserHeight = ballRadius;

  return (
    <group position={[ptX, ptY, 0]} rotation={[0, 0, angleRad]}>
      {/* Back Pillar */}
      <mesh position={[0, pillarHeight / 2, -0.34]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, pillarHeight, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.2} metalness={0.9} />
      </mesh>
      
      {/* Front Pillar */}
      <mesh position={[0, pillarHeight / 2, 0.34]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, pillarHeight, 8]} />
        <meshStandardMaterial color="#475569" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Laser Beam connecting the two pillars at center height of ball */}
      <mesh position={[0, laserHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.68, 8]} />
        <meshBasicMaterial color={laserMaterialColor} toneMapped={false} />
      </mesh>

      {/* Glow dot on pillars */}
      <mesh position={[0, laserHeight, -0.34]}>
        <sphereGeometry args={[Math.max(0.008, ballRadius * 0.1), 8, 8]} />
        <meshBasicMaterial color={activeColor} />
      </mesh>
      <mesh position={[0, laserHeight, 0.34]}>
        <sphereGeometry args={[Math.max(0.008, ballRadius * 0.1), 8, 8]} />
        <meshBasicMaterial color={activeColor} />
      </mesh>

      {/* Sensor Label above the gate */}
      <Billboard position={[0, pillarHeight + 0.06, 0]}>
        <Text fontSize={Math.max(0.08, ballRadius * 0.6)} color={activeColor} anchorX="center" anchorY="middle">
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Rolling Sphere ────────────────────────────────────────────────
// Old SlidingMass definition removed – using new implementation below
function SlidingMass({ position, color, velocity, radius }: { position: THREE.Vector3; color: string; velocity: number; radius: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const rotationRef = useRef(0);
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.lerp(position, 0.3);
      // Rolling without slip: angular displacement = (v / r) * dt
      rotationRef.current += (velocity * delta) / radius;
      meshRef.current.rotation.z = -rotationRef.current;
    }
  });
  return (
    <mesh ref={meshRef} position={position} castShadow>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshStandardMaterial color={color} roughness={0.1} metalness={0.7} emissive={color} emissiveIntensity={0.25} />
    </mesh>
  );
}

// Physics Loop component

// ─── Physics Loop ─────────────────────────────────────────────────
function PhysicsLoop({
  forceCalcRef,
  isPlayingRef,
  dispatch,
}: {
  forceCalcRef: React.MutableRefObject<ForceCalculator>;
  isPlayingRef: React.MutableRefObject<boolean>;
  dispatch: any;
}) {
  useFrame((_, delta) => {
    if (!isPlayingRef.current) return;
    const dt = Math.min(delta, 0.05);
    const simState = forceCalcRef.current.step(dt);
    const forces = forceCalcRef.current.getForces();
    dispatch(updatePhysicsData({ forces, state: simState }));
    if (simState.finished) {
      isPlayingRef.current = false;
      dispatch(setPlaying(false));
    }
  });
  return null;
}

// ─── Cinematic Camera Controller ────────────────────────────────────
function CinematicCameraController({
  isPlaying,
  onRamp,
  massPosition,
  rampH,
  pos,
  rampLen,
}: {
  isPlaying: boolean;
  onRamp: boolean;
  massPosition: THREE.Vector3;
  rampH: number;
  pos: number;
  rampLen: number;
}) {
  const controlsRef = useRef<any>(null);
  const isPlayingRef = useRef(isPlaying);
  const introProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3(-15, 12, 22));

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      introProgress.current = 1.0; // skip intro if they click play immediately
    }
  }, [isPlaying]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    if (isPlayingRef.current) {
      // Cinematic Target: Smoothly track the ball
      const targetGoal = massPosition.clone();
      
      // Calculate a continuous progress value (0.0 to 1.0) with zero discontinuity:
      // - Phase 1 (On Ramp): progress goes from 0.0 to 0.5
      // - Phase 2 (On Ground): progress goes from 0.5 to 1.0
      let progress = 0;
      if (onRamp) {
        progress = 0.5 * Math.min(pos / rampLen, 1.0);
      } else {
        // Assume flat ground travel progresses over ~6.0 meters to reach full zoom-out overview
        progress = 0.5 + 0.5 * Math.min(pos / 6.0, 1.0);
      }
      
      // Offset starts closer/lower (close-up follow), and smoothly expands as the ball slides and rolls
      const offsetX = 2.0 + progress * 2.5;
      const offsetY = 0.6 + progress * 1.4;
      const offsetZ = 3.5 + progress * 2.5;
      
      const cameraGoal = massPosition.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));
      
      // Lerp camera and controls target for buttery smooth motion
      state.camera.position.lerp(cameraGoal, 0.08);
      controlsRef.current.target.lerp(targetGoal, 0.08);
      controlsRef.current.update();
    } else {
      if (introProgress.current < 1.0) {
        introProgress.current = Math.min(1.0, introProgress.current + delta * 0.55); // 1.8 second sweep
        const t = 1 - Math.pow(1 - introProgress.current, 3); // smooth cubic ease out

        const defaultTarget = new THREE.Vector3(0, rampH / 2, 0);
        // Default camera position: side overview of the ramp
        const endPos = new THREE.Vector3(rampLen / 2 + 1, rampH / 2 + 1, 4.5);

        state.camera.position.lerpVectors(startPos.current, endPos, t);
        controlsRef.current.target.lerp(defaultTarget, t);
        controlsRef.current.update();
      } else {
        // When resetting or stopped, smoothly return to the stable global center overview target
        const defaultTarget = new THREE.Vector3(0, rampH / 2, 0);
        controlsRef.current.target.lerp(defaultTarget, 0.08);
        controlsRef.current.update();
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      minDistance={2}
      maxDistance={25}
      enablePan={false}
      makeDefault
    />
  );
}

// ─── Main Ramp 3D Scene ────────────────────────────────────────────
export default function Ramp3DScene() {
  const dispatch = useDispatch();
  const ramp = useSelector((s: RootState) => s.ramp);
  const sc = RAMP_SCENES[ramp.scene ?? 'lab'];

  const angleRad = (ramp.angle * Math.PI) / 180;
  const rampLen = ramp.rampLength;
  const isPlayingRef = useRef(false);

  // Ball radius scales dynamically with the ramp length (from 0.5m to 5.0m)
  const ballRadius = Math.max(0.045, Math.min(0.18, rampLen * 0.075));

  const forceCalcRef = useRef<ForceCalculator>(
    new ForceCalculator(ramp.mass, ramp.angle, ramp.gravity, ramp.material, ramp.rampLength, ramp.customFriction, ramp.sensorDistances)
  );

  useEffect(() => { isPlayingRef.current = ramp.isPlaying; }, [ramp.isPlaying]);

  useEffect(() => {
    forceCalcRef.current = new ForceCalculator(
      ramp.mass, ramp.angle, ramp.gravity, ramp.material, ramp.rampLength, ramp.customFriction, ramp.sensorDistances
    );
  }, [ramp.angle, ramp.mass, ramp.gravity, ramp.material, ramp.customFriction, ramp.rampLength]);

  useEffect(() => {
    const onReset = () => {
      isPlayingRef.current = false;
      forceCalcRef.current = new ForceCalculator(
        ramp.mass, ramp.angle, ramp.gravity, ramp.material, ramp.rampLength, ramp.customFriction, ramp.sensorDistances
      );
    };
    window.addEventListener(EVENT_RESET_RAMP, onReset);
    return () => window.removeEventListener(EVENT_RESET_RAMP, onReset);
  }, [ramp.angle, ramp.mass, ramp.gravity, ramp.material, ramp.customFriction, ramp.rampLength]);

  // ── Ball position on the ramp surface ──────────────────────────
  // The ramp surface vector (unit tangent going down-right)
  const tangentX = Math.cos(angleRad);
  const tangentY = -Math.sin(angleRad);
  // Normal to the surface (perpendicular, pointing away from ramp face)
  const normalX = Math.sin(angleRad);
  const normalY = Math.cos(angleRad);

  // Top of ramp (start position of ball) in world coords
  // The ramp group is centered at [-w/2, 0], so the top-left vertex is at [0,0]
  const rampW = Math.cos(angleRad) * rampLen;
  const rampH = Math.sin(angleRad) * rampLen;
  const rampOriginX = -rampW / 2; // matches RampMesh group offset

  // Ball starts at the top of the slope and slides down
  const onRamp = ramp.state.onRamp ?? true;
  const pos = ramp.state.position; // meters along ramp or groundX
  
  let ballX: number;
  let ballY: number;
  let forceW = ramp.forces.weight;
  let forceN = ramp.forces.normalForce;
  let forceNet = ramp.forces.netForce;
  let netDir = new THREE.Vector3(tangentX, tangentY, 0); // Down-ramp tangent
  let normDir = new THREE.Vector3(normalX, normalY, 0);

  if (onRamp) {
    const ballOnRampX = rampOriginX + tangentX * pos;
    const ballOnRampY = rampH + tangentY * pos;
    // Offset by ball radius along the surface normal so it sits ON top, not inside
    ballX = ballOnRampX + normalX * ballRadius;
    ballY = ballOnRampY + normalY * ballRadius;
  } else {
    // On flat ground
    const rampEndXPos = rampOriginX + tangentX * rampLen; // Bottom of ramp
    ballX = rampEndXPos + pos; // pos is groundX when onGround is true
    ballY = ballRadius;

    // Forces on ground
    forceW = ramp.forces.weight;
    forceN = ramp.forces.weight; // normal force matches weight on flat ground
    // Friction deceleration acts in the negative horizontal direction
    netDir = new THREE.Vector3(-1, 0, 0);
    const frictionCoeff = MATERIALS[ramp.material]?.frictionKinetic ?? ramp.customFriction;
    forceNet = ramp.state.velocity > 0.01 ? frictionCoeff * ramp.forces.weight : 0;
    normDir = new THREE.Vector3(0, 1, 0); // straight up
  }

  const massPosition = new THREE.Vector3(ballX, ballY, 0);
  const gravDir = new THREE.Vector3(0, -1, 0);
  
  // Use a stable, static camera target centered on the ramp to prevent any panning camera jitter (temblor)
  const orbitTarget = new THREE.Vector3(0, rampH / 2, 0);

  return (
    <>
      <PhysicsLoop forceCalcRef={forceCalcRef} isPlayingRef={isPlayingRef} dispatch={dispatch} />

      <color attach="background" args={[sc.bg]} />
      <fog attach="fog" args={[sc.fogColor, sc.fogNear, sc.fogFar]} />
      <ambientLight intensity={sc.ambientIntensity} color={sc.ambientColor} />
      <directionalLight position={[5, 10, 5]} intensity={sc.dirIntensity} color={sc.dirColor} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[ballX, ballY + 0.5, 1]} intensity={0.6} color="#818cf8" distance={4} />

      {sc.starsCount > 0 && <Stars radius={50} depth={30} count={sc.starsCount} factor={2} />}

      <InfiniteGround y={-0.02} baseColor={sc.groundBase} cellColor={sc.groundCell} sectionColor={sc.groundSection} />

      {/* Ramp Mesh */}
      <RampMesh angleRad={angleRad} length={rampLen} material={ramp.material} />

      {/* Photoelectric photocell sensor gates along the ramp */}
      {ramp.sensorDistances.map((dist, idx) => {
        const label = `S${idx + 1}`;
        const isTriggered = ramp.state.sensorTimes?.[idx] !== null && ramp.state.sensorTimes?.[idx] !== undefined;

        return (
          <SensorGate
            key={label}
            dist={dist}
            label={label}
            isTriggered={isTriggered}
            angleRad={angleRad}
            rampOriginX={rampOriginX}
            rampH={rampH}
            tangentX={tangentX}
            tangentY={tangentY}
            normalX={normalX}
            normalY={normalY}
            ballRadius={ballRadius}
          />
        );
      })}

      {/* Flat platform — starts at ramp base, extends right */}
      <PlatformMesh rampBaseX={rampW / 2} material={ramp.material} />

      <SlidingMass
        position={massPosition}
        velocity={ramp.state.velocity}
        color="#6366f1"
        radius={ballRadius}
      />

      {/* Force Arrows — only after simulation finishes */}
      {!ramp.isPlaying && ramp.state.time > 0 && (
        <>
          <ForceArrow origin={massPosition} direction={gravDir} magnitude={forceW} color="#ef4444" label="W" />
          <ForceArrow origin={massPosition} direction={normDir} magnitude={forceN} color="#22c55e" label="N" />
          {forceNet > 0.01 && (
            <ForceArrow origin={massPosition} direction={netDir} magnitude={forceNet} color="#f59e0b" label="Fnet" />
          )}
        </>
      )}

      {/* Info label — Billboard so it always faces the camera */}
      <Billboard position={[0, rampH + 0.6, 0]}>
        <Text fontSize={0.2} color="#94a3b8" anchorX="center">
          {`θ = ${ramp.angle}° | ${MATERIALS[ramp.material]?.name ?? ramp.material}`}
        </Text>
      </Billboard>

      <CinematicCameraController
        isPlaying={ramp.isPlaying}
        onRamp={onRamp}
        massPosition={massPosition}
        rampH={rampH}
        pos={pos}
        rampLen={rampLen}
      />
    </>
  );
}
