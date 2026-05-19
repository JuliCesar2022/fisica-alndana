import Phaser from 'phaser';

export class VectorRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(50);
  }

  clear() {
    this.graphics.clear();
    this.labels.forEach(l => l.destroy());
    this.labels = [];
  }

  drawArrow(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: number,
    thickness: number = 3,
    label?: string,
    labelColor?: string
  ) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 2) return;

    const angle = Math.atan2(dy, dx);
    const headLength = Math.min(12, length * 0.3);
    const headAngle = Math.PI / 6;

    // Draw line
    this.graphics.lineStyle(thickness, color, 0.9);
    this.graphics.beginPath();
    this.graphics.moveTo(fromX, fromY);
    this.graphics.lineTo(toX, toY);
    this.graphics.strokePath();

    // Draw arrowhead
    this.graphics.fillStyle(color, 0.9);
    this.graphics.beginPath();
    this.graphics.moveTo(toX, toY);
    this.graphics.lineTo(
      toX - headLength * Math.cos(angle - headAngle),
      toY - headLength * Math.sin(angle - headAngle)
    );
    this.graphics.lineTo(
      toX - headLength * Math.cos(angle + headAngle),
      toY - headLength * Math.sin(angle + headAngle)
    );
    this.graphics.closePath();
    this.graphics.fillPath();

    // Draw label
    if (label) {
      const midX = (fromX + toX) / 2;
      const midY = (fromY + toY) / 2;
      // Offset label perpendicular to arrow
      const perpX = -Math.sin(angle) * 16;
      const perpY = Math.cos(angle) * 16;

      const text = this.scene.add.text(midX + perpX, midY + perpY, label, {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        fontStyle: 'bold',
        color: labelColor || '#' + color.toString(16).padStart(6, '0'),
        stroke: '#000000',
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 0, blur: 6, color: '#000', fill: true, stroke: true }
      });
      text.setOrigin(0.5, 0.5);
      text.setDepth(51);
      this.labels.push(text);
    }
  }

  drawForceVectors(
    cx: number,
    cy: number,
    angleRad: number,
    weight: number,
    normalForce: number,
    parallelForce: number,
    frictionForce: number,
    netForce: number,
    scaleFactor: number = 1.5
  ) {
    this.clear();

    const maxForce = Math.max(weight, 1);
    const scale = (60 / maxForce) * scaleFactor;

    // Gravity (straight down)
    const gLen = weight * scale;
    this.drawArrow(cx, cy, cx, cy + gLen, 0xef4444, 3, `Fg=${weight.toFixed(1)}N`, '#ef4444');

    // Normal force (perpendicular to ramp surface, pointing away)
    const nAngle = -Math.PI / 2 + angleRad; // perpendicular to ramp
    const nLen = normalForce * scale;
    this.drawArrow(
      cx, cy,
      cx + nLen * Math.cos(nAngle - Math.PI / 2),
      cy + nLen * Math.sin(nAngle - Math.PI / 2),
      0x3b82f6, 3, `N=${normalForce.toFixed(1)}N`, '#3b82f6'
    );

    // Parallel component (along the ramp, downhill)
    const pLen = parallelForce * scale;
    const rampDirX = Math.cos(-angleRad + Math.PI);
    const rampDirY = Math.sin(-angleRad + Math.PI);
    // Downhill direction along ramp
    const downhillX = Math.cos(0); // going right/down
    const downhillY = -Math.sin(0);
    this.drawArrow(
      cx, cy,
      cx + pLen * Math.cos(-angleRad),
      cy - pLen * Math.sin(-angleRad),
      0xf59e0b, 3, `F‖=${parallelForce.toFixed(1)}N`, '#f59e0b'
    );

    // Friction (along ramp, opposing motion = uphill)
    if (frictionForce > 0.01) {
      const fLen = frictionForce * scale;
      this.drawArrow(
        cx, cy,
        cx - fLen * Math.cos(-angleRad),
        cy + fLen * Math.sin(-angleRad),
        0x10b981, 3, `Ff=${frictionForce.toFixed(1)}N`, '#10b981'
      );
    }
  }

  destroy() {
    this.clear();
    this.graphics.destroy();
  }
}
