import type {GameStatus} from '../game/types';

const MUTE_KEY = 'front-snake-muted';

interface Note {
  freq: number;
  beats: number;
}

interface ThemeNote {
  melody: number;
  harmony: number;
  bass: number;
  beats: number;
}

const D3 = 146.83;
const E3 = 164.81;
const G3 = 196.0;
const A3 = 220.0;
const B3 = 246.94;
const D4 = 293.66;
const E4 = 329.63;
const FS4 = 369.99;
const G4 = 392.0;
const A4 = 440.0;
const B4 = 493.88;
const CS5 = 554.37;
const D5 = 587.33;
const E5 = 659.25;
const FS5 = 739.99;
const G5 = 783.99;
const A5 = 880.0;

/** Original overworld theme — heroic pulse + triangle bass. */
const THEME_LOOP: ThemeNote[] = [
  {melody: D5, harmony: A4, bass: D3, beats: 2},
  {melody: A4, harmony: FS4, bass: D3, beats: 1},
  {melody: D5, harmony: A4, bass: A3, beats: 1},
  {melody: FS5, harmony: D5, bass: D3, beats: 4},

  {melody: A5, harmony: FS5, bass: D3, beats: 2},
  {melody: FS5, harmony: D5, bass: D3, beats: 1},
  {melody: E5, harmony: CS5, bass: A3, beats: 1},
  {melody: D5, harmony: A4, bass: D3, beats: 4},

  {melody: B4, harmony: G4, bass: G3, beats: 2},
  {melody: CS5, harmony: A4, bass: G3, beats: 2},
  {melody: D5, harmony: B4, bass: D3, beats: 2},
  {melody: FS5, harmony: D5, bass: G3, beats: 2},

  {melody: E5, harmony: CS5, bass: A3, beats: 4},
  {melody: A4, harmony: E4, bass: A3, beats: 4},

  {melody: G5, harmony: D5, bass: G3, beats: 2},
  {melody: FS5, harmony: D5, bass: G3, beats: 2},
  {melody: E5, harmony: B4, bass: E3, beats: 2},
  {melody: D5, harmony: A4, bass: D3, beats: 2},

  {melody: CS5, harmony: A4, bass: A3, beats: 2},
  {melody: D5, harmony: A4, bass: A3, beats: 2},
  {melody: E5, harmony: CS5, bass: E3, beats: 2},
  {melody: FS5, harmony: D5, bass: A3, beats: 2},

  {melody: G5, harmony: E5, bass: G3, beats: 2},
  {melody: E5, harmony: CS5, bass: E3, beats: 2},
  {melody: CS5, harmony: A4, bass: A3, beats: 2},
  {melody: A4, harmony: E4, bass: A3, beats: 2},

  {melody: D5, harmony: A4, bass: D3, beats: 6},
  {melody: 0, harmony: 0, bass: D3, beats: 2},

  {melody: FS4, harmony: D4, bass: B3, beats: 2},
  {melody: G4, harmony: D4, bass: B3, beats: 2},
  {melody: A4, harmony: FS4, bass: D3, beats: 2},
  {melody: B4, harmony: G4, bass: G3, beats: 2},

  {melody: A4, harmony: FS4, bass: D3, beats: 3},
  {melody: FS4, harmony: D4, bass: D3, beats: 1},
  {melody: D4, harmony: A3, bass: D3, beats: 4},
];

const FANFARE_LOOP: Note[] = [
  {freq: 523.25, beats: 1},
  {freq: 659.25, beats: 1},
  {freq: 783.99, beats: 1},
  {freq: 1046.5, beats: 2},
  {freq: 783.99, beats: 1},
  {freq: 1046.5, beats: 3},
  {freq: 659.25, beats: 1},
  {freq: 783.99, beats: 1},
  {freq: 987.77, beats: 1},
  {freq: 1318.5, beats: 4},
];

const THEME_BEAT_MS = 240;
const MUSIC_VOL_IDLE = 0.07;
const MUSIC_VOL_PLAYING = 0.042;

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // ignore
  }
}

export class SnakeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicIndex = 0;
  private musicPlaying = false;
  private fanfareTimer: number | null = null;
  private fanfareIndex = 0;
  private fanfarePlaying = false;
  private muted = loadMuted();
  private listeningForGesture = false;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    if (muted) {
      this.stopMusic();
      this.haltFanfare();
    }
    if (this.master) {
      this.master.gain.value = muted ? 0 : 1;
    }
    if (!muted) {
      void this.unlock().then(() => {
        this.startMusic();
      });
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async unlock(): Promise<void> {
    this.listenForGesture();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  syncStatus(status: GameStatus): void {
    if (this.muted) {
      this.stopMusic();
      this.haltFanfare();
      return;
    }
    if (this.fanfarePlaying) {
      return;
    }
    this.setMusicVolume(status === 'playing' ? MUSIC_VOL_PLAYING : MUSIC_VOL_IDLE);
    void this.unlock().then(() => {
      this.startMusic();
    });
  }

  playEat(): void {
    if (this.muted) {
      return;
    }
    void this.unlock().then(() => {
      this.blip(880, 0.06, 'square', 0.08);
      this.blip(1320, 0.08, 'square', 0.05, 0.05);
    });
  }

  playDie(): void {
    if (this.muted) {
      return;
    }
    void this.unlock().then(() => {
      this.blip(220, 0.18, 'sawtooth', 0.1);
      this.blip(110, 0.28, 'sawtooth', 0.08, 0.12);
    });
  }

  playPause(): void {
    if (this.muted) {
      return;
    }
    void this.unlock().then(() => {
      this.blip(392, 0.07, 'triangle', 0.05);
    });
  }

  playStart(): void {
    if (this.muted) {
      return;
    }
    void this.unlock().then(() => {
      this.blip(523.25, 0.06, 'square', 0.06);
      this.blip(659.25, 0.08, 'square', 0.06, 0.05);
    });
  }

  playFanfare(): void {
    if (this.muted) {
      return;
    }
    this.stopMusic();
    void this.unlock().then(() => {
      this.startFanfare();
    });
  }

  stopFanfare(): void {
    const wasPlaying = this.fanfarePlaying;
    this.haltFanfare();
    if (wasPlaying && !this.muted) {
      this.startMusic();
    }
  }

  shutdown(): void {
    this.stopMusic();
    this.haltFanfare();
  }

  private haltFanfare(): void {
    this.fanfarePlaying = false;
    if (this.fanfareTimer !== null) {
      window.clearTimeout(this.fanfareTimer);
      this.fanfareTimer = null;
    }
  }

  private listenForGesture(): void {
    if (this.listeningForGesture || typeof window === 'undefined') {
      return;
    }
    this.listeningForGesture = true;
    const kick = () => {
      void this.unlock().then(() => {
        if (!this.muted && !this.fanfarePlaying) {
          this.startMusic();
        }
      });
    };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
  }

  private ensureContext(): AudioContext {
    if (this.ctx) {
      return this.ctx;
    }

    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 1;
    master.connect(ctx.destination);

    const musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_VOL_IDLE;
    musicGain.connect(master);

    const sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.12;
    sfxGain.connect(master);

    this.ctx = ctx;
    this.master = master;
    this.musicGain = musicGain;
    this.sfxGain = sfxGain;
    return ctx;
  }

  private setMusicVolume(value: number): void {
    if (this.musicGain) {
      this.musicGain.gain.value = value;
    }
  }

  private startMusic(): void {
    if (this.musicPlaying || this.muted || this.fanfarePlaying) {
      return;
    }
    const ctx = this.ensureContext();
    if (ctx.state !== 'running') {
      return;
    }
    this.musicPlaying = true;
    this.musicIndex = 0;
    this.scheduleNextNote();
  }

  private stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleNextNote(): void {
    if (!this.musicPlaying || !this.ctx || !this.musicGain) {
      return;
    }

    const note = THEME_LOOP[this.musicIndex % THEME_LOOP.length];
    this.musicIndex += 1;

    const duration = (note.beats * THEME_BEAT_MS) / 1000;
    const hold = duration * 0.92;
    if (note.melody > 0) {
      this.tone(note.melody, hold, 'square', this.musicGain, 0.62);
      this.tone(note.harmony, hold, 'square', this.musicGain, 0.28);
    }
    if (note.bass > 0) {
      this.tone(note.bass, hold, 'triangle', this.musicGain, 0.85);
      this.tone(note.bass * 2, hold, 'triangle', this.musicGain, 0.22);
    }

    this.musicTimer = window.setTimeout(() => {
      this.scheduleNextNote();
    }, note.beats * THEME_BEAT_MS);
  }

  private startFanfare(): void {
    if (this.fanfarePlaying || this.muted) {
      return;
    }
    this.ensureContext();
    this.fanfarePlaying = true;
    this.fanfareIndex = 0;
    this.scheduleNextFanfareNote();
  }

  private scheduleNextFanfareNote(): void {
    if (!this.fanfarePlaying || !this.ctx || !this.musicGain) {
      return;
    }

    const note = FANFARE_LOOP[this.fanfareIndex % FANFARE_LOOP.length];
    this.fanfareIndex += 1;

    const beatMs = 150;
    const duration = (note.beats * beatMs) / 1000;
    this.tone(note.freq, duration * 0.88, 'square', this.musicGain, 1.1);

    this.fanfareTimer = window.setTimeout(() => {
      this.scheduleNextFanfareNote();
    }, note.beats * beatMs);
  }

  private blip(
    freq: number,
    duration: number,
    type: OscillatorType,
    peak = 0.1,
    delay = 0,
  ): void {
    this.ensureContext();
    if (!this.sfxGain) {
      return;
    }
    this.tone(freq, duration, type, this.sfxGain, peak, delay);
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    destination: GainNode,
    peak: number,
    delay = 0,
  ): void {
    const ctx = this.ensureContext();
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(duration, 0.03));
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

export const snakeAudio = new SnakeAudio();
