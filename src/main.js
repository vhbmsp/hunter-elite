import './style.css';
import { Game } from './core/Game.js';

const game = new Game(document.body);
game.start();

if (import.meta.env.DEV) window.game = game;
