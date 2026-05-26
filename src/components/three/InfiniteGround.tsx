import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';

interface InfiniteGroundProps {
  y?: number;
  baseColor?: string;
  cellColor?: string;
  sectionColor?: string;
  fadeDistance?: number;
}

export default function InfiniteGround({
  y = 0,
  baseColor = '#0a0e17',
  cellColor = '#1e293b',
  sectionColor = '#2d3f52',
  fadeDistance = 120,
}: InfiniteGroundProps) {
  const planeRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (planeRef.current) {
      planeRef.current.position.x = camera.position.x;
      planeRef.current.position.z = camera.position.z;
    }
  });

  return (
    <>
      {/* Base plane — polygonOffset pushes it back in depth buffer to prevent z-fighting with the Grid */}
      <mesh
        ref={planeRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, y, 0]}
        receiveShadow
      >
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.95}
          metalness={0.0}
          polygonOffset
          polygonOffsetFactor={4}
          polygonOffsetUnits={4}
        />
      </mesh>

      {/* Infinite grid overlay */}
      <Grid
        position={[0, y, 0]}
        args={[10, 10]}
        cellSize={1}
        cellThickness={0.45}
        cellColor={cellColor}
        sectionSize={5}
        sectionThickness={1.0}
        sectionColor={sectionColor}
        fadeDistance={fadeDistance}
        fadeStrength={1.8}
        infiniteGrid
      />
    </>
  );
}
