// Everything drawn, and nothing else: the renderer paints a world state onto the canvas
// and never changes it. The playfield is 1280x720 logical pixels, scaled to fit the window
// with letterboxing. Screens: title, play, paused, level-clear banner, game over, win.
import { BALL, BRICK, FIELD, FONT, PADDLE, PALETTE } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

const POWER_STYLE = {
  wide: { color: PALETTE.powerWide, label: 'W' },
  multi: { color: PALETTE.powerMulti, label: 'M' },
  slow: { color: PALETTE.powerSlow, label: 'S' },
  life: { color: PALETTE.powerLife, label: '+1' },
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function neon(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

/** @returns { draw(state, screen, best), resize() } for the given canvas. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = Math.round(FIELD.width * scale * window.devicePixelRatio);
    canvas.height = Math.round(FIELD.height * scale * window.devicePixelRatio);
    canvas.style.width = `${Math.round(FIELD.width * scale)}px`;
    canvas.style.height = `${Math.round(FIELD.height * scale)}px`;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawBackground(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, '#0d1330');
    gradient.addColorStop(0.55, PALETTE.backdrop);
    gradient.addColorStop(1, '#160a24');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Twinkling starfield.
    for (const star of state.stars) {
      const alpha = 0.25 + 0.55 * Math.abs(Math.sin(state.elapsed * 1.4 + star.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Faint grid.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
    for (let y = 80; y < FIELD.height; y += 80) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
    ctx.stroke();
    // Walls.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.wall, FIELD.height);
    ctx.fillRect(FIELD.width - FIELD.wall, 0, FIELD.wall, FIELD.height);
    ctx.fillRect(0, 0, FIELD.width, FIELD.wall);
    neon(ctx, PALETTE.accent, 12);
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(0, FIELD.wall - 2, FIELD.width, 2);
    ctx.shadowBlur = 0;
  }

  function drawHud(state, best) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${state.score}`, 28, 52);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 28, 78);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${state.level}`, FIELD.width / 2, 52);
    if (state.combo >= 5) {
      ctx.fillStyle = '#ff9f43';
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText(`COMBO x${state.combo}`, FIELD.width / 2, 78);
    }
    // Lives as little balls, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('LIVES', FIELD.width - 28 - state.lives * 30, 52);
    for (let i = 0; i < state.lives; i += 1) {
      const x = FIELD.width - 40 - i * 30;
      neon(ctx, '#ffffff', 10);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, 44, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // Active power-up timers, under the lives.
    let line = 0;
    ctx.textAlign = 'right';
    ctx.font = `600 18px ${FONT}`;
    if (state.paddle.wideTimer > 0) {
      ctx.fillStyle = PALETTE.powerWide;
      ctx.fillText(`WIDE ${Math.ceil(state.paddle.wideTimer)}s`, FIELD.width - 28, 84 + line * 24);
      line += 1;
    }
    if (state.slowTimer > 0) {
      ctx.fillStyle = PALETTE.powerSlow;
      ctx.fillText(`SLOW ${Math.ceil(state.slowTimer)}s`, FIELD.width - 28, 84 + line * 24);
    }
    ctx.textAlign = 'left';
  }

  function drawBricks(state) {
    for (const brick of state.bricks) {
      if (!brick.active) continue;
      const cx = brick.x + BRICK.width / 2;
      const cy = brick.y + BRICK.height / 2;
      neon(ctx, brick.color, brick.steel ? 4 : 14);
      ctx.fillStyle = brick.color;
      roundRect(ctx, brick.x, brick.y, BRICK.width, BRICK.height, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Gloss line and, for tough bricks, a crack showing the hit left.
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      roundRect(ctx, brick.x + 4, brick.y + 3, BRICK.width - 8, 7, 4);
      ctx.fill();
      if (brick.maxHp > 1) {
        ctx.strokeStyle = brick.hp === 1 ? 'rgba(10,14,26,0.85)' : 'rgba(10,14,26,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 12, brick.y + 5);
        ctx.lineTo(cx - 2, cy);
        ctx.lineTo(cx - 10, brick.y + BRICK.height - 5);
        ctx.moveTo(cx + 12, brick.y + 5);
        ctx.lineTo(cx + 2, cy);
        ctx.lineTo(cx + 10, brick.y + BRICK.height - 5);
        ctx.stroke();
      }
      if (brick.steel) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = `700 15px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('STEEL', cx, cy + 1);
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  function drawPowers(state) {
    for (const power of state.powers) {
      if (!power.active) continue;
      const style = POWER_STYLE[power.kind];
      neon(ctx, style.color, 14);
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.arc(power.x, power.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0e1a';
      ctx.font = `800 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.label, power.x, power.y + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }

  function drawPaddleAndBalls(state) {
    const paddle = state.paddle;
    const color = paddle.wideTimer > 0 ? PALETTE.paddleWide : PALETTE.paddle;
    neon(ctx, color, 18);
    ctx.fillStyle = color;
    roundRect(ctx, paddle.x, PADDLE.y, paddle.width, PADDLE.height, 9);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    roundRect(ctx, paddle.x + 6, PADDLE.y + 3, paddle.width - 12, 5, 3);
    ctx.fill();
    for (const ball of state.balls) {
      if (!ball.active) continue;
      // Trail.
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = PALETTE.ball;
      ctx.beginPath();
      ctx.arc(ball.x - ball.vx * 0.02, ball.y - ball.vy * 0.02, BALL.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      neon(ctx, '#ffffff', 16);
      ctx.fillStyle = PALETTE.ball;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = `700 18px ${FONT}`;
    ctx.textAlign = 'center';
    for (const p of state.popups) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.min(1, p.life / 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 14, 26, 0.82)';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function title(text, y, size, color) {
    neon(ctx, color, 24);
    ctx.fillStyle = color;
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.width / 2, y);
    ctx.shadowBlur = 0;
  }

  function line(text, y, size, color) {
    ctx.fillStyle = color;
    ctx.font = `500 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.width / 2, y);
  }

  function drawTitle(state, best) {
    // A quiet demo wall of bricks behind the panel's glow.
    drawBricks(state);
    panel(290, 150, 700, 420);
    title('NEON BREAKER', 240, 64, '#4fc3f7');
    line('Smash every brick. Don\'t drop the ball.', 300, 24, PALETTE.text);
    line('Mouse or  ←  →  /  A D  to move  ·  Space / click to launch', 348, 21, PALETTE.muted);
    line('Catch falling capsules:  W wide  ·  M multiball  ·  S slow  ·  +1 life', 380, 21, PALETTE.muted);
    line('P pause  ·  M mute  ·  clear all 5 levels to win', 412, 21, PALETTE.muted);
    line('Press SPACE or CLICK to play', 478, 26, '#f2c94c');
    if (best > 0) line(`Best score: ${best}`, 522, 22, PALETTE.muted);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 14, 26, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(440, 250, 400, 200);
    title('PAUSED', 330, 52, PALETTE.text);
    line('Press P or Space to resume', 392, 22, PALETTE.muted);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(10, 14, 26, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(340, 170, 600, 380);
    title('GAME OVER', 262, 60, '#ff5d8f');
    line(`Score  ${state.score}`, 330, 30, PALETTE.text);
    line(`Best  ${Math.max(best, state.score)}   ·   Level reached  ${state.level}`, 372, 24, PALETTE.muted);
    line('Press R or CLICK to play again', 452, 26, '#f2c94c');
    line('Space also restarts', 492, 20, PALETTE.muted);
  }

  function drawWin(state, best) {
    panel(290, 150, 700, 420);
    title('YOU WIN!', 240, 64, '#f2c94c');
    line('All five levels cleared. The neon is yours.', 300, 24, PALETTE.text);
    line(`Final score  ${state.score}   ·   Best  ${Math.max(best, state.score)}`, 352, 28, PALETTE.text);
    line('Press R or CLICK to play again', 452, 26, '#f2c94c');
  }

  function draw(state, screen, best) {
    ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
    if (state.shake > 0) {
      const mag = state.shake * 7;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    drawBackground(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      drawPaddleAndBalls(state);
      drawParticles(state);
      return;
    }
    drawHud(state, best);
    drawBricks(state);
    drawPowers(state);
    drawPaddleAndBalls(state);
    drawParticles(state);
    if (state.serving && screen === SCREEN_PLAY) {
      line('SPACE / CLICK to launch', 600, 24, '#f2c94c');
    }
    if (state.clearTimer > 0) {
      ctx.fillStyle = 'rgba(10, 14, 26, 0.45)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      title(`LEVEL ${state.level} CLEAR!`, 340, 56, '#2ed573');
      line('Get ready for the next wall…', 396, 24, PALETTE.text);
    }
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawOver(state, best);
    if (screen === SCREEN_WIN) drawWin(state, best);
  }

  return { draw, resize };
}
