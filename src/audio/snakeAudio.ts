import type {GameStatus} from '../game/types';

const MUTE_KEY = 'front-snake-muted';

interface Note {
  freq: number;
  beats: number;
}

/** Short Nokia-ish chiptune loop (approx). */
const MUSIC_LOOP: Note[] = [
  {freq: 659.25, beats: 1}, // E5
  {freq: 587.33, beats: 1}, // D5
  {freq: 523.25, beats: 1}, // C5
  {freq: 587.33, beats: 1}, // D5
  {freq: 659.25, beats: 1}, // E5
  {freq: 659.25, beats: 1},
  {freq: 659.25, beats: 2},
  {freq: 587.33, beats: 1}, // D5
  {freq: 587.33, beats: 1},
  {freq: 587.33, beats: 2},
  {freq: 659.25, beats: 1}, // E5
  {freq: 783.99, beats: 1}, // G5
  {freq: 783.99, beats: 2},
  {freq: 659.25, beats: 1},
  {freq: 587.33, beats: 1},
  {freq: 523.25, beats: 1},
  {freq: 587.33, beats: 1},
  {freq: 659.25, beats: 1},
  {freq: 659.25, beats: 1},
  {freq: 659.25, beats: 1},
  {freq: 659.25, beats: 1},
  {freq: 587.33, beats: 1},
  {freq: 587.33, beats: 1},
  {freq: 659.25, beats: 1},
  {freq: 587.33, beats: 1},
  {freq: 523.25, beats: 4},
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

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
    if (muted) {
      this.stopMusic();
      this.stopFanfare();
    }
    if (this.master) {
      this.master.gain.value = muted ? 0 : 1;
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  syncStatus(status: GameStatus): void {
    if (this.muted) {
      this.stopMusic();
      this.stopFanfare();
      return;
    }
    if (status === 'playing') {
      void this.unlock().then(() => {
        this.startMusic();
      });
      return;
    }
    this.stopMusic();
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
    this.fanfarePlaying = false;
    if (this.fanfareTimer !== null) {
      window.clearTimeout(this.fanfareTimer);
      this.fanfareTimer = null;
    }
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
    musicGain.gain.value = 0.045;
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

  private startMusic(): void {
    if (this.musicPlaying || this.muted) {
      return;
    }
    this.ensureContext();
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

    const note = MUSIC_LOOP[this.musicIndex % MUSIC_LOOP.length];
    this.musicIndex += 1;

    const beatMs = 160;
    const duration = (note.beats * beatMs) / 1000;
    this.tone(note.freq, duration * 0.85, 'square', this.musicGain, 0.7);

    this.musicTimer = window.setTimeout(() => {
      this.scheduleNextNote();
    }, note.beats * beatMs);
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
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(duration, 0.03));
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}

export const snakeAudio = new SnakeAudio();
