// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot (the paddle
// chases the lowest ball, with a reaction delay), so the frame is what a short game really
// looks like and the same seed always gives the same frame. The play pilot is sharp and
// keeps its balls; the end pilot is sluggish, so it is caught out and the game ends.
import { FIELD, PADDLE, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;
/** How far the pilot may lag behind the ball's x before it starts moving (px). */
const PLAY_SLACK = 26;
const END_SLACK = 130;

/** Steer toward the lowest active ball, or the centre when serving. */
function autopilot(state, slack) {
  let ball = null;
  for (const candidate of state.balls) {
    if (candidate.active && (ball === null || candidate.y > ball.y)) ball = candidate;
  }
  const target = ball === null ? FIELD.width / 2 : ball.x;
  const centre = state.paddle.x + state.paddle.width / 2;
  if (target > centre + slack) return 1;
  if (target < centre - slack) return -1;
  return 0;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, null, false);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const slack = name === 'end' ? END_SLACK : PLAY_SLACK;
  let launched = false;
  for (let i = 0; i < limit / STEP; i += 1) {
    const move = autopilot(world.state, slack);
    // Launch the served ball as soon as the pilot is under it.
    const confirm = world.state.serving && !launched;
    if (confirm) launched = true;
    if (world.step(STEP, move, null, confirm) & EVENT_OVER) break;
    if (world.state.serving) launched = false;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
