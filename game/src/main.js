// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the level's random bricks and power-ups. ?shot=start|play|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BRICK, EVENT_CLEAR, EVENT_LOSE, EVENT_OVER, EVENT_PADDLE, EVENT_POWER, EVENT_SERVE, EVENT_TOUGH, EVENT_WALL, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Clear the bricks.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `You win! Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playSounds(events) {
    if (events & EVENT_PADDLE) audio.play('paddle');
    if (events & EVENT_WALL) audio.play('wall');
    if (events & EVENT_BRICK) audio.play('brick');
    if (events & EVENT_TOUGH) audio.play('tough');
    if (events & EVENT_POWER) audio.play('power');
    if (events & EVENT_SERVE) audio.play('serve');
    if (events & EVENT_CLEAR) audio.play('clear');
    if (events & EVENT_WIN) audio.play('win');
    if (events & EVENT_LOSE) audio.play('lose');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame();
      }
      renderer.draw(world.state, screen, best);
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) {
        audio.unlock();
        startGame();
      }
      renderer.draw(world.state, screen, best);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
        last = performance.now();
      }
    }
    if (screen === SCREEN_PAUSED) {
      renderer.draw(world.state, screen, best);
      return;
    }
    const confirm = Boolean(actions & ACTION_CONFIRM);
    const move = input.move();
    accumulator += elapsed;
    let firstStep = true;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const events = world.step(STEP, move, input.pointerX(), confirm && firstStep);
      firstStep = false;
      playSounds(events);
      if (events & EVENT_OVER) {
        endGame(Boolean(events & EVENT_WIN));
        break;
      }
      // The clear banner shows while clearTimer runs; load the next level when it ends.
      if (world.state.clearTimer <= 0 && world.state.breakableLeft === 0
        && !world.state.won && world.state.lives > 0) {
        world.nextLevel();
      }
      if (world.state.score > best) best = world.state.score;
    }
    renderer.draw(world.state, screen, best);
  }

  world.reset();
  requestAnimationFrame(frame);
}

if (shot !== null) runShot(shot);
else runGame();
