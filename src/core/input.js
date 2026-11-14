/**
 * Maps raw DOM events to game actions.
 * actions: {
 *   lock, shoot, reload, scope(active), scopeZoom(delta), toggleHitboxes,
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
    wheel: (e) => {
      if (!actions.isLocked()) return;
      // Scroll up = zoom in. Prevent page scroll while pointer-locked.
      e.preventDefault();
      actions.scopeZoom?.(Math.sign(-e.deltaY));
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
      // Clear magnification steps while scoped (same ladder as the mouse wheel).
      if ((e.code === 'Equal' || e.code === 'NumpadAdd') && !e.repeat && actions.isLocked()) {
        actions.scopeZoom?.(1);
      }
      if ((e.code === 'Minus' || e.code === 'NumpadSubtract') && !e.repeat && actions.isLocked()) {
        actions.scopeZoom?.(-1);
      }
    },
    contextmenu: (e) => e.preventDefault(),
  };

  for (const [type, fn] of Object.entries(listeners)) {
    // Wheel needs passive:false so preventDefault can block page scroll.
    const opts = type === 'wheel' ? { passive: false } : undefined;
    target.addEventListener(type, fn, opts);
  }
  return () => {
    for (const [type, fn] of Object.entries(listeners)) {
      const opts = type === 'wheel' ? { passive: false } : undefined;
      target.removeEventListener(type, fn, opts);
    }
  };
}
