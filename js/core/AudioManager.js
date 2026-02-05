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
