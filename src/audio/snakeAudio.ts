import type {Direction, GameStatus} from '../game/types';
import {
  DEFAULT_THEME_ID,
  type GameTheme,
  getTheme,
} from './themes';

interface Note {
  freq: number;
  beats: number;
}

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

const MUSIC_VOL_IDLE = 0.07;
const MUSIC_VOL_PLAYING = 0.042;

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
  private muted = false;
  private listeningForGesture = false;
  private selectorMode = false;
  private committedThemeId = DEFAULT_THEME_ID;
  private previewThemeId: string | null = null;

  committedId(): string {
    return this.committedThemeId;
  }

  enterSelector(): void {
    this.selectorMode = true;
    this.previewThemeId = null;
    this.stopMusic();
    this.haltFanfare();
    if (this.master) {
      this.master.gain.value = 1;
    }
  }

  leaveSelector(): void {
    this.selectorMode = false;
    this.previewThemeId = null;
    this.stopMusic();
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : 1;
    }
  }

  previewTheme(id: string): void {
    this.previewThemeId = id;
    this.stopMusic();
    void this.unlock().then(() => {
      this.startMusic();
    });
  }

  stopPreview(): void {
    this.stopMusic();
  }

  commitTheme(id: string): void {
    this.committedThemeId = id;
    this.previewThemeId = id;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
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

  playMove(direction: Direction): void {
    if (this.muted) {
      return;
    }
    const freq = {
      up: 784.0,
      down: 330.0,
      left: 440.0,
      right: 587.0,
    }[direction];
    void this.unlock().then(() => {
      this.blip(freq, 0.045, 'square', 0.045);
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
      if (this.selectorMode) {
        void this.unlock();
        return;
      }
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

  private currentTheme(): GameTheme {
    return getTheme(this.previewThemeId ?? this.committedThemeId);
  }

  private startMusic(): void {
    if (this.musicPlaying || this.fanfarePlaying) {
      return;
    }
    if (this.muted && !this.selectorMode) {
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

    const theme = this.currentTheme();
    const note = theme.loop[this.musicIndex % theme.loop.length];
    this.musicIndex += 1;

    const duration = (note.beats * theme.beatMs) / 1000;
    const hold = duration * theme.hold;
    if (note.melody > 0) {
      this.tone(note.melody, hold, 'square', this.musicGain, 0.62);
      if (note.harmony > 0) {
        this.tone(note.harmony, hold, 'square', this.musicGain, 0.28);
      }
    }
    if (note.bass > 0) {
      this.tone(note.bass, hold, 'triangle', this.musicGain, 0.85);
      this.tone(note.bass * 2, hold, 'triangle', this.musicGain, 0.22);
    }

    this.musicTimer = window.setTimeout(() => {
      this.scheduleNextNote();
    }, note.beats * theme.beatMs);
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
