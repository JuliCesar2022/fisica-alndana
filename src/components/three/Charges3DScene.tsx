import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars, Text, OrbitControls } from '@react-three/drei';
import { useSelector, useDispatch } from 'react-redux';
import * as THREE from 'three';
import { RootState } from '../../store/store';
import {
  syncChargesFromEngine,
  updateNetForce,
  setSelectedCharge,
  PointChargeState,
} from '../../store/electroSlice';
import { ElectrostaticsCalculator } from '../../physics/ElectrostaticsCalculator';

const K_COULOMB = 8.99e9;

// ─── Force Field Arrows ────────────────────────────────────────────
function FieldArrows({ charges }: { charges: PointChargeState[] }) {
  const arrows: React.ReactElement[] = [];
  const gridSize = 5;
  const step = 1.5;
  for (let xi = -gridSize; xi <= gridSize; xi += 1) {
    for (let yi = -gridSize; yi <= gridSize; yi += 1) {
      const px = xi * step;
      const py = yi * step;
      let fx = 0, fy = 0;
      for (const ch of charges) {
        const dx = px - ch.x / 80;
        const dy = py - ch.y / 80;
        const r2 = dx * dx + dy * dy;
        if (r2 < 0.5) continue;
        const F = K_COULOMB * Math.abs(ch.charge * 1e-6) / r2;
        const sign = ch.charge > 0 ? 1 : -1;
        fx += sign * (dx / Math.sqrt(r2)) * F;
        fy += sign * (dy / Math.sqrt(r2)) * F;
      }
      const mag = Math.sqrt(fx * fx + fy * fy);
      if (mag < 1e5) continue;
      const len = Math.min(0.6, mag * 3e-7);
      const ex = px + (fx / mag) * len;
      const ey = py + (fy / mag) * len;
      const color = mag > 1e8 ? '#f87171' : '#818cf8';
      arrows.push(
        <line key={`${xi}-${yi}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([px, 0.05, py, ex, 0.05, ey]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} transparent opacity={0.35} />
        </line>
      );
    }
  }
  return <>{arrows}</>;
}

// ─── Single Charge Sphere ─────────────────────────────────────────
function ChargeSphere({
  charge,
  isSelected,
  onSelect,
  onDragEnd,
}: {
  charge: PointChargeState;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, newX: number, newY: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { raycaster } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5));

  const isPos = charge.charge > 0;
  const color = isPos ? '#ef4444' : '#3b82f6';
  const glow = isPos ? '#ff6666' : '#6699ff';

  // Convert from px-space to 3D
  const wx = charge.x / 80;
  const wz = charge.y / 80;
  const pos = new THREE.Vector3(wx, 0.5, wz);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect(charge.id);
    if (!charge.isStatic) setIsDragging(true);
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging) return;
    const intersect = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersect);
    if (meshRef.current) meshRef.current.position.set(intersect.x, 0.5, intersect.z);
  };

  const handlePointerUp = (e: any) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (meshRef.current) {
      onDragEnd(charge.id, meshRef.current.position.x * 80, meshRef.current.position.z * 80);
    }
  };

  return (
    <group>
      {/* Glow sphere */}
      <mesh position={pos} scale={[1.4, 1.4, 1.4]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={glow} transparent opacity={0.12} />
      </mesh>
      {/* Core */}
      <mesh
        ref={meshRef}
        position={pos}
        castShadow
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.1}
          metalness={0.4}
          emissive={color}
          emissiveIntensity={isSelected ? 0.6 : 0.2}
        />
      </mesh>
      {/* Label */}
      <Text position={[pos.x, pos.y + 0.5, pos.z]} fontSize={0.25} color="#f8fafc" anchorX="center">
        {`${charge.charge > 0 ? '+' : ''}${charge.charge} μC`}
      </Text>
    </group>
  );
}

// ─── Force Lines between charges ──────────────────────────────────
function ForceLines({ charges }: { charges: PointChargeState[] }) {
  const lines: React.ReactElement[] = [];
  for (let i = 0; i < charges.length; i++) {
    for (let j = i + 1; j < charges.length; j++) {
      const a = charges[i], b = charges[j];
      const attract = a.charge * b.charge < 0;
      const color = attract ? '#22c55e' : '#ef4444';
      lines.push(
        <line key={`${a.id}-${b.id}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([
                a.x / 80, 0.5, a.y / 80,
                b.x / 80, 0.5, b.y / 80,
              ]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} transparent opacity={0.4} />
        </line>
      );
    }
  }
  return <>{lines}</>;
}

// ─── Physics loop ─────────────────────────────────────────────────
function ElectroPhysicsLoop({
  charges,
  isPlaying,
  onUpdate,
}: {
  charges: PointChargeState[];
  isPlaying: boolean;
  onUpdate: (newCharges: PointChargeState[]) => void;
}) {
  const dispatch = useDispatch();
  const selectedChargeId = useSelector((s: RootState) => s.electrostatics.selectedChargeId);
  const calculatorRef = useRef(new ElectrostaticsCalculator());
  const posRef = useRef(charges.map(c => ({ ...c })));
  const velRef = useRef(charges.map(() => ({ vx: 0, vy: 0 })));

  useEffect(() => {
    posRef.current = charges.map(c => ({ ...c }));
    velRef.current = charges.map(() => ({ vx: 0, vy: 0 }));
  }, [charges.length]);

  useFrame((_, delta) => {
    // 1. If playing, step the physics simulation
    if (isPlaying) {
      const dt = Math.min(delta, 0.02);
      
      // Copy current state to mutate positions and velocities safely during collision resolution
      let states = posRef.current.map((c, i) => ({
        ...c,
        vx: velRef.current[i].vx,
        vy: velRef.current[i].vy,
        index: i
      }));

      // A. Calculate forces and update velocities/positions
      states = states.map((c) => {
        if (c.isStatic) return c;

        let fx = 0;
        let fy = 0;

        for (const other of posRef.current) {
          if (c.id === other.id) continue;

          const dx = c.x - other.x;
          const dy = c.y - other.y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq);

          // If they are in physical contact (dist < 49px), the physical contact normal force completely
          // balances/cancels the electrostatic attraction. We skip calculation to prevent runaway forces.
          if (dist < 49) continue;

          // Prevent force singularity by capping min distance in calculations
          const safeDist = Math.max(dist, 50);
          const distM = safeDist / 100; // pixels to meters scale

          // Coulomb's Law: F = k * q1 * q2 / r^2
          const forceMag = (500 * c.charge * other.charge) / (distM * distM);

          const nx = dx / safeDist;
          const ny = dy / safeDist;

          fx += forceMag * nx;
          fy += forceMag * ny;
        }

        // Mass proxy from charge magnitude
        const mass = Math.max(0.15, Math.abs(c.charge) * 0.25);
        const forceScale = 0.85;
        const ax = (fx * forceScale) / mass;
        const ay = (fy * forceScale) / mass;

        const drag = 0.94; // Air resistance
        let vx = (c.vx + ax * dt) * drag;
        let vy = (c.vy + ay * dt) * drag;

        // Cap maximum velocity to completely eliminate tunneling at ultra-high accelerations
        const maxVel = 260; 
        const velMag = Math.sqrt(vx * vx + vy * vy);
        if (velMag > maxVel) {
          vx = (vx / velMag) * maxVel;
          vy = (vy / velMag) * maxVel;
        }

        const newX = c.x + vx * dt * 45;
        const newY = c.y + vy * dt * 45;

        return { ...c, vx, vy, x: newX, y: newY };
      });

      // B. Resolve solid sphere collisions (3D sphere radius is 0.3 units, which maps to 24px, diameter = 48px)
      const diameter = 48;
      for (let pass = 0; pass < 3; pass++) { // 3 passes for absolute multi-body stability
        for (let i = 0; i < states.length; i++) {
          for (let j = i + 1; j < states.length; j++) {
            const c1 = states[i];
            const c2 = states[j];

            const dx = c1.x - c2.x;
            const dy = c1.y - c2.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            if (dist < diameter && dist > 0.01) {
              const overlap = diameter - dist;
              const nx = dx / dist;
              const ny = dy / dist;

              // 1. Instantly push them apart (static/pinned bodies do not move)
              if (c1.isStatic && !c2.isStatic) {
                c2.x -= nx * overlap;
                c2.y -= ny * overlap;
              } else if (!c1.isStatic && c2.isStatic) {
                c1.x += nx * overlap;
                c1.y += ny * overlap;
              } else if (!c1.isStatic && !c2.isStatic) {
                c1.x += nx * overlap * 0.5;
                c1.y += ny * overlap * 0.5;
                c2.x -= nx * overlap * 0.5;
                c2.y -= ny * overlap * 0.5;
              }

              // 2. Elastic bounce velocity reflection along the collision normal
              const rvx = c1.vx - c2.vx;
              const rvy = c1.vy - c2.vy;
              const velAlongNormal = rvx * nx + rvy * ny;

              if (velAlongNormal < 0) {
                const restitution = 0.25; // damped elastic bounce so they rest beautifully
                const impulse = -(1 + restitution) * velAlongNormal;

                if (c1.isStatic && !c2.isStatic) {
                  c2.vx -= impulse * nx;
                  c2.vy -= impulse * ny;
                } else if (!c1.isStatic && c2.isStatic) {
                  c1.vx += impulse * nx;
                  c1.vy += impulse * ny;
                } else if (!c1.isStatic && !c2.isStatic) {
                  c1.vx += impulse * nx * 0.5;
                  c1.vy += impulse * ny * 0.5;
                  c2.vx -= impulse * nx * 0.5;
                  c2.vy -= impulse * ny * 0.5;
                }
              }
            }
          }
        }
      }

      // C. Apply boundary limits & update velocity refs
      states = states.map((c) => {
        let newX = Math.max(-280, Math.min(280, c.x));
        let newY = Math.max(-280, Math.min(280, c.y));
        let vx = c.vx;
        let vy = c.vy;

        if (newX === -280 || newX === 280) vx = 0;
        if (newY === -280 || newY === 280) vy = 0;

        return { ...c, x: newX, y: newY, vx, vy };
      });

      // D. Propagate back to velRef and Redux state
      states.forEach((c) => {
        velRef.current[c.index] = { vx: c.vx, vy: c.vy };
      });

      const updated = states.map(({ index, vx, vy, ...rest }) => rest);
      posRef.current = updated;
      onUpdate(updated);
    }

    // 2. Always compute and dispatch the netForce of the selected charge for the formula panel in real-time
    if (selectedChargeId) {
      const selC = charges.find(ch => ch.id === selectedChargeId);
      if (selC) {
        const targetCharge = { id: selC.id, charge: selC.charge, x: selC.x, y: selC.y, isStatic: selC.isStatic };
        const allChargesList = charges.map(ch => ({ id: ch.id, charge: ch.charge, x: ch.x, y: ch.y, isStatic: ch.isStatic }));
        const netForce = calculatorRef.current.calculateNetForce(targetCharge, allChargesList);
        dispatch(updateNetForce(netForce.magnitude));
      }
    } else {
      dispatch(updateNetForce(null));
    }
  });

  return null;
}

// ─── Main Charges 3D Scene ─────────────────────────────────────────
export default function Charges3DScene() {
  const dispatch = useDispatch();
  const electro = useSelector((s: RootState) => s.electrostatics);

  const handleUpdate = useCallback((newCharges: PointChargeState[]) => {
    dispatch(syncChargesFromEngine(newCharges));
  }, [dispatch]);

  const handleSelect = useCallback((id: string) => {
    dispatch(setSelectedCharge(id));
  }, [dispatch]);

  const handleDragEnd = useCallback((id: string, newX: number, newY: number) => {
    const updated = electro.charges.map(c => c.id === id ? { ...c, x: newX, y: newY } : c);
    dispatch(syncChargesFromEngine(updated));
  }, [dispatch, electro.charges]);

  return (
    <>
      <color attach="background" args={['#030712']} />
      <fog attach="fog" args={['#030712', 20, 60]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 10, 0]} intensity={0.8} color="#818cf8" />
      <Stars radius={50} depth={30} count={3000} factor={3} />

      <ElectroPhysicsLoop
        charges={electro.charges}
        isPlaying={electro.isPlaying}
        onUpdate={handleUpdate}
      />

      {/* Field visualization */}
      <FieldArrows charges={electro.charges} />

      {/* Force lines */}
      <ForceLines charges={electro.charges} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#050a14" roughness={1} />
      </mesh>
      <gridHelper args={[40, 40, '#1e293b', '#0f172a']} position={[0, 0.001, 0]} />

      {/* Charges */}
      {electro.charges.map(ch => (
        <ChargeSphere
          key={ch.id}
          charge={ch}
          isSelected={ch.id === electro.selectedChargeId}
          onSelect={handleSelect}
          onDragEnd={handleDragEnd}
        />
      ))}

      <OrbitControls target={[0, 0.5, 0]} minDistance={3} maxDistance={30} makeDefault />
    </>
  );
}
