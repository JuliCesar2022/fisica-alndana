// Physics constants and material presets

export interface MaterialPreset {
  name: string;
  icon: string;
  lucideIcon: string;
  frictionStatic: number;
  frictionKinetic: number;
  color: number;
  colorHex: string;
  restitution: number;
}

export const MATERIALS: Record<string, MaterialPreset> = {
  ice: {
    name: 'Hielo',
    icon: '❄',
    lucideIcon: 'snowflake',
    frictionStatic: 0.03,
    frictionKinetic: 0.01,
    color: 0x67e8f9,
    colorHex: '#67e8f9',
    restitution: 0.1,
  },
  wood: {
    name: 'Madera',
    icon: '▦',
    lucideIcon: 'tree-pine',
    frictionStatic: 0.40,
    frictionKinetic: 0.30,
    color: 0xc2956a,
    colorHex: '#c2956a',
    restitution: 0.3,
  },
  rubber: {
    name: 'Caucho',
    icon: '●',
    lucideIcon: 'circle',
    frictionStatic: 0.80,
    frictionKinetic: 0.70,
    color: 0x4b5563,
    colorHex: '#4b5563',
    restitution: 0.8,
  },
  steel: {
    name: 'Acero',
    icon: '◆',
    lucideIcon: 'hexagon',
    frictionStatic: 0.15,
    frictionKinetic: 0.10,
    color: 0x9ca3af,
    colorHex: '#9ca3af',
    restitution: 0.5,
  },
  sandpaper: {
    name: 'Lija N150',
    icon: '▤',
    lucideIcon: 'scroll',
    frictionStatic: 0.08,
    frictionKinetic: 0.02,
    color: 0xf59e0b,
    colorHex: '#f59e0b',
    restitution: 0.1,
  },
};

export const COLORS = {
  gravity: 0xef4444,
  normal: 0x3b82f6,
  friction: 0x10b981,
  parallel: 0xf59e0b,
  net: 0xec4899,
  ball: 0xe2e8f0, // Aluminum-like bright color
  ballGlow: 0xcbd5e1,
  ramp: 0x475569,
  ground: 0x1e293b,
  gridLine: 0x1e293b,
  gridLineBright: 0x334155,
  background: 0x0a0e17,
};

export const PHYSICS_DEFAULTS = {
  angle: 35,        // degrees (from Guion.pdf)
  mass: 1.2,        // kg
  radius: 0.1,      // m
  gravity: 9.8,     // m/s² (from Guion.pdf)
  material: 'sandpaper',
  rampLength: 0.45, // m (45 cm from Guion.pdf)
  sensorDistances: [0.1, 0.2, 0.3, 0.4],
};

// Scale factor: pixels per meter
export const SCALE = 80;

// Canvas grid settings
export const GRID = {
  spacing: 40,      // pixels between grid lines
  majorEvery: 4,    // every N lines is a major line
};
