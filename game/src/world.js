// The game's rules and state, with no drawing and no browser in it: the paddle, balls,
// bricks, falling power-ups, particles, score, combo, lives and levels. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react (sounds,
// screens) without the world knowing about them. Pools are allocated once, at boot.
import {
  BALL, BRICK, FIELD, LEVELS, LIVES, PADDLE, POWER, ROW_COLORS,
} from './config.js';

export const EVENT_PADDLE = 1;
export const EVENT_WALL = 2;
export const EVENT_BRICK = 4;
export const EVENT_TOUGH = 8;
export const EVENT_POWER = 16;
export const EVENT_LOSE = 32;
export const EVENT_OVER = 64;
export const EVENT_CLEAR = 128;
export const EVENT_WIN = 256;
export const EVENT_SERVE = 512;

const MAX_BALLS = 6;
const MAX_POWERS = 8;
const MAX_PARTICLES = 96;
const MAX_POPUPS = 12;
const MAX_BRICKS = 80;
const MAX_LIVES = 5;
const WIN_LEVEL = 5;

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

export function createWorld(random) {
  const paddle = { x: 0, width: PADDLE.width, wideTimer: 0 };
  const balls = [];
  for (let i = 0; i < MAX_BALLS; i += 1) {
    balls.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
  const bricks = [];
  for (let i = 0; i < MAX_BRICKS; i += 1) {
    bricks.push({ active: false, x: 0, y: 0, hp: 1, maxHp: 1, color: '#fff', steel: false, power: null });
  }
  const powers = [];
  for (let i = 0; i < MAX_POWERS; i += 1) {
    powers.push({ active: false, x: 0, y: 0, kind: 'wide' });
  }
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 3 });
  }
  const popups = [];
  for (let i = 0; i < MAX_POPUPS; i += 1) {
    popups.push({ active: false, x: 0, y: 0, text: '', life: 0 });
  }
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height * 0.7, r: 0.6 + random() * 1.6, phase: random() * Math.PI * 2 });
  }

  const state = {
    paddle, balls, bricks, powers, particles, popups, stars,
    score: 0, best: 0, combo: 0, lives: LIVES, level: 1,
    elapsed: 0, serving: true, slowTimer: 0, shake: 0, clearTimer: 0, won: false,
    breakableLeft: 0,
  };

  function freeBall() { for (const b of balls) if (!b.active) return b; return null; }
  function freePower() { for (const p of powers) if (!p.active) return p; return null; }
  function freeParticle() { for (const p of particles) if (!p.active) return p; return null; }
  function freePopup() { for (const p of popups) if (!p.active) return p; return null; }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = freeParticle();
      if (!p) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v; p.vy = Math.sin(angle) * v;
      p.maxLife = 0.4 + random() * 0.4; p.life = p.maxLife;
      p.color = color; p.size = 2 + random() * 3;
    }
  }

  function popup(x, y, text) {
    const p = freePopup();
    if (!p) return;
    p.active = true; p.x = x; p.y = y; p.text = text; p.life = 0.9;
  }

  function ballSpeed() {
    return Math.min(BALL.maxSpeed, BALL.baseSpeed + BALL.speedPerLevel * (state.level - 1) + state.score * 0.002);
  }

  function serveBall() {
    const ball = freeBall();
    if (!ball) return;
    ball.active = true;
    ball.x = paddle.x + paddle.width / 2;
    ball.y = PADDLE.y - BALL.radius - 1;
    ball.vx = 0; ball.vy = 0;
    state.serving = true;
  }

  function launchBall() {
    for (const ball of balls) {
      if (!ball.active) continue;
      const speed = ballSpeed() * (state.slowTimer > 0 ? POWER.slowFactor : 1);
      const angle = BALL.serveAngle + (random() - 0.5) * 0.3;
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
    }
    state.serving = false;
    return EVENT_SERVE;
  }

  function buildLevel(level) {
    for (const b of bricks) b.active = false;
    const map = LEVELS[(level - 1) % LEVELS.length];
    let index = 0;
    let breakable = 0;
    for (let row = 0; row < map.length; row += 1) {
      const line = map[row];
      for (let col = 0; col < line.length; col += 1) {
        const cell = line[col];
        if (cell === '.') continue;
        const brick = bricks[index];
        index += 1;
        const x = BRICK.left + col * (BRICK.width + BRICK.gapX);
        const y = BRICK.top + row * (BRICK.height + BRICK.gapY);
        brick.active = true; brick.x = x; brick.y = y;
        brick.steel = cell === 'X';
        brick.hp = cell === 'T' ? 2 : 1;
        brick.maxHp = brick.hp;
        if (level > WIN_LEVEL && !brick.steel && random() < 0.25) { brick.hp = 2; brick.maxHp = 2; }
        const digit = Number.parseInt(cell, 10);
        brick.color = brick.steel ? '#5a6478' : Number.isInteger(digit) ? ROW_COLORS[(digit - 1) % ROW_COLORS.length] : '#d7dee8';
        if (cell === 'T' || brick.maxHp === 2) brick.color = '#d7dee8';
        // A power-up hides behind a random breakable brick.
        brick.power = null;
        if (!brick.steel && random() < BRICK.powerChance) {
          brick.power = random() < POWER.lifeChance ? 'life' : ['wide', 'multi', 'slow'][Math.floor(random() * 3)];
        }
        if (!brick.steel) breakable += 1;
      }
    }
    state.breakableLeft = breakable;
  }

  function reset() {
    paddle.x = (FIELD.width - PADDLE.width) / 2;
    paddle.width = PADDLE.width;
    paddle.wideTimer = 0;
    for (const b of balls) b.active = false;
    for (const p of powers) p.active = false;
    for (const p of particles) p.active = false;
    for (const p of popups) p.active = false;
    state.score = 0; state.combo = 0; state.lives = LIVES;
    state.level = 1; state.elapsed = 0; state.slowTimer = 0;
    state.shake = 0; state.clearTimer = 0; state.won = false;
    buildLevel(1);
    serveBall();
  }

  function nextLevel() {
    state.level += 1;
    state.clearTimer = 0;
    for (const b of balls) b.active = false;
    for (const p of powers) p.active = false;
    paddle.width = PADDLE.width;
    paddle.wideTimer = 0;
    buildLevel(state.level);
    serveBall();
  }

  function dropPower(x, y, kind) {
    const p = freePower();
    if (!p) return;
    p.active = true; p.x = x; p.y = y; p.kind = kind;
  }

  function applyPower(kind) {
    if (kind === 'wide') {
      paddle.width = PADDLE.wideWidth;
      paddle.wideTimer = PADDLE.wideSeconds;
      popup(paddle.x + paddle.width / 2, PADDLE.y - 30, 'WIDE PADDLE!');
    } else if (kind === 'multi') {
      let added = 0;
      for (const ball of balls) {
        if (!ball.active || added >= 2) continue;
        const copy = freeBall();
        if (!copy) break;
        copy.active = true; copy.x = ball.x; copy.y = ball.y;
        const speed = Math.hypot(ball.vx, ball.vy);
        const angle = Math.atan2(ball.vy, ball.vx) + (added === 0 ? 0.5 : -0.5);
        copy.vx = Math.cos(angle) * speed; copy.vy = Math.sin(angle) * speed;
        added += 1;
      }
      popup(paddle.x + paddle.width / 2, PADDLE.y - 30, 'MULTIBALL!');
    } else if (kind === 'slow') {
      state.slowTimer = POWER.slowSeconds;
      popup(paddle.x + paddle.width / 2, PADDLE.y - 30, 'SLOW BALL!');
    } else if (kind === 'life') {
      state.lives = Math.min(MAX_LIVES, state.lives + 1);
      popup(paddle.x + paddle.width / 2, PADDLE.y - 30, 'EXTRA LIFE!');
    }
  }

  function damageBrick(brick, ball) {
    brick.hp -= 1;
    if (brick.hp > 0) {
      burst(ball.x, ball.y, brick.color, 6, 160);
      return EVENT_TOUGH;
    }
    brick.active = false;
    state.combo += 1;
    const points = (brick.maxHp > 1 ? BRICK.toughPoints : BRICK.points) + Math.min(state.combo, 20) * 5;
    state.score += points;
    burst(brick.x + BRICK.width / 2, brick.y + BRICK.height / 2, brick.color, 16, 260);
    popup(brick.x + BRICK.width / 2, brick.y, `+${points}`);
    if (brick.power) dropPower(brick.x + BRICK.width / 2, brick.y + BRICK.height / 2, brick.power);
    if (!brick.steel) state.breakableLeft -= 1;
    return EVENT_BRICK;
  }

  function stepBall(ball, dt) {
    let events = 0;
    const slow = state.slowTimer > 0 ? POWER.slowFactor : 1;
    const prevX = ball.x;
    const prevY = ball.y;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // Keep the speed honest after power-ups and level changes.
    const speed = Math.hypot(ball.vx, ball.vy);
    const target = ballSpeed() * slow;
    if (speed > 0 && Math.abs(speed - target) > 1) {
      ball.vx = (ball.vx / speed) * target;
      ball.vy = (ball.vy / speed) * target;
    }
    if (ball.x - BALL.radius < FIELD.wall) {
      ball.x = FIELD.wall + BALL.radius;
      ball.vx = Math.abs(ball.vx);
      events |= EVENT_WALL;
    } else if (ball.x + BALL.radius > FIELD.width - FIELD.wall) {
      ball.x = FIELD.width - FIELD.wall - BALL.radius;
      ball.vx = -Math.abs(ball.vx);
      events |= EVENT_WALL;
    }
    if (ball.y - BALL.radius < FIELD.wall) {
      ball.y = FIELD.wall + BALL.radius;
      ball.vy = Math.abs(ball.vy);
      events |= EVENT_WALL;
    }
    // Paddle: only when falling onto it.
    if (ball.vy > 0 && ball.y + BALL.radius >= PADDLE.y && ball.y - BALL.radius <= PADDLE.y + PADDLE.height
      && ball.x >= paddle.x - BALL.radius && ball.x <= paddle.x + paddle.width + BALL.radius) {
      const offset = clamp((ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2), -1, 1);
      const angle = -Math.PI / 2 + offset * 1.1;
      const s = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.cos(angle) * s;
      ball.vy = Math.sin(angle) * s;
      ball.y = PADDLE.y - BALL.radius - 0.5;
      burst(ball.x, PADDLE.y, '#4fc3f7', 5, 120);
      events |= EVENT_PADDLE;
    }
    // Bricks: resolve against the previous position so the bounce side is right.
    for (const brick of bricks) {
      if (!brick.active) continue;
      if (ball.x + BALL.radius < brick.x || ball.x - BALL.radius > brick.x + BRICK.width
        || ball.y + BALL.radius < brick.y || ball.y - BALL.radius > brick.y + BRICK.height) continue;
      const fromLeft = prevX + BALL.radius <= brick.x;
      const fromRight = prevX - BALL.radius >= brick.x + BRICK.width;
      const fromTop = prevY + BALL.radius <= brick.y;
      const fromBottom = prevY - BALL.radius >= brick.y + BRICK.height;
      if ((fromLeft || fromRight) && !(fromTop || fromBottom)) {
        ball.vx = fromLeft ? -Math.abs(ball.vx) : Math.abs(ball.vx);
        ball.x = fromLeft ? brick.x - BALL.radius - 0.5 : brick.x + BRICK.width + BALL.radius + 0.5;
      } else {
        ball.vy = fromTop ? -Math.abs(ball.vy) : Math.abs(ball.vy);
        ball.y = fromTop ? brick.y - BALL.radius - 0.5 : brick.y + BRICK.height + BALL.radius + 0.5;
      }
      // A nearly-horizontal ball gets a nudge so rallies never go flat forever.
      if (Math.abs(ball.vy) < 90) ball.vy += ball.vy < 0 ? -60 : 60;
      events |= damageBrick(brick, ball);
      break;
    }
    return events;
  }

  /** Advance one fixed step. `move` is -1/0/1 from keys, `pointerX` the pointer's logical
   *  x or null, `confirm` launches a served ball. Returns event bit flags. */
  function step(dt, move, pointerX, confirm) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 3);
    if (state.clearTimer > 0) state.clearTimer -= dt;

    // Paddle steering.
    if (pointerX !== null) {
      const target = clamp(pointerX - paddle.width / 2, FIELD.wall, FIELD.width - FIELD.wall - paddle.width);
      const delta = target - paddle.x;
      paddle.x += clamp(delta, -PADDLE.speed * 1.4 * dt, PADDLE.speed * 1.4 * dt);
    } else if (move !== 0) {
      paddle.x += move * PADDLE.speed * dt;
    }
    paddle.x = clamp(paddle.x, FIELD.wall, FIELD.width - FIELD.wall - paddle.width);
    if (paddle.wideTimer > 0) {
      paddle.wideTimer -= dt;
      if (paddle.wideTimer <= 0) paddle.width = PADDLE.width;
    }
    if (state.slowTimer > 0) state.slowTimer -= dt;

    if (state.serving) {
      for (const ball of balls) {
        if (!ball.active) continue;
        ball.x = paddle.x + paddle.width / 2;
        ball.y = PADDLE.y - BALL.radius - 1;
      }
      if (confirm) events |= launchBall();
    } else {
      for (const ball of balls) {
        if (!ball.active) continue;
        events |= stepBall(ball, dt);
        if (ball.y - BALL.radius > FIELD.height) ball.active = false;
      }
      if (!balls.some((b) => b.active)) {
        state.lives -= 1;
        state.combo = 0;
        state.shake = 1;
        burst(paddle.x + paddle.width / 2, PADDLE.y, '#ff5d8f', 24, 320);
        if (state.lives <= 0) {
          events |= EVENT_LOSE | EVENT_OVER;
        } else {
          events |= EVENT_LOSE;
          serveBall();
        }
      }
    }

    // Falling power-ups.
    for (const power of powers) {
      if (!power.active) continue;
      power.y += 230 * dt;
      const caught = power.y >= PADDLE.y - 8 && power.y <= PADDLE.y + PADDLE.height + 8
        && power.x >= paddle.x - 6 && power.x <= paddle.x + paddle.width + 6;
      if (caught) {
        power.active = false;
        applyPower(power.kind);
        events |= EVENT_POWER;
      } else if (power.y > FIELD.height) {
        power.active = false;
      }
    }

    // Level cleared: every breakable brick is gone.
    if (state.breakableLeft <= 0 && state.lives > 0 && state.clearTimer <= 0 && !state.won) {
      if (state.level >= WIN_LEVEL) {
        state.won = true;
        events |= EVENT_CLEAR | EVENT_WIN;
      } else {
        state.clearTimer = 1.8;
        events |= EVENT_CLEAR;
      }
    }

    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    for (const p of popups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
      else p.y -= 34 * dt;
    }
    return events;
  }

  return { state, reset, nextLevel, step, launchBall };
}
