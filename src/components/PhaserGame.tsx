import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Phaser from 'phaser';
import { gameConfig } from '../config';

// Make game instance available globally so React can interface with it easily
export let phaserGameInstance: Phaser.Game | null = null;

// Only /circuit uses Phaser — all other routes use React Three Fiber
const PHASER_ROUTES = ['/circuit'];

export default function PhaserGame() {
  const gameRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isPhaser = PHASER_ROUTES.includes(location.pathname);

  useEffect(() => {
    if (!gameRef.current) return;
    if (!phaserGameInstance) {
      const config = {
        ...gameConfig,
        parent: gameRef.current,
      };
      phaserGameInstance = new Phaser.Game(config);
      window.addEventListener('resize', () => {
        phaserGameInstance?.scale.resize(window.innerWidth, window.innerHeight);
      });
    }
  }, []);

  // Sync React Router changes to Phaser Scene Manager
  useEffect(() => {
    if (!phaserGameInstance || !phaserGameInstance.scene) return;

    setTimeout(() => {
      const sceneMap: Record<string, string> = {
        '/circuit': 'CircuitScene',
      };

      const targetScene = sceneMap[location.pathname];

      if (!targetScene) {
        // Not a Phaser route — stop all Phaser scenes cleanly
        const activeScenes = phaserGameInstance!.scene.getScenes(true);
        activeScenes.forEach(s => s.scene.stop());
        return;
      }

      const activeScenes = phaserGameInstance!.scene.getScenes(true);
      const isAlreadyActive = activeScenes.some(s => s.scene.key === targetScene);
      if (!isAlreadyActive) {
        activeScenes.forEach(s => s.scene.stop());
        phaserGameInstance!.scene.start(targetScene);
      }
    }, 100);
  }, [location.pathname]);

  return (
    <div
      id="game-container"
      ref={gameRef}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0,
        // Keep DOM node alive but invisible when not in use — avoids Phaser re-initialisation
        display: isPhaser ? 'block' : 'none',
        pointerEvents: isPhaser ? 'auto' : 'none',
      }}
    />
  );
}
