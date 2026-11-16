// Keyboard, mouse and touch input, read once per frame. The paddle follows the pointer
// when one is used; arrow keys / A D steer it otherwise. Space or a click launches a
// served ball and confirms on the title and end screens.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

function logicalX(canvas, clientX) {
  const rect = canvas.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * 1280;
}

/** @returns { pointerX, move, actions } polled each frame; actions are consumed on read. */
export function createInput(canvas) {
  const keys = new Set();
  let pointerX = null;
  let pointerUsed = false;
  let actions = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RESTART;
    }
    if (event.code.startsWith('Arrow')) event.preventDefault();
  }
  function onKeyUp(event) { keys.delete(event.code); }
  function onPointerMove(event) {
    pointerX = logicalX(canvas, event.clientX);
    pointerUsed = true;
  }
  function onPointerDown(event) {
    pointerX = logicalX(canvas, event.clientX);
    pointerUsed = true;
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    /** -1, 0 or 1 from the keys held this frame; 0 when the pointer is steering. */
    move() {
      if (pointerUsed && pointerX !== null) return 0;
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The pointer's logical x, or null when the pointer has not been used. */
    pointerX() { return pointerUsed ? pointerX : null; },
    /** Any key press (used to wake the title screen) clears pointer steering. */
    noteKeySteering() { pointerUsed = false; },
    /** Actions queued since the last read; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
