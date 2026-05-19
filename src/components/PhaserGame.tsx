import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { gameConfig } from '../config';

// Make game instance available globally so React can interface with it easily
export let phaserGameInstance: Phaser.Game | null = null;

export default function PhaserGame() {
  const gameRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!gameRef.current) return;

    if (!phaserGameInstance) {
      // Phaser doesn't like being initialized multiple times in strict mode, so check if it exists
      const config = {
        ...gameConfig,
        parent: gameRef.current,
      };
      
      phaserGameInstance = new Phaser.Game(config);

      window.addEventListener('resize', () => {
        phaserGameInstance?.scale.resize(window.innerWidth, window.innerHeight);
      });
    }

    return () => {
      // In a full production app, we might destroy the game on unmount,
      // but for this SPA, keeping it alive is fine.
    };
  }, []);

  // Sync React Router changes to Phaser Scene Manager
  useEffect(() => {
    if (!phaserGameInstance || !phaserGameInstance.scene) return;
    
    // Wait for BootScene to be ready or just use a small delay if Phaser just started
    setTimeout(() => {
      const sceneMap: Record<string, string> = {
        '/': 'MenuScene',
        '/ramp': 'InclinedPlaneScene',
        '/electrostatics': 'ElectrostaticsScene',
        '/circuit': 'CircuitScene'
      };

      const targetScene = sceneMap[location.pathname] || 'MenuScene';
      
      const activeScenes = phaserGameInstance!.scene.getScenes(true);
      const isAlreadyActive = activeScenes.some(s => s.scene.key === targetScene);

      if (!isAlreadyActive) {
        activeScenes.forEach(scene => scene.scene.stop());
        phaserGameInstance!.scene.start(targetScene);
      }
    }, 100);
    
  }, [location.pathname]);

  return <div id="game-container" ref={gameRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} />;
}
