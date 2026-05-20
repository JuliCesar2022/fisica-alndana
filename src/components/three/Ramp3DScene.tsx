import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, Text, Line, OrbitControls, Billboard } from '@react-three/drei';
import { useSelector, useDispatch } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../../store/store';
import { updatePhysicsData, setPlaying } from '../../store/rampSlice';
import { ForceCalculator } from '../../physics/ForceCalculator';
import { MATERIALS } from '../../utils/constants';
import { EVENT_RESET_RAMP } from '../panels/MiroLeftPanel';

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

// ─── Ramp Geometry ─────────────────────────────────────────────────
function RampMesh({ angleRad, length, material }: { angleRad: number; length: number; material: string }) {
  const color = MAT_COLORS[material] ?? '#c2956a';
  const h = Math.sin(angleRad) * length;
  const w = Math.cos(angleRad) * length;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, 0);
  shape.lineTo(0, h);
  shape.lineTo(0, 0);

  const extrudeSettings = { depth: 0.6, bevelEnabled: false };

  return (
    <group position={[-w / 2, 0, -0.3]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
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

// ─── Flat Platform ──────────────────────────────────────────────────
function PlatformMesh({ rampW, length, material }: { rampW: number; length: number; material: string }) {
  const color = MAT_COLORS[material] ?? '#c2956a';
  
  return (
    <group position={[rampW / 2 + length / 2, -0.05, 0]}>
      <mesh castShadow receiveShadow>
        {/* We use an extrude or box to draw the flat platform */}
        <boxGeometry args={[length, 0.1, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* platform border highlight */}
      <Line
        points={[
          [-length / 2, 0.05, 0.3],
          [length / 2, 0.05, 0.3]
        ]}
        color="#ffffff"
        lineWidth={1.5}
      />
    </group>
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

  const angleRad = (ramp.angle * Math.PI) / 180;
  const rampLen = ramp.rampLength;
  const isPlayingRef = useRef(false);

  // Ball radius scales dynamically with the ramp length (from 0.5m to 5.0m)
  // At rampLen = 0.55m, radius is ~0.05m (looks beautifully proportional!)
  // At rampLen = 2.0m, radius is ~0.14m
  // At rampLen = 5.0m, radius is 0.18m
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

      <color attach="background" args={['#0a0e17']} />
      <fog attach="fog" args={['#0a0e17', 20, 60]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} color="#fffbe6" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[ballX, ballY + 0.5, 1]} intensity={0.6} color="#818cf8" distance={4} />

      <Stars radius={50} depth={30} count={2000} factor={2} />
      
      {/* Ground and grid shifted down slightly to prevent Z-fighting (parpadeo/flicker) with the ramp & platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      <gridHelper args={[30, 30, '#1e293b', '#1e293b']} position={[0, -0.018, 0]} />

      {/* Ramp Mesh */}
      <RampMesh angleRad={angleRad} length={rampLen} material={ramp.material} />

      {/* Photoelectric photocell sensor gates along the ramp */}
      {ramp.sensorDistances.map((dist, idx) => {
        const label = `S${idx + 1}`;
        const isTriggered = [
          ramp.state.s1Time !== null,
          ramp.state.s2Time !== null,
          ramp.state.s3Time !== null,
          ramp.state.s4Time !== null
        ][idx];

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

      {/* Flat Platform Floor - 15 meters long for the ball to roll on */}
      <PlatformMesh rampW={rampW} length={15} material={ramp.material} />

      <SlidingMass
        position={massPosition}
        velocity={ramp.state.velocity}
        color="#6366f1"
        radius={ballRadius}
      />

      {/* Force Arrows */}
      <ForceArrow origin={massPosition} direction={gravDir} magnitude={forceW} color="#ef4444" label="W" />
      <ForceArrow origin={massPosition} direction={normDir} magnitude={forceN} color="#22c55e" label="N" />
      {forceNet > 0.01 && (
        <ForceArrow origin={massPosition} direction={netDir} magnitude={forceNet} color="#f59e0b" label="Fnet" />
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
