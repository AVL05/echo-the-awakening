let context: AudioContext | undefined;
let master: GainNode | undefined;
let noise: AudioBuffer | undefined;
let reverb: GainNode | undefined;
let reactor: GainNode | undefined;

function tone(frequency: number, end: number, duration: number, volume: number, offset = 0, type: OscillatorType = 'sine') {
  if (!context || !master) return;
  const at = context.currentTime + offset;
  const source = context.createOscillator(), gain = context.createGain();
  source.type = type; source.frequency.setValueAtTime(frequency, at); source.frequency.exponentialRampToValueAtTime(end, at + duration);
  gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + 0.03); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(gain); gain.connect(master); if (reverb) gain.connect(reverb);
  source.onended = () => { source.disconnect(); gain.disconnect(); };
  source.start(at); source.stop(at + duration + 0.03);
}

function hiss(duration: number, frequency: number, volume: number, pan = 0) {
  if (!context || !master || !noise) return;
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(), stereo = context.createStereoPanner();
  source.buffer = noise; source.loop = true; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 0.7;
  stereo.pan.value = pan; const at = context.currentTime;
  gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(master); if (reverb) stereo.connect(reverb);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); stereo.disconnect(); };
  source.start(); source.stop(at + duration + 0.03);
}

export function wakeAudio(muted: boolean) {
  if (!context) {
    try {
      context = new AudioContext();
      const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -20; compressor.ratio.value = 5; compressor.connect(context.destination);
      master = context.createGain(); master.gain.value = muted ? 0 : 0.36; master.connect(compressor);
      noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      let seed = 19;
      const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = random() * 2 - 1;
      const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 1.7), context.sampleRate);
      for (let c = 0; c < 2; c++) {
        const data = impulse.getChannelData(c);
        for (let i = 0; i < data.length; i++) data[i] = (random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.3;
      }
      const convolver = context.createConvolver(); convolver.buffer = impulse; convolver.connect(master);
      reverb = context.createGain(); reverb.gain.value = 0.22; reverb.connect(convolver);
      reactor = context.createGain(); reactor.gain.value = 0.09; reactor.connect(master);
      for (const frequency of [38, 57.07, 76.12]) {
        const source = context.createOscillator(), gain = context.createGain();
        source.frequency.value = frequency; gain.gain.value = 0.28; source.connect(gain); gain.connect(reactor); source.start();
      }
      const lfo = context.createOscillator(), modulation = context.createGain(); lfo.frequency.value = 0.17; modulation.gain.value = 0.018;
      lfo.connect(modulation); modulation.connect(reactor.gain); lfo.start();
      for (const pan of [-0.7, 0.7]) {
        const fan = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain(), stereo = context.createStereoPanner();
        fan.buffer = noise; fan.loop = true; fan.playbackRate.value = pan < 0 ? 0.7 : 0.93; filter.type = 'lowpass'; filter.frequency.value = 240;
        gain.gain.value = 0.055; stereo.pan.value = pan;
        fan.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(master); fan.start();
      }
    } catch { void context?.close().catch(() => {}); context = master = noise = reverb = reactor = undefined; return false; }
  }
  void context.resume().catch(() => {});
  return true;
}

export function setMuted(muted: boolean) {
  if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.36, context.currentTime, 0.15);
}

export function setReactorAudio(powered: boolean) {
  if (context && reactor) reactor.gain.setTargetAtTime(powered ? 0.24 : 0.09, context.currentTime, 0.8);
}

export function pauseAudio(paused: boolean) {
  if (context) void (paused ? context.suspend() : context.resume()).catch(() => {});
}

export function footstep(right: boolean) {
  hiss(0.14, 700, 0.1, right ? 0.18 : -0.18); tone(85, 43, 0.12, 0.08);
}

export function narrativeSound(kind: 'lab' | 'core' | 'preserve' | 'erase') {
  if (kind === 'erase') {
    hiss(5, 380, 0.16); tone(220, 28, 6, 0.18, 0, 'triangle');
    [0, 1.1, 2.2].forEach((t, i) => tone(660 / (i + 1), 38, 2, 0.08, t));
  } else {
    hiss(3, kind === 'lab' ? 1400 : 240, 0.14);
    [0, 1.4, 2.8].forEach((t, i) => tone([110, 165, 220][i], [110, 165, 220][i], 4, 0.08, t));
  }
}

export function chime(kind: 'cell' | 'power' | 'door' | 'terminal' | 'denied') {
  if (kind === 'power') {
    hiss(2.8, 220, 0.32); tone(34, 150, 3.2, 0.36, 0, 'triangle');
    [0.15, 0.65, 1.2].forEach((t, i) => tone(140 + i * 60, 80, 0.2, 0.2, t, 'triangle'));
    tone(440, 880, 1.8, 0.08, 1.2); setReactorAudio(true);
  } else if (kind === 'door') {
    hiss(2.3, 800, 0.28); tone(65, 38, 2.6, 0.22, 0, 'triangle');
    tone(620, 620, 0.18, 0.11); tone(820, 820, 0.3, 0.1, 0.27);
  } else if (kind === 'denied') {
    tone(145, 120, 0.18, 0.15, 0, 'triangle'); tone(145, 120, 0.18, 0.12, 0.22, 'triangle');
  } else if (kind === 'terminal') {
    tone(320, 640, 0.45, 0.09); tone(960, 640, 0.7, 0.045, 0.1);
  } else {
    hiss(0.18, 1800, 0.06); tone(440, 880, 0.7, 0.15); tone(1320, 880, 0.45, 0.07, 0.12);
  }
}
