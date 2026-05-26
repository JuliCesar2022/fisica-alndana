import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useLocation } from 'react-router-dom';

// Lazy-load each 3D scene to keep bundles small
const FreeFall3DScene = React.lazy(() => import('./three/FreeFall3DScene'));
const Ramp3DScene = React.lazy(() => import('./three/Ramp3DScene'));
const Charges3DScene = React.lazy(() => import('./three/Charges3DScene'));
const Collisions3DScene = React.lazy(() => import('./three/Collisions3DScene'));
const Pendulum3DScene = React.lazy(() => import('./three/Pendulum3DScene'));

// Scenes that use the R3F Canvas
const THREE_ROUTES = ['/freefall', '/ramp', '/electrostatics', '/collision', '/pendulum'];

function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial color="#6366f1" wireframe />
    </mesh>
  );
}

class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function Canvas3D() {
  const location = useLocation();
  const path = location.pathname;

  // Only render the Canvas on 3D-capable routes
  if (!THREE_ROUTES.includes(path)) return null;

  const getScene = () => {
    switch (path) {
      case '/freefall':     return <FreeFall3DScene />;
      case '/ramp':         return <Ramp3DScene />;
      case '/electrostatics': return <Charges3DScene />;
      case '/collision':    return <Collisions3DScene />;
      case '/pendulum':     return <Pendulum3DScene />;
      default:              return null;
    }
  };

  return (
    <CanvasErrorBoundary>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
      }}>
        <Canvas
          shadows
          camera={{ position: [0, 5, 15], fov: 55, near: 0.1, far: 1000 }}
          gl={{ antialias: true, alpha: false }}
          style={{ width: '100%', height: '100%' }}
        >
          <Suspense fallback={<LoadingFallback />}>
            {getScene()}
          </Suspense>
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  );
}
