# Hunter Elite

Fully web-based 3D hunter game built with Three.js and Vite.

## Quick start

Requires Node.js 18+.

```bash
npm install
npm run dev      # dev server with hot reload at http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production bundle locally
```

Opening `index.html` directly from disk no longer works; use the dev server or a build.

## Controls

- Click: lock the pointer (mouse look)
- RMB (hold): scope zoom
- LMB or Space: shoot
- T: toggle hitbox debug
- Esc: release the pointer

## Assets

Sprite PNGs are loaded from `public/imagine_images/` (file names are listed in
`src/config.js`). Any missing image falls back to a procedurally drawn
placeholder silhouette, so the game is playable without them.

## Project layout

```
src/
  main.js              entry point
  config.js            all tuning constants (FOVs, spawn counts, scoring, asset paths)
  core/                Game composition root, renderer, scene + lights, input bindings, frame loop
  player/              camera + PointerLockControls, scope zoom
  weapons/             rifle (firing, scoring) and hitscan ballistics
  entities/            animals (AI state machine), hitboxes, animal manager
  world/               terrain, scattered environment billboards, texture cache
  audio/               procedural WebAudio sound effects
  ui/                  HUD DOM bindings
```

Systems added to `GameLoop` receive `update(delta)` each frame with delta time in seconds.
