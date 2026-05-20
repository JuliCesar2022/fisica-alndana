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
      <group key={h} position={[-0.8, yPos, 0]}>
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
        points={[[-0.8, 0, 0], [-0.8, 10, 0]]}
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
        const opacity = (i + 1) / points.length * 0.45;
        const size = 0.01 + (i / points.length) * 0.025;
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
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial color={color} roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

// ─── Grid overlay on ground ────────────────────────────────────────
function GridOverlay() {
  return (
    <gridHelper args={[80, 80, '#1e293b', '#1e293b']} position={[0, 0.001, 0]} />
  );
}

// ─── Physics Ball (the main interactive element) ───────────────────
function PhysicsBall({
  xWorld,
  yWorld,
  zWorld,
  ballColor,
  trailColor,
  isPlaying,
  onDragStart,
  onDrag,
}: {
  xWorld: number;
  yWorld: number;
  zWorld: number;
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

  const ballRadius = 0.08;

  const squishVelocity = useRef(0);
  const currentSquish = useRef(0); // target scale.y = 1 - squish, scale.xz = 1 + squish * 0.5

  useEffect(() => {
    const handleImpact = (e: any) => {
      const vel = e.detail.velocity;
      // Squish amount proportional to velocity (clamped to max 0.45)
      const intensity = Math.min(0.42, vel * 0.0075);
      if (intensity > 0.04) {
        currentSquish.current = intensity;
        squishVelocity.current = -intensity * 4.5; // push downward for snap spring back
      }
    };
    window.addEventListener('evt_ball_impact', handleImpact);
    return () => window.removeEventListener('evt_ball_impact', handleImpact);
  }, []);

  // Sync position and animate squish wobble
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.03);
    
    // F = -k*x - c*v (Stiff bouncy organic spring wobble)
    const k = 150; // stiffness
    const c = 9;   // damping
    const force = -k * currentSquish.current - c * squishVelocity.current;
    squishVelocity.current += force * dt;
    currentSquish.current += squishVelocity.current * dt;

    if (meshRef.current) {
      const sy = Math.max(0.45, 1 - currentSquish.current);
      const sxz = 1 + (1 - sy) * 0.55;
      meshRef.current.scale.set(sxz, sy, sxz);

      // Shift center up so the bottom surface remains perfectly flat on the ground
      const currentRadiusY = ballRadius * sy;
      const targetCenterY = yWorld + currentRadiusY;

      if (!isDragging) {
        meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, xWorld, 0.25);
        meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, zWorld, 0.25);
        meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetCenterY, 0.25);
      } else {
        meshRef.current.position.x = 0;
        meshRef.current.position.z = 0;
        meshRef.current.position.y = targetCenterY;
      }

      if (isPlaying) {
        const pos = meshRef.current.position.clone();
        setTrail(prev => {
          const newTrail = [...prev, pos];
          return newTrail.slice(-24);
        });
      } else {
        setTrail([]);
      }
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
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersect);
    // Correct for the radius offset when converting coordinate to normalized height
    const newNorm = THREE.MathUtils.clamp((intersect.y - ballRadius) / 10, 0, 1);
    onDrag(newNorm);
  }, [isDragging, onDrag, raycaster, ballRadius]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    gl.domElement.style.cursor = 'auto';
  }, [gl]);

  return (
    <>
      <Trail points={trail} color={trailColor} />
      <mesh
        ref={meshRef}
        position={[xWorld, yWorld + ballRadius, zWorld]}
        castShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <sphereGeometry args={[ballRadius, 32, 32]} />
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

function CinematicDropCameraController({
  isPlaying,
  ballXWorld,
  ballYWorld,
  ballZWorld,
  initialYWorld,
}: {
  isPlaying: boolean;
  ballXWorld: number;
  ballYWorld: number;
  ballZWorld: number;
  initialYWorld: number;
}) {
  const controlsRef = useRef<any>(null);
  const isPlayingRef = useRef(isPlaying);
  const introProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3(-12, 16, 20));
  
  // Track alignment needs
  const needsAlign = useRef(true);
  const prevInitialY = useRef(initialYWorld);

  // If selected height changes, trigger alignment
  if (initialYWorld !== prevInitialY.current) {
    prevInitialY.current = initialYWorld;
    needsAlign.current = true;
  }

  // Camera shake state on ground collision
  const shakeIntensity = useRef(0);
  const shakeDecay = 4.5; // decays rapidly

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      introProgress.current = 1.0; // skip initial camera sweep if they click play
    } else {
      // Trigger automatic height alignment when transitioning back from playing to setup!
      needsAlign.current = true;
    }
  }, [isPlaying]);

  useEffect(() => {
    const handleImpact = (e: any) => {
      const vel = e.detail.velocity;
      // Shake intensity proportional to impact velocity
      shakeIntensity.current = Math.min(0.28, vel * 0.0055);
    };
    window.addEventListener('evt_ball_impact', handleImpact);
    return () => window.removeEventListener('evt_ball_impact', handleImpact);
  }, []);

  // Listen to mouse/scroll interactions to immediately release camera control to the user
  useEffect(() => {
    const handleUserInteraction = () => {
      needsAlign.current = false;
    };
    
    // Attach listeners to canvas to detect manual rotation or zooming
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', handleUserInteraction);
      canvas.addEventListener('wheel', handleUserInteraction);
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener('pointerdown', handleUserInteraction);
        canvas.removeEventListener('wheel', handleUserInteraction);
      }
    };
  }, []);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    
    // Decay camera shake over time
    if (shakeIntensity.current > 0.001) {
      shakeIntensity.current -= delta * shakeDecay;
    } else {
      shakeIntensity.current = 0;
    }

    if (isPlayingRef.current) {
      // 🎥 1. Dramatic Close-Up Follow Shot: Camera dives along the ball in 3D!
      const cameraGoal = new THREE.Vector3(ballXWorld + 1.8, ballYWorld + 0.35, ballZWorld + 4.0);
      const targetGoal = new THREE.Vector3(ballXWorld, ballYWorld, ballZWorld);

      // Apply screenshake offsets to simulate impact force
      if (shakeIntensity.current > 0) {
        const shakeX = (Math.random() - 0.5) * shakeIntensity.current;
        const shakeY = (Math.random() - 0.5) * shakeIntensity.current;
        const shakeZ = (Math.random() - 0.5) * shakeIntensity.current;
        cameraGoal.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
      }

      state.camera.position.lerp(cameraGoal, 0.09);
      controlsRef.current.target.lerp(targetGoal, 0.09);
      controlsRef.current.update();
    } else {
      // 🌐 2. Overview / Setup Mode: Frame beautifully or yield to OrbitControls
      const defaultTarget = new THREE.Vector3(0, 5, 0);
      
      if (introProgress.current < 1.0) {
        introProgress.current = Math.min(1.0, introProgress.current + delta * 0.55);
        const t = 1 - Math.pow(1 - introProgress.current, 3); // ease out
        
        const endPos = new THREE.Vector3(0, 5, 12);
        state.camera.position.lerpVectors(startPos.current, endPos, t);
        controlsRef.current.target.lerp(defaultTarget, t);
        controlsRef.current.update();
      } else if (needsAlign.current) {
        // Frame beautifully according to target altitude
        const frameHeight = Math.max(3.8, initialYWorld * 0.72);
        const cameraPosGoal = new THREE.Vector3(0, frameHeight, 11.5);
        const lookTargetGoal = new THREE.Vector3(0, frameHeight - 1.2, 0);

        state.camera.position.lerp(cameraPosGoal, 0.08);
        controlsRef.current.target.lerp(lookTargetGoal, 0.08);
        controlsRef.current.update();

        // Release control to OrbitControls once camera settles
        const distCam = state.camera.position.distanceTo(cameraPosGoal);
        const distTar = controlsRef.current.target.distanceTo(lookTargetGoal);
        if (distCam < 0.04 && distTar < 0.04) {
          needsAlign.current = false;
        }
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      minDistance={2}
      maxDistance={40}
      enablePan={true}
      makeDefault
    />
  );
}

// ─── Stylized Red and White Coastal Lighthouse ─────────────────────
function Lighthouse() {
  const beamRef = useRef<THREE.Group>(null);
  
  // Rotate lighthouse beacon beam
  useFrame((state) => {
    if (beamRef.current) {
      beamRef.current.rotation.y = state.clock.getElapsedTime() * 0.7;
    }
  });

  return (
    <group position={[-2.8, 0, -1.8]}>
      {/* 1. Stone Foundation Base */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.25, 0.4, 6]} />
        <meshStandardMaterial color="#475569" roughness={0.9} />
      </mesh>
      
      {/* 2. Alternating Red and White tapered segments */}
      {[
        { y: 0.9, h: 1.0, rBot: 0.85, rTop: 0.77, color: '#f8fafc' }, // White
        { y: 1.9, h: 1.0, rBot: 0.77, rTop: 0.69, color: '#ef4444' }, // Red
        { y: 2.9, h: 1.0, rBot: 0.69, rTop: 0.61, color: '#f8fafc' }, // White
        { y: 3.9, h: 1.0, rBot: 0.61, rTop: 0.53, color: '#ef4444' }, // Red
        { y: 4.9, h: 1.0, rBot: 0.53, rTop: 0.45, color: '#f8fafc' }, // White
        { y: 5.9, h: 1.0, rBot: 0.45, rTop: 0.37, color: '#ef4444' }, // Red
        { y: 6.9, h: 1.0, rBot: 0.37, rTop: 0.29, color: '#f8fafc' }, // White
        { y: 7.9, h: 1.0, rBot: 0.29, rTop: 0.21, color: '#ef4444' }, // Red
        { y: 8.9, h: 1.0, rBot: 0.21, rTop: 0.16, color: '#f8fafc' }, // White
      ].map((seg, idx) => (
        <mesh key={idx} position={[0, seg.y, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[seg.rTop, seg.rBot, seg.h, 16]} />
          <meshStandardMaterial color={seg.color} roughness={0.6} metalness={0.05} />
        </mesh>
      ))}

      {/* 3. Balcony Deck Floor & Delicate Railing */}
      <group position={[0, 9.4, 0]}>
        {/* Platform Deck */}
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.1, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
        </mesh>
        
        {/* Balcony Railings */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const angle = (i * Math.PI) / 4;
          const rx = Math.cos(angle) * 0.38;
          const rz = Math.sin(angle) * 0.38;
          return (
            <mesh key={i} position={[rx, 0.2, rz]} castShadow>
              <cylinderGeometry args={[0.008, 0.008, 0.3, 4]} />
              <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
            </mesh>
          );
        })}
        <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.38, 0.008, 8, 24]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
        </mesh>
      </group>

      {/* 4. Glass Lantern House & Spotlight Beacon */}
      <group position={[0, 9.75, 0]}>
        {/* Glass Cylinder Enclosure */}
        <mesh>
          <cylinderGeometry args={[0.22, 0.22, 0.6, 12, 1, true]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.2} roughness={0.05} metalness={0.9} />
        </mesh>
        
        {/* Beacon light sphere */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#fef08a" toneMapped={false} />
        </mesh>
        <pointLight intensity={2.2} color="#fef08a" distance={12} />

        {/* 5. Lighthouse Roof Cone */}
        <mesh position={[0, 0.45, 0]} castShadow>
          <coneGeometry args={[0.27, 0.3, 16]} />
          <meshStandardMaterial color="#ef4444" roughness={0.5} />
        </mesh>

        {/* 6. Dynamic Rotating Spotlight Searchlight beam */}
        <group ref={beamRef}>
          {/* Main searchlight cone */}
          <mesh position={[0, 0.05, 1.8]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.65, 3.5, 16, 1, true]} />
            <meshBasicMaterial color="#fef08a" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* Faint reverse beam */}
          <mesh position={[0, 0.05, -1.0]} rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.35, 2.0, 16, 1, true]} />
            <meshBasicMaterial color="#fef08a" transparent opacity={0.08} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ─── Impact Shockwave Ring on ground ──────────────────────────────
function ImpactRing() {
  const ringRef = useRef<THREE.Mesh>(null);
  const [active, setActive] = useState(false);
  const scale = useRef(0.1);
  const opacity = useRef(0.8);

  useEffect(() => {
    const handleImpact = (e: any) => {
      const vel = e.detail.velocity;
      if (vel > 2.0) {
        setActive(true);
        scale.current = 0.2;
        opacity.current = 0.85;
      }
    };
    window.addEventListener('evt_ball_impact', handleImpact);
    return () => window.removeEventListener('evt_ball_impact', handleImpact);
  }, []);

  useFrame((_, delta) => {
    if (!active || !ringRef.current) return;
    
    scale.current += delta * 3.8;
    opacity.current -= delta * 1.6;
    
    if (opacity.current <= 0) {
      setActive(false);
    } else {
      ringRef.current.scale.set(scale.current, scale.current, 1);
      if (ringRef.current.material) {
        (ringRef.current.material as any).opacity = opacity.current;
      }
    }
  });

  if (!active) return null;

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
      <ringGeometry args={[0.7, 0.82, 32]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ─── Main Scene (no Canvas, used INSIDE a Canvas) ─────────────────
export default function FreeFall3DScene() {
  const dispatch = useDispatch();
  const ff = useSelector((s: RootState) => s.freefall);

  const simTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  
  // 3D Physical state references (integrated in physical meters 0..500)
  const xRef = useRef(0);
  const yRef = useRef(ff.height);
  const zRef = useRef(0);
  
  const vxRef = useRef(0);
  const vyRef = useRef(0);
  const vzRef = useRef(0);
  
  const hasKickedRef = useRef(false);

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

  // Sync refs when not playing or height changes
  useEffect(() => {
    if (!ff.isPlaying) {
      yRef.current = ff.height;
      vyRef.current = 0;
      xRef.current = 0;
      zRef.current = 0;
      vxRef.current = 0;
      vzRef.current = 0;
      hasKickedRef.current = false;
      simTimeRef.current = 0;
    }
  }, [ff.isPlaying, ff.height]);

  // Physics loop via useFrame
  function PhysicsLoop() {
    useFrame((_, delta) => {
      if (!isPlayingRef.current) return;
      
      // Apply a 2.2x time-scaling factor to speed up the fall and bounce animations dynamically
      const dt = Math.min(delta, 0.03) * 2.2; 
      simTimeRef.current += dt;
      const t = simTimeRef.current;
      const g = ff.gravity;

      // Euler-Cromer physical integration step
      vyRef.current -= g * dt;
      yRef.current += vyRef.current * dt;
      
      xRef.current += vxRef.current * dt;
      zRef.current += vzRef.current * dt;

      // Handle bounce collision on the ground
      if (yRef.current <= 0) {
        yRef.current = 0;
        
        // Trigger impact custom event with incoming velocity
        window.dispatchEvent(new CustomEvent('evt_ball_impact', { detail: { velocity: Math.abs(vyRef.current) } }));

        // 💥 Realistic Horizontal Kick Deflection on first high-velocity impact
        if (!hasKickedRef.current && Math.abs(vyRef.current) > 3.0) {
          hasKickedRef.current = true;
          // Random 360-degree deflection angle
          const angle = Math.random() * Math.PI * 2;
          // Kick velocity proportional to the massive vertical impact speed
          const kickMagnitude = Math.abs(vyRef.current) * 0.18; // 18% of impact speed!
          vxRef.current = Math.cos(angle) * kickMagnitude;
          vzRef.current = Math.sin(angle) * kickMagnitude;
        }

        // Bounce! (0.65 coefficient of restitution for a perfect natural feel)
        vyRef.current = -vyRef.current * 0.65;

        // Apply friction drag on the horizontal speeds on bounce impact
        vxRef.current *= 0.85;
        vzRef.current *= 0.85;

        // If bounce velocity is very low, settle the vertical motion
        if (Math.abs(vyRef.current) < 1.0) {
          vyRef.current = 0;
        }
      }

      // 🌀 Rolling on ground friction/drag decelerates horizontal speeds
      if (yRef.current === 0 && vyRef.current === 0) {
        const rollingFriction = 1.6; // friction coefficient
        vxRef.current -= vxRef.current * rollingFriction * dt;
        vzRef.current -= vzRef.current * rollingFriction * dt;

        // Once the ball slows to a complete crawl, settle it fully
        if (Math.abs(vxRef.current) < 0.05 && Math.abs(vzRef.current) < 0.05) {
          vxRef.current = 0;
          vzRef.current = 0;
          dispatch(setPlaying(false));
        }
      }

      // Calculate total 3D speed magnitude for reporting
      const currentSpeed = Math.sqrt(
        vxRef.current * vxRef.current +
        vyRef.current * vyRef.current +
        vzRef.current * vzRef.current
      );

      const pe = ff.mass * g * yRef.current;
      const ke = 0.5 * ff.mass * (currentSpeed * currentSpeed);

      dispatch(updatePhysicsData({
        time: t, 
        y: yRef.current, 
        velocity: currentSpeed,
        potentialEnergy: pe, 
        kineticEnergy: ke, 
        totalEnergy: pe + ke
      }));
    });
    return null;
  }

  const handleDragStart = useCallback(() => {
    dispatch(setPlaying(false));
    simTimeRef.current = 0;
    vyRef.current = 0;
    vxRef.current = 0;
    vzRef.current = 0;
    xRef.current = 0;
    zRef.current = 0;
    hasKickedRef.current = false;
  }, [dispatch]);

  const handleDrag = useCallback((newNorm: number) => {
    const newH = Math.round(newNorm * maxH);
    const clamped = Math.max(10, Math.min(500, newH));
    yRef.current = clamped;
    vyRef.current = 0;
    vxRef.current = 0;
    vzRef.current = 0;
    xRef.current = 0;
    zRef.current = 0;
    hasKickedRef.current = false;
    dispatch({ type: 'freefall/setHeight', payload: clamped });
    dispatch(updatePhysicsData({
      time: 0, 
      y: clamped, 
      velocity: 0,
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
        shadow-bias={-0.0006}
      />

      {/* Stars (only moon) */}
      {planet === 'moon' && <Stars radius={40} depth={30} count={4000} factor={3} />}
      {planet === 'jupiter' && <Stars radius={60} depth={20} count={1000} factor={2} />}

      {/* Environment */}
      <color attach="background" args={[cfg.sky]} />
      <Ground color={cfg.ground} />
      <GridOverlay />

      {/* Stylized coastal lighthouse on the side */}
      <Lighthouse />

      {/* Ground collision shockwave ring */}
      <ImpactRing />

      {/* Ruler */}
      <Ruler maxH={maxH} />

      {/* Ball */}
      <PhysicsBall
        xWorld={xRef.current * (10 / maxH)}
        yWorld={yRef.current * (10 / maxH)}
        zWorld={zRef.current * (10 / maxH)}
        ballColor={ballColors[planet]}
        trailColor={trailColors[planet]}
        isPlaying={ff.isPlaying}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
      />

      {/* Dynamic Cinematic Camera Controller */}
      <CinematicDropCameraController
        isPlaying={ff.isPlaying}
        ballXWorld={xRef.current * (10 / maxH)}
        ballYWorld={yRef.current * (10 / maxH)}
        ballZWorld={zRef.current * (10 / maxH)}
        initialYWorld={(ff.height / maxH) * 10}
      />
    </>
  );
}
