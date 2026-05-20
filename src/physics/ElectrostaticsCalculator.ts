export interface PointCharge {
  id: string;
  charge: number; // µC
  x: number;      // pixels
  y: number;      // pixels
  z: number;      // pixels
  isStatic: boolean;
}

export interface ForceVector {
  fx: number;
  fy: number;
  fz: number;
  magnitude: number;
}

export class ElectrostaticsCalculator {
  // Coulomb's constant k
  // For simulation visual purposes, we use an arbitrary k to make it look good on screen
  // since real k (9e9) with pixel distances and µC charges causes extreme values.
  public k = 500; 

  // Scale: 100 pixels = 1 meter
  public readonly pixelsPerMeter = 100;

  calculateNetForce(target: PointCharge, allCharges: PointCharge[]): ForceVector {
    let fx = 0;
    let fy = 0;
    let fz = 0;

    for (const other of allCharges) {
      if (target.id === other.id) continue;

      const dx = target.x - other.x;
      const dy = target.y - other.y;
      const dz = target.z - other.z;
      
      const distanceSq = dx * dx + dy * dy + dz * dz;
      const distancePx = Math.sqrt(distanceSq);
      
      // Prevent division by zero and extreme forces when too close
      const safeDistancePx = Math.max(distancePx, 20); 
      const distanceM = safeDistancePx / this.pixelsPerMeter;

      const q1 = target.charge;
      const q2 = other.charge;

      // F = k * (q1 * q2) / r^2
      // Positive F means repulsion (force points AWAY from other)
      // Negative F means attraction (force points TOWARDS other)
      // Since dx = target.x - other.x, the vector points FROM other TO target (repulsion direction)
      const forceMag = (this.k * q1 * q2) / (distanceM * distanceM);
      
      // Normalize direction vector
      const nx = dx / safeDistancePx;
      const ny = dy / safeDistancePx;
      const nz = dz / safeDistancePx;

      fx += forceMag * nx;
      fy += forceMag * ny;
      fz += forceMag * nz;
    }

    return {
      fx,
      fy,
      fz,
      magnitude: Math.sqrt(fx * fx + fy * fy + fz * fz)
    };
  }
}
