export interface EnergySnapshot {
  time: number;
  kinetic: number;
  potential: number;
  total: number;
  velocity: number;
  height: number;
  acceleration: number;
}

export class EnergyTracker {
  private history: EnergySnapshot[] = [];
  private maxHistory: number = 500;

  reset() {
    this.history = [];
  }

  record(snapshot: EnergySnapshot) {
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getHistory(): EnergySnapshot[] {
    return this.history;
  }

  getLatest(): EnergySnapshot | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  getTimes(): number[] {
    return this.history.map(s => parseFloat(s.time.toFixed(2)));
  }

  getKineticEnergies(): number[] {
    return this.history.map(s => parseFloat(s.kinetic.toFixed(2)));
  }

  getPotentialEnergies(): number[] {
    return this.history.map(s => parseFloat(s.potential.toFixed(2)));
  }

  getTotalEnergies(): number[] {
    return this.history.map(s => parseFloat(s.total.toFixed(2)));
  }

  getVelocities(): number[] {
    return this.history.map(s => parseFloat(s.velocity.toFixed(2)));
  }
}
