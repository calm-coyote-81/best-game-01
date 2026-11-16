// Tiny WebAudio synth: short oscillator blips, no audio files. Everything is created lazily
// on the first user gesture (browsers block audio before one) and muted with M.
const SOUNDS = {
  paddle: { freq: 220, end: 330, dur: 0.07, type: 'triangle', gain: 0.16 },
  wall: { freq: 180, end: 180, dur: 0.04, type: 'square', gain: 0.07 },
  brick: { freq: 520, end: 780, dur: 0.06, type: 'square', gain: 0.1 },
  tough: { freq: 300, end: 240, dur: 0.06, type: 'square', gain: 0.1 },
  power: { freq: 660, end: 990, dur: 0.14, type: 'sine', gain: 0.14 },
  lose: { freq: 320, end: 90, dur: 0.35, type: 'sawtooth', gain: 0.12 },
  serve: { freq: 440, end: 660, dur: 0.08, type: 'sine', gain: 0.12 },
  clear: { freq: 523, end: 1046, dur: 0.4, type: 'triangle', gain: 0.14 },
  win: { freq: 523, end: 1568, dur: 0.6, type: 'triangle', gain: 0.14 },
};

/** @returns an object with play(name), toggleMute() and muted(). */
export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  function play(name) {
    if (muted) return;
    const spec = SOUNDS[name];
    if (!spec) return;
    const audio = ensure();
    if (audio === null) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, spec.end), now + spec.dur);
    amp.gain.setValueAtTime(spec.gain, now);
    amp.gain.exponentialRampToValueAtTime(0.001, now + spec.dur);
    osc.connect(amp).connect(audio.destination);
    osc.start(now);
    osc.stop(now + spec.dur + 0.02);
  }

  return {
    play,
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    muted() { return muted; },
  };
}
