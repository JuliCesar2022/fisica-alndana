import Phaser from 'phaser';
import { COLORS } from '../utils/constants';

interface MenuCard {
  key: string;
  lucideIcon: string;
  title: string;
  description: string;
  color: number;
  sceneKey: string;
  available: boolean;
}

export class MenuScene extends Phaser.Scene {
  private cards: MenuCard[] = [
    {
      key: 'ramp',
      lucideIcon: 'triangle',
      title: 'Plano Inclinado',
      description: 'Rampa con fricción, fuerzas y energía',
      color: 0x6366f1,
      sceneKey: 'InclinedPlaneScene',
      available: true,
    },
    {
      key: 'electrostatics',
      lucideIcon: 'zap',
      title: 'Cargas Eléctricas',
      description: 'Ley de Coulomb, campo eléctrico y fuerzas',
      color: 0xec4899,
      sceneKey: 'ElectrostaticsScene',
      available: true,
    },
    {
      key: 'circuit',
      lucideIcon: 'zap',
      title: 'Circuitos Eléctricos',
      description: 'Ley de Ohm, rapidez de corriente y electrones',
      color: 0x10b981,
      sceneKey: 'CircuitScene',
      available: true,
    },
    {
      key: 'freefall',
      lucideIcon: 'chevrons-down',
      title: 'Caída Libre',
      description: 'Gravedad, velocidad terminal, resistencia',
      color: 0x06b6d4,
      sceneKey: 'FreeFallScene',
      available: false,
    },
    {
      key: 'collision',
      lucideIcon: 'swords',
      title: 'Colisiones',
      description: 'Momentum, choques elásticos e inelásticos',
      color: 0xf59e0b,
      sceneKey: 'CollisionScene',
      available: false,
    },
    {
      key: 'pendulum',
      lucideIcon: 'activity',
      title: 'Péndulo',
      description: 'Oscilación, período, energía',
      color: 0xec4899,
      sceneKey: 'PendulumScene',
      available: false,
    },
  ];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Draw grid
    this.drawGrid(width, height);

    const titleY = height * 0.15;

    // Title & Logo centered as a single flex layout
    this.add.dom(width / 2, titleY).createFromHTML(`
      <div style="display: flex; align-items: center; justify-content: center; gap: 14px; pointer-events: none; user-select: none;">
        <i data-lucide="atom" style="color: #6366f1; width: 40px; height: 40px;" stroke-width="2"></i>
        <h1 style="font-family: 'Inter', sans-serif; font-size: 38px; font-weight: 700; color: #f1f5f9; margin: 0; white-space: nowrap; letter-spacing: -0.5px;">Laboratorio de Física - Miguel Aldana</h1>
      </div>
    `);

    this.add.text(width / 2, titleY + 45, 'Aprendizaje Basado en Proyectos', {
      fontFamily: "'Inter', sans-serif",
      fontSize: '16px',
      color: '#64748b',
    }).setOrigin(0.5);

    // Cards
    const cardWidth = 200;
    const cardHeight = 160;
    const gap = 24;
    const totalWidth = this.cards.length * cardWidth + (this.cards.length - 1) * gap;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height * 0.5;

    this.cards.forEach((card, i) => {
      const x = startX + i * (cardWidth + gap);
      this.createCard(x, cardY, cardWidth, cardHeight, card, i);
    });

    // Footer
    this.add.text(width / 2, height - 40, 'Selecciona un experimento para comenzar', {
      fontFamily: "'Inter', sans-serif",
      fontSize: '13px',
      color: '#475569',
    }).setOrigin(0.5);

    // Hide simulation panels
    document.getElementById('control-panel')?.classList.add('hidden');
    document.getElementById('formula-panel')?.classList.add('hidden');
    document.getElementById('data-panel')?.classList.add('hidden');

    // Render Lucide icons in dynamically injected HTML
    if (typeof (window as any).lucide !== 'undefined') {
      (window as any).lucide.createIcons();
    }
    
    // Make sure menu button is highlighted
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById('btn-menu')?.classList.add('active');
  }

  private drawGrid(width: number, height: number) {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x111827, 0.5);

    for (let x = 0; x < width; x += 40) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 40) {
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
    }
    graphics.strokePath();
  }

  private createCard(
    x: number, y: number,
    w: number, h: number,
    card: MenuCard,
    index: number
  ) {
    // Card background
    const bg = this.add.graphics();
    const alpha = card.available ? 0.12 : 0.05;
    bg.fillStyle(card.color, alpha);
    bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
    bg.lineStyle(1, card.color, card.available ? 0.3 : 0.1);
    bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);

    // Icon
    const iconColor = card.available ? '#f1f5f9' : '#475569';
    this.add.dom(x, y - 32).createFromHTML(`
      <div style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; pointer-events: none;">
        <i data-lucide="${card.lucideIcon}" style="color: ${iconColor}; width: 36px; height: 36px;" stroke-width="2"></i>
      </div>
    `);

    // Title
    this.add.text(x, y + 10, card.title, {
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      fontStyle: 'bold',
      color: card.available ? '#f1f5f9' : '#475569',
    }).setOrigin(0.5);

    // Description
    this.add.text(x, y + 35, card.description, {
      fontFamily: "'Inter', sans-serif",
      fontSize: '10px',
      color: '#64748b',
      align: 'center',
      wordWrap: { width: w - 20 },
    }).setOrigin(0.5);

    // "Próximamente" badge for unavailable
    if (!card.available) {
      this.add.dom(x, y + 60).createFromHTML(`
        <div style="font-family: 'Inter', sans-serif; font-size: 10px; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 4px;">
          <i data-lucide="lock" style="width: 10px; height: 10px;" stroke-width="2"></i> Próximamente
        </div>
      `);
    }

    // Interactive zone
    if (card.available) {
      const hitArea = this.add.rectangle(x, y, w, h)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.001);

      hitArea.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(card.color, 0.2);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
        bg.lineStyle(2, card.color, 0.5);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      });

      hitArea.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(card.color, alpha);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
        bg.lineStyle(1, card.color, 0.3);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      });

      hitArea.on('pointerdown', () => {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.time.delayedCall(300, () => {
          window.location.hash = card.key;
          this.scene.start(card.sceneKey);
        });
      });
    }
  }

  // Removed setupNavButtons to prevent duplicate event listeners with main.ts
}
