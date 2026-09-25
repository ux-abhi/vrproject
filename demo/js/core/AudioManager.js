import * as THREE from 'three';

export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.sounds = {};
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    // Resume audio context on user interaction
    if (this.listener.context.state === 'suspended') {
      this.listener.context.resume();
    }
    this.initialized = true;
  }

  createDistressSound(victimMesh) {
    // Create a synthetic moaning/distress oscillator sound
    const sound = new THREE.PositionalAudio(this.listener);

    // We'll create a procedural audio buffer for distress
    const ctx = this.listener.context;
    const duration = 2.0;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate a low moaning waveform
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      // Low frequency moan with vibrato
      const freq = 180 + 40 * Math.sin(2 * Math.PI * 1.5 * t);
      const moan = Math.sin(2 * Math.PI * freq * t) * 0.3;
      // Envelope
      const env = Math.sin(Math.PI * t / duration) * 0.5;
      data[i] = moan * env;
    }

    sound.setBuffer(buffer);
    sound.setRefDistance(2);
    sound.setMaxDistance(20);
    sound.setDistanceModel('exponential');
    sound.setRolloffFactor(2);
    sound.setLoop(true);
    sound.setVolume(0.3);

    victimMesh.add(sound);
    this.sounds.distress = sound;
    return sound;
  }

  playDistress() {
    if (this.sounds.distress && !this.sounds.distress.isPlaying) {
      this.init();
      this.sounds.distress.play();
    }
  }

  stopDistress() {
    if (this.sounds.distress && this.sounds.distress.isPlaying) {
      this.sounds.distress.stop();
    }
  }

  playSuccess() {
    this.init();
    this._playTone(523.25, 0.15, 0.3); // C5
    setTimeout(() => this._playTone(659.25, 0.15, 0.3), 150); // E5
    setTimeout(() => this._playTone(783.99, 0.25, 0.3), 300); // G5
  }

  playFail() {
    this.init();
    this._playTone(200, 0.5, 0.4);
    setTimeout(() => this._playTone(150, 0.5, 0.4), 300);
  }

  playClick() {
    this.init();
    this._playTone(800, 0.05, 0.2);
  }

  playPhoneRing() {
    this.init();
    const ring = () => {
      this._playTone(440, 0.15, 0.2);
      setTimeout(() => this._playTone(480, 0.15, 0.2), 200);
    };
    ring();
    setTimeout(ring, 600);
  }

  // ── Ambience and vehicles (procedural, no audio files) ─────────────────────

  _noiseBuffer(seconds, brown = true) {
    const ctx = this.listener.context;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white * 0.5;
      }
    }
    // Crossfade the ends so the loop has no click
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      data[i] = data[i] * k + data[data.length - fade + i] * (1 - k);
    }
    return buffer;
  }

  _filter(type, frequency, q = 0.7) {
    const f = this.listener.context.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    return f;
  }

  // Distant city rumble plus gusting wind
  startAmbience() {
    this.init();
    if (this.sounds.city) return;
    const city = new THREE.Audio(this.listener);
    city.setBuffer(this._noiseBuffer(6, true));
    city.setFilter(this._filter('lowpass', 380));
    city.setLoop(true);
    city.setVolume(0.35);
    city.play();
    this.sounds.city = city;

    const wind = new THREE.Audio(this.listener);
    wind.setBuffer(this._noiseBuffer(5, false));
    wind.setFilter(this._filter('bandpass', 900, 0.6));
    wind.setLoop(true);
    wind.setVolume(0.03);
    wind.play();
    this.sounds.wind = wind;
  }

  // Engine / tyre noise that follows a vehicle; volume is driven by speed
  createEngineSound(object) {
    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(this._engineBuffer || (this._engineBuffer = this._noiseBuffer(3, true)));
    sound.setFilter(this._filter('lowpass', 520));
    sound.setRefDistance(4);
    sound.setRolloffFactor(1.6);
    sound.setMaxDistance(80);
    sound.setDistanceModel('exponential');
    sound.setLoop(true);
    sound.setVolume(0);
    object.add(sound);
    return sound;
  }

  // German two-tone "Martinshorn" siren
  createSiren(object) {
    const ctx = this.listener.context;
    const seconds = 2.4;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let phase = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const f = (t % 1.2) < 0.6 ? 466 : 622;
      phase += (2 * Math.PI * f) / ctx.sampleRate;
      data[i] = (Math.sin(phase) * 0.6 + Math.sin(phase * 3) * 0.2 + Math.sin(phase * 5) * 0.08) * 0.5;
    }
    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(buffer);
    sound.setRefDistance(10);
    sound.setRolloffFactor(1.1);
    sound.setMaxDistance(250);
    sound.setLoop(true);
    sound.setVolume(0.5);
    object.add(sound);
    return sound;
  }

  update(elapsed) {
    if (this.sounds.wind) {
      const gust = 0.03 + Math.max(0, Math.sin(elapsed * 0.23) * Math.sin(elapsed * 0.61)) * 0.09;
      this.sounds.wind.setVolume(gust);
    }
  }

  // Silence everything (used when leaving the session)
  stopAll() {
    for (const key of Object.keys(this.sounds)) {
      const s = this.sounds[key];
      if (s && s.isPlaying) s.stop();
    }
    if (this.listener.context.state === 'running') this.listener.context.suspend();
  }

  // Short double car horn
  playHorn() {
    this.init();
    const ctx = this.listener.context;
    if (ctx.state === 'suspended') return;
    const beep = (start) => {
      for (const f of [349, 440]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        const filter = this._filter('lowpass', 1400);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + start + 0.02);
        gain.gain.setValueAtTime(0.09, ctx.currentTime + start + 0.22);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.28);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + 0.3);
      }
    };
    beep(0);
    beep(0.36);
  }

  _playTone(frequency, duration, volume = 0.3) {
    const ctx = this.listener.context;
    if (ctx.state === 'suspended') return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }
}
