let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockAudio() {
  if (!ctx) {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

function tone(freq: number, duration: number, options: { to?: number; type?: OscillatorType; gain?: number; delay?: number } = {}) {
  if (!ctx || !master) return;
  const at = ctx.currentTime + (options.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, at);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(options.gain ?? 0.1, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain); gain.connect(master); osc.start(at); osc.stop(at + duration + 0.03);
}

export const sfx = {
  move: () => tone(105 + Math.random() * 20, 0.05, { gain: 0.055 }),
  reject: () => tone(170, 0.1, { type: 'square', gain: 0.06 }),
  alert: () => tone(880, 0.18, { to: 440, type: 'sawtooth', gain: 0.11 }),
  hit: () => { tone(180, 0.15, { to: 70, type: 'square', gain: 0.12 }); },
  smoke: () => tone(180, 0.28, { to: 80, type: 'sawtooth', gain: 0.07 }),
  loot: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, { delay: i * 0.1, gain: 0.08 })),
  win: () => [262, 392, 523].forEach((f, i) => tone(f, 0.34, { delay: i * 0.16, gain: 0.1 })),
  lose: () => { tone(147, 0.34, { to: 110, gain: 0.09 }); tone(110, 0.4, { to: 73, delay: 0.25, gain: 0.08 }); },
};
