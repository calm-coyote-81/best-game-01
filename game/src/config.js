// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720, wall: 14 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PADDLE = {
  width: 128,
  wideWidth: 192,
  height: 18,
  y: 668,
  speed: 780,
  wideSeconds: 12,
};

export const BALL = {
  radius: 9,
  baseSpeed: 520,
  speedPerLevel: 26,
  maxSpeed: 820,
  speedPerBrick: 3,
  serveAngle: -Math.PI / 3,
};

export const BRICK = {
  cols: 10,
  width: 112,
  height: 28,
  gapX: 8,
  gapY: 10,
  top: 96,
  left: 40,
  points: 50,
  toughPoints: 120,
  powerChance: 0.22,
};

export const LIVES = 3;

/** Seconds a slow-ball power-up lasts; multiball is instant. */
export const POWER = { slowSeconds: 9, slowFactor: 0.72, lifeChance: 0.03 };

/** Levels are hand-designed brick maps. '.' is empty, digits are 1-hit bricks in that
 *  row's colour, 'T' is a 2-hit tough brick, 'X' is unbreakable steel. Level 6+ replays
 *  level 5's map with faster balls and tougher bricks mixed in. */
export const LEVELS = [
  [
    '1111111111',
    '2222222222',
    '3333333333',
    '4444444444',
    '5555555555',
  ],
  [
    '1.111111.1',
    '.22222222.',
    '3333333333',
    '.44444444.',
    '5.555555.5',
    '..666666..',
  ],
  [
    'X11111111X',
    '12T2222T21',
    '3333333333',
    '.3T3333T3.',
    '4444444444',
    '55.5555.55',
  ],
  [
    '1.2.3.4.5.',
    '.T222222T.',
    '3333333333',
    'X44444444X',
    '.55555555.',
    '6666666666',
    '1.111111.1',
  ],
  [
    'XT111111TX',
    'T22222222T',
    '3333333333',
    'X44444444X',
    '5555555555',
    'T66666666T',
    'XT111111TX',
  ],
];

/** Row digit -> brick colour, top row first. */
export const ROW_COLORS = ['#ff5d8f', '#ff9f43', '#f2c94c', '#2ed573', '#4fc3f7', '#a55eea'];

export const PALETTE = {
  backdrop: '#0a0e1a',
  panel: '#141a2e',
  grid: '#1b2340',
  text: '#eef1f5',
  muted: '#8b93a3',
  accent: '#4fc3f7',
  paddle: '#4fc3f7',
  paddleWide: '#2ed573',
  ball: '#ffffff',
  steel: '#5a6478',
  tough: '#d7dee8',
  powerWide: '#2ed573',
  powerMulti: '#ff9f43',
  powerSlow: '#a55eea',
  powerLife: '#ff5d8f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-breaker.best';
