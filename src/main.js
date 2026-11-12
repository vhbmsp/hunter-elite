import './style.css';
import { Game } from './core/Game.js';

const game = new Game(document.body);
if (import.meta.env.DEV) window.game = game;

game.start();
game.load().catch((error) => {
  console.error(error);
  game.hud.setError('Failed to load models. See the console for details.');
});
