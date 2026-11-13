/**
 * Maps raw DOM events to game actions.
 * actions: {
 *   lock, shoot, reload, scope(active), toggleHitboxes, menu,
 *   quit, quitYes, quitNo, standIndex(code), switchStand(index), isLocked()
 * }
 */
export function bindInput(actions, target = document) {
  const listeners = {
    click: () => actions.lock(),
    mousedown: (e) => {
      if (!actions.isLocked()) return;
      if (e.button === 0) actions.shoot();
      if (e.button === 2) actions.scope(true);
    },
    mouseup: (e) => {
      if (e.button === 2) actions.scope(false);
    },
    keydown: (e) => {
      // Typing a high-score name: ignore game hotkeys while an input is focused.
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'KeyY' && !e.repeat) {
        actions.quitYes?.();
        return;
      }
      if (e.code === 'KeyN' && !e.repeat) {
        actions.quitNo?.();
        return;
      }
      if (e.code === 'KeyQ' && !e.repeat) {
        e.preventDefault();
        actions.quit?.();
        return;
      }

      const standIndex = actions.standIndex(e.code);
      if (standIndex >= 0) {
        e.preventDefault();
        if (!e.repeat) actions.switchStand(standIndex);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (actions.isLocked() && !e.repeat) actions.shoot();
      }
      if (e.code === 'KeyR' && !e.repeat && actions.isLocked()) actions.reload();
      if (e.code === 'KeyT' && !e.repeat) actions.toggleHitboxes();
      if (e.code === 'KeyM' && !e.repeat) actions.menu?.();
    },
    contextmenu: (e) => e.preventDefault(),
  };

  for (const [type, fn] of Object.entries(listeners)) target.addEventListener(type, fn);
  return () => {
    for (const [type, fn] of Object.entries(listeners)) target.removeEventListener(type, fn);
  };
}
