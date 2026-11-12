/**
 * Maps raw DOM events to game actions.
 * actions: { lock, shoot, reload, scope(active), toggleHitboxes, menu, isLocked() }
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
