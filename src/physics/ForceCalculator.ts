import { MATERIALS } from '../utils/constants';

export interface ForceData {
  weight: number;         // mg
  normalForce: number;    // mg cos θ
  parallelForce: number;  // mg sin θ
  frictionForce: number;  // μ N
  netForce: number;       // F_parallel - F_friction
  acceleration: number;   // a = g(sinθ - μcosθ)
}

export interface SimState {
  position: number;       // distance along ramp (m)
  velocity: number;       // m/s
  height: number;         // m above ground
  time: number;           // seconds
  kineticEnergy: number;  // J
  potentialEnergy: number;// J
  totalEnergy: number;    // J
  onRamp: boolean;
  onGround: boolean;
  finished: boolean;
  sensorTimes: (number | null)[];
}

export class ForceCalculator {
  private mass: number;
  private angleDeg: number;
  private angleRad: number;
  private gravity: number;
  private materialKey: string;
  private frictionCoeff: number;
  private rampLength: number;
  private sensorDistances: number[];

  // Simulation state
  private simPosition: number = 0;
  private simVelocity: number = 0;
  private simTime: number = 0;
  private simOnRamp: boolean = true;
  private simFinished: boolean = false;

  // Ground simulation
  private groundX: number = 0;
  private groundVelocity: number = 0;

  // Sensor timers
  private sensorTimes: (number | null)[] = [];

  constructor(
    mass: number = 2,
    angleDeg: number = 30,
    gravity: number = 9.81,
    materialKey: string = 'wood',
    rampLength: number = 5,
    customFriction: number = 0.25,
    sensorDistances: number[] = [0.1, 0.2, 0.3, 0.4]
  ) {
    this.mass = mass;
    this.angleDeg = angleDeg;
    this.angleRad = (angleDeg * Math.PI) / 180;
    this.gravity = gravity;
    this.materialKey = materialKey;
    this.frictionCoeff = materialKey === 'custom' ? customFriction : (MATERIALS[materialKey]?.frictionKinetic ?? 0.3);
    this.rampLength = rampLength;
    this.sensorDistances = [...sensorDistances]; // copy — never hold frozen Redux ref
    this.sensorTimes = new Array(sensorDistances.length).fill(null);
  }

  updateParams(mass: number, angleDeg: number, gravity: number, materialKey: string, rampLength: number, customFriction: number = 0.25, sensorDistances: number[] = [0.1, 0.2, 0.3, 0.4]) {
    this.mass = mass;
    this.angleDeg = angleDeg;
    this.angleRad = (angleDeg * Math.PI) / 180;
    this.gravity = gravity;
    this.materialKey = materialKey;
    this.frictionCoeff = materialKey === 'custom' ? customFriction : (MATERIALS[materialKey]?.frictionKinetic ?? 0.3);
    this.rampLength = rampLength;
    this.sensorDistances = [...sensorDistances]; // copy — never hold frozen Redux ref
    
    // Resize sensor times array if needed, preserving existing times
    if (this.sensorTimes.length !== sensorDistances.length) {
      const oldTimes = this.sensorTimes;
      this.sensorTimes = new Array(sensorDistances.length).fill(null);
      for (let i = 0; i < Math.min(oldTimes.length, this.sensorTimes.length); i++) {
        this.sensorTimes[i] = oldTimes[i];
      }
    }
  }

  getForces(): ForceData {
    const weight = this.mass * this.gravity;
    const normalForce = weight * Math.cos(this.angleRad);
    const parallelForce = weight * Math.sin(this.angleRad);
    const frictionForce = this.frictionCoeff * normalForce;
    const netForce = Math.max(0, parallelForce - frictionForce);
    const accel = netForce / this.mass;

    return {
      weight,
      normalForce,
      parallelForce,
      frictionForce,
      netForce,
      acceleration: accel,
    };
  }

  reset() {
    this.simPosition = 0;
    this.simVelocity = 0;
    this.simTime = 0;
    this.simOnRamp = true;
    this.simFinished = false;
    this.groundX = 0;
    this.groundVelocity = 0;
    this.sensorTimes = new Array(this.sensorDistances.length).fill(null);
  }

  step(dt: number): SimState {
    if (this.simFinished) {
      return this.getState();
    }

    this.simTime += dt;

    if (this.simOnRamp) {
      const forces = this.getForces();
      // Update velocity
      this.simVelocity += forces.acceleration * dt;
      // Update position along ramp
      this.simPosition += this.simVelocity * dt;

      // Track sensors dynamically
      for (let i = 0; i < this.sensorDistances.length; i++) {
        if (this.sensorTimes[i] === null && this.simPosition >= this.sensorDistances[i]) {
          this.sensorTimes[i] = this.simTime;
        }
      }

      // Check if ball reached end of ramp
      if (this.simPosition >= this.rampLength) {
        this.simPosition = this.rampLength;
        this.simOnRamp = false;
        this.groundVelocity = this.simVelocity * Math.cos(this.angleRad);
        this.groundX = 0;
      }
    } else {
      // On ground — friction decelerates
      const groundFriction = this.frictionCoeff * this.mass * this.gravity;
      const groundDecel = groundFriction / this.mass;

      if (this.groundVelocity > 0.01) {
        this.groundVelocity -= groundDecel * dt;
        if (this.groundVelocity < 0) this.groundVelocity = 0;
        this.groundX += this.groundVelocity * dt;
      } else {
        this.groundVelocity = 0;
        this.simFinished = true;
      }
    }

    return this.getState();
  }

  getState(): SimState {
    let height: number;
    let velocity: number;

    if (this.simOnRamp) {
      // Height decreases as ball goes down ramp
      const distFromTop = this.simPosition;
      height = (this.rampLength - distFromTop) * Math.sin(this.angleRad);
      velocity = this.simVelocity;
    } else {
      height = 0;
      velocity = this.groundVelocity;
    }

    const kineticEnergy = 0.5 * this.mass * velocity * velocity;
    const potentialEnergy = this.mass * this.gravity * height;
    const totalEnergy = kineticEnergy + potentialEnergy;

    return {
      position: this.simOnRamp ? this.simPosition : this.groundX,
      velocity,
      height,
      time: this.simTime,
      kineticEnergy,
      potentialEnergy,
      totalEnergy,
      onRamp: this.simOnRamp,
      onGround: !this.simOnRamp,
      finished: this.simFinished,
      sensorTimes: [...this.sensorTimes],
    };
  }

  // Getters
  getMass() { return this.mass; }
  getAngleDeg() { return this.angleDeg; }
  getAngleRad() { return this.angleRad; }
  getGravity() { return this.gravity; }
  getMaterialKey() { return this.materialKey; }
  getFrictionCoeff() { return this.frictionCoeff; }
  getRampLength() { return this.rampLength; }
  getSimVelocity() { return this.simOnRamp ? this.simVelocity : this.groundVelocity; }
  getSimPosition() { return this.simPosition; }
  isOnRamp() { return this.simOnRamp; }
  isFinished() { return this.simFinished; }
  getGroundX() { return this.groundX; }
}
