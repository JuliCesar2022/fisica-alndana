import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Stars, Text, OrbitControls, TransformControls } from '@react-three/drei';
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
        const dz = py - ch.z / 80; // Field arrows operate on the XZ plane
        const dy = 0.05 - ch.y / 80;
        const r2 = dx * dx + dy * dy + dz * dz;
        if (r2 < 0.5) continue;
        const F = K_COULOMB * Math.abs(ch.charge * 1e-6) / r2;
        const sign = ch.charge > 0 ? 1 : -1;
        fx += sign * (dx / Math.sqrt(r2)) * F;
        fy += sign * (dz / Math.sqrt(r2)) * F;
      }
      const mag = Math.sqrt(fx * fx + fy * fy);
      if (mag < 1e5) continue;
      const len = Math.min(0.6, mag * 3e-7);
      const ex = px + (fx / mag) * len;
      const ez = py + (fy / mag) * len;
      const color = mag > 1e8 ? '#f87171' : '#818cf8';
      arrows.push(
        <line key={`${xi}-${yi}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([px, 0.05, py, ex, 0.05, ez]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} transparent opacity={0.35} />
        </line>
      );
    }
  }
  return <>{arrows}</>;
}

// Global variable to prevent deselection when clicking the TransformControls gizmo
let cancelDeselect = false;

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
  onDragEnd: (id: string, newX: number, newY: number, newZ: number) => void;
}) {
  const meshRef = useRef<THREE.Group>(null);

  const isPos = charge.charge > 0;
  const color = isPos ? '#ef4444' : '#3b82f6';
  const glow = isPos ? '#ff6666' : '#6699ff';

  // Convert from px-space to 3D
  const pos = new THREE.Vector3(charge.x / 80, charge.y / 80, charge.z / 80);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    onSelect(charge.id);
  };

  const handleDrag = (e: any) => {
    if (meshRef.current) {
      onDragEnd(charge.id, meshRef.current.position.x * 80, meshRef.current.position.y * 80, meshRef.current.position.z * 80);
    }
  };

  return (
    <>
      {isSelected && (
        <TransformControls 
          object={meshRef} 
          mode="translate" 
          onMouseDown={() => { cancelDeselect = true; }}
          onObjectChange={handleDrag}
          onMouseUp={handleDrag}
        />
      )}
      <group ref={meshRef} position={pos} onPointerDown={handlePointerDown}>
        {/* Glow sphere */}
        <mesh scale={[1.4, 1.4, 1.4]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color={glow} transparent opacity={0.12} />
        </mesh>
        {/* Core */}
        <mesh castShadow>
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
        <Text position={[0, 0.5, 0]} fontSize={0.25} color="#f8fafc" anchorX="center">
          {`${charge.charge > 0 ? '+' : ''}${charge.charge} μC`}
        </Text>
      </group>
    </>
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
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const distPx = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const distM = distPx / 100; // 100 pixels = 1 meter

      const midX = (a.x + b.x) / 2 / 80;
      const midY = (a.y + b.y) / 2 / 80;
      const midZ = (a.z + b.z) / 2 / 80;

      lines.push(
        <group key={`${a.id}-${b.id}`}>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([
                  a.x / 80, a.y / 80, a.z / 80,
                  b.x / 80, b.y / 80, b.z / 80,
                ]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={color} transparent opacity={0.4} />
          </line>
          <Text 
            position={[midX, midY + 0.15, midZ]} 
            fontSize={0.16} 
            color="#94a3b8" 
            anchorX="center" 
            anchorY="bottom"
            outlineWidth={0.02}
            outlineColor="#0f172a"
          >
            {`${distM.toFixed(2)} m`}
          </Text>
        </group>
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
  const velRef = useRef(charges.map(() => ({ vx: 0, vy: 0, vz: 0 })));

  useEffect(() => {
    if (!isPlaying) {
      posRef.current = charges.map(c => ({ ...c }));
      velRef.current = charges.map(() => ({ vx: 0, vy: 0, vz: 0 }));
    } else {
      // If playing but length changed (e.g. added/deleted mid-play), we must re-sync
      if (posRef.current.length !== charges.length) {
        posRef.current = charges.map(c => ({ ...c }));
        velRef.current = charges.map(() => ({ vx: 0, vy: 0, vz: 0 }));
      } else if (selectedChargeId) {
        // Sync position of the selected charge being dragged
        const sc = charges.find(c => c.id === selectedChargeId);
        if (sc) {
          const index = posRef.current.findIndex(c => c.id === selectedChargeId);
          if (index !== -1) {
            posRef.current[index].x = sc.x;
            posRef.current[index].y = sc.y;
            posRef.current[index].z = sc.z;
            velRef.current[index] = { vx: 0, vy: 0, vz: 0 }; // kill momentum while dragging
          }
        }
      }
    }
  }, [charges, isPlaying, selectedChargeId]);

  useFrame((_, delta) => {
    // 1. If playing, step the physics simulation
    if (isPlaying) {
      const dt = Math.min(delta, 0.02);
      
      // Copy current state to mutate positions and velocities safely during collision resolution
      let states = posRef.current.map((c, i) => ({
        ...c,
        vx: velRef.current[i].vx,
        vy: velRef.current[i].vy,
        vz: velRef.current[i].vz,
        index: i
      }));

      // A. Calculate forces and update velocities/positions
      states = states.map((c) => {
        if (c.isStatic) return c;

        let fx = 0;
        let fy = 0;
        let fz = 0;

        for (const other of posRef.current) {
          if (c.id === other.id) continue;

          const dx = c.x - other.x;
          const dy = c.y - other.y;
          const dz = c.z - other.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          const dist = Math.sqrt(distSq);

          // Prevent force singularity by capping min distance in calculations to the physical sphere diameter (48px)
          const safeDist = Math.max(dist, 48);
          const distM = safeDist / 100; // pixels to meters scale

          // Coulomb's Law: F = k * q1 * q2 / r^2
          const forceMag = (500 * c.charge * other.charge) / (distM * distM);

          const nx = dx / safeDist;
          const ny = dy / safeDist;
          const nz = dz / safeDist;

          fx += forceMag * nx;
          fy += forceMag * ny;
          fz += forceMag * nz;
        }

        // Mass proxy from charge magnitude
        const mass = Math.max(0.15, Math.abs(c.charge) * 0.25);
        const forceScale = 0.85;
        const ax = (fx * forceScale) / mass;
        const ay = (fy * forceScale) / mass;
        const az = (fz * forceScale) / mass;

        const drag = 0.94; // Air resistance
        let vx = (c.vx + ax * dt) * drag;
        let vy = (c.vy + ay * dt) * drag;
        let vz = (c.vz + az * dt) * drag;

        // Cap maximum velocity to completely eliminate tunneling at ultra-high accelerations
        const maxVel = 260; 
        const velMag = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (velMag > maxVel) {
          vx = (vx / velMag) * maxVel;
          vy = (vy / velMag) * maxVel;
          vz = (vz / velMag) * maxVel;
        }

        const newX = c.x + vx * dt * 45;
        const newY = c.y + vy * dt * 45;
        const newZ = c.z + vz * dt * 45;

        return { ...c, vx, vy, vz, x: newX, y: newY, z: newZ };
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
            const dz = c1.z - c2.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            const dist = Math.sqrt(distSq);

            if (dist < diameter && dist > 0.01) {
              const overlap = diameter - dist;
              const nx = dx / dist;
              const ny = dy / dist;
              const nz = dz / dist;

              // 1. Instantly push them apart (static/pinned bodies do not move)
              if (c1.isStatic && !c2.isStatic) {
                c2.x -= nx * overlap;
                c2.y -= ny * overlap;
                c2.z -= nz * overlap;
              } else if (!c1.isStatic && c2.isStatic) {
                c1.x += nx * overlap;
                c1.y += ny * overlap;
                c1.z += nz * overlap;
              } else if (!c1.isStatic && !c2.isStatic) {
                c1.x += nx * overlap * 0.5;
                c1.y += ny * overlap * 0.5;
                c1.z += nz * overlap * 0.5;
                c2.x -= nx * overlap * 0.5;
                c2.y -= ny * overlap * 0.5;
                c2.z -= nz * overlap * 0.5;
              }

              // 2. Collision velocity resolution
              const rvx = c1.vx - c2.vx;
              const rvy = c1.vy - c2.vy;
              const rvz = c1.vz - c2.vz;
              const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

              if (velAlongNormal < 0) {
                const attract = c1.charge * c2.charge < 0;
                const restitution = attract ? 0.0 : 0.25; // Perfectly inelastic stickiness for attracting charges
                const impulse = -(1 + restitution) * velAlongNormal;

                if (c1.isStatic && !c2.isStatic) {
                  c2.vx -= impulse * nx;
                  c2.vy -= impulse * ny;
                  c2.vz -= impulse * nz;
                  if (attract) { c2.vx = 0; c2.vy = 0; c2.vz = 0; }
                } else if (!c1.isStatic && c2.isStatic) {
                  c1.vx += impulse * nx;
                  c1.vy += impulse * ny;
                  c1.vz += impulse * nz;
                  if (attract) { c1.vx = 0; c1.vy = 0; c1.vz = 0; }
                } else if (!c1.isStatic && !c2.isStatic) {
                  c1.vx += impulse * nx * 0.5;
                  c1.vy += impulse * ny * 0.5;
                  c1.vz += impulse * nz * 0.5;
                  c2.vx -= impulse * nx * 0.5;
                  c2.vy -= impulse * ny * 0.5;
                  c2.vz -= impulse * nz * 0.5;
                  if (attract) {
                    c1.vx = 0; c1.vy = 0; c1.vz = 0;
                    c2.vx = 0; c2.vy = 0; c2.vz = 0;
                  }
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
        let newZ = Math.max(-280, Math.min(280, c.z));
        let vx = c.vx;
        let vy = c.vy;
        let vz = c.vz;

        if (newX === -280 || newX === 280) vx = 0;
        if (newY === -280 || newY === 280) vy = 0;
        if (newZ === -280 || newZ === 280) vz = 0;

        return { ...c, x: newX, y: newY, z: newZ, vx, vy, vz };
      });

      // D. Propagate back to velRef and Redux state
      states.forEach((c) => {
        velRef.current[c.index] = { vx: c.vx, vy: c.vy, vz: c.vz };
      });

      const updated = states.map(({ index, vx, vy, vz, ...rest }) => rest);
      posRef.current = updated;
      onUpdate(updated);
    }

    // 2. Always compute and dispatch the netForce of the selected charge for the formula panel in real-time
    if (selectedChargeId) {
      const selC = charges.find(ch => ch.id === selectedChargeId);
      if (selC) {
        const targetCharge = { id: selC.id, charge: selC.charge, x: selC.x, y: selC.y, z: selC.z, isStatic: selC.isStatic };
        const allChargesList = charges.map(ch => ({ id: ch.id, charge: ch.charge, x: ch.x, y: ch.y, z: ch.z, isStatic: ch.isStatic }));
        const netForce = calculatorRef.current.calculateNetForce(targetCharge, allChargesList);
        dispatch(updateNetForce(netForce.magnitude));
      }
    } else {
      dispatch(updateNetForce(null));
    }
  });

  return null;
}

function CinematicIntroController() {
  const controlsRef = useRef<any>(null);
  const progressRef = useRef(0);
  const startPos = useRef(new THREE.Vector3(-15, 12, 22));
  const endPos = useRef(new THREE.Vector3(0, 5, 15));

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    if (progressRef.current < 1) {
      progressRef.current = Math.min(1.0, progressRef.current + delta * 0.55); // 1.8 second sweep
      // Smooth cubic ease out
      const t = 1 - Math.pow(1 - progressRef.current, 3);
      
      state.camera.position.lerpVectors(startPos.current, endPos.current, t);
      controlsRef.current.target.lerp(new THREE.Vector3(0, 0.5, 0), t);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      target={[0, 0.5, 0]}
      minDistance={3}
      maxDistance={30}
      makeDefault
    />
  );
}

// ─── Main Charges 3D Scene ─────────────────────────────────────────
export default function Charges3DScene() {
  const dispatch = useDispatch();
  const electro = useSelector((s: RootState) => s.electrostatics);

  const handleUpdate = useCallback((newCharges: PointChargeState[]) => {
    dispatch(syncChargesFromEngine(newCharges));
  }, [dispatch]);

  const handleSelect = useCallback((id: string | null) => {
    dispatch(setSelectedCharge(id));
  }, [dispatch]);

  const handleDragEnd = useCallback((id: string, newX: number, newY: number, newZ: number) => {
    const updated = electro.charges.map(c => c.id === id ? { ...c, x: newX, y: newY, z: newZ } : c);
    dispatch(syncChargesFromEngine(updated));
  }, [dispatch, electro.charges]);

  return (
    <group>
      {/* Invisible click-catcher for the background */}
      <mesh scale={500} onPointerDown={(e) => {
        e.stopPropagation();
        cancelDeselect = false;
        setTimeout(() => {
          if (!cancelDeselect) handleSelect(null);
        }, 50);
      }}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
      </mesh>

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

      <CinematicIntroController />
    </group>
  );
}
