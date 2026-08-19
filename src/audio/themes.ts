export interface ThemeNote {
  melody: number;
  harmony: number;
  bass: number;
  beats: number;
}

export interface GameTheme {
  id: string;
  name: string;
  blurb: string;
  beatMs: number;
  hold: number;
  loop: ThemeNote[];
}

const D2 = 73.42;
const E2 = 82.41;
const G2 = 98.0;
const A2 = 110.0;
const B2 = 123.47;
const C3 = 130.81;
const D3 = 146.83;
const E3 = 164.81;
const F3 = 174.61;
const G3 = 196.0;
const A3 = 220.0;
const Bb3 = 233.08;
const B3 = 246.94;
const C4 = 261.63;
const D4 = 293.66;
const Eb4 = 311.13;
const E4 = 329.63;
const F4 = 349.23;
const Fs4 = 369.99;
const G4 = 392.0;
const Ab4 = 415.3;
const A4 = 440.0;
const Bb4 = 466.16;
const B4 = 493.88;
const C5 = 523.25;
const Cs5 = 554.37;
const D5 = 587.33;
const E5 = 659.25;
const F5 = 698.46;
const Fs5 = 739.99;
const G5 = 783.99;
const A5 = 880.0;
const B5 = 987.77;
const C6 = 1046.5;

function v(melody: number, bass: number, beats: number, harmony = 0): ThemeNote {
  return {melody, harmony, bass, beats};
}

export const DEFAULT_THEME_ID = 'green-lcd';

export const GAME_THEMES: GameTheme[] = [
  {
    id: 'meadow-call',
    name: 'Meadow Call',
    blurb: 'Spacious overworld — long notes, room to breathe',
    beatMs: 270,
    hold: 0.96,
    loop: [
      v(D5, D3, 2),
      v(A4, D3, 2),
      v(Fs5, D3, 4, D5),
      v(E5, A2, 2),
      v(D5, A2, 1),
      v(Cs5, A2, 1),
      v(D5, D3, 4, A4),
      v(B4, G2, 2),
      v(G4, G2, 2),
      v(A4, A2, 4),
      v(D5, D3, 6, A4),
      v(0, D3, 2),
      v(Fs5, G3, 2),
      v(G5, G3, 2),
      v(A5, D3, 4, Fs5),
      v(G5, A2, 2),
      v(Fs5, A2, 2),
      v(E5, A2, 4),
      v(D5, D3, 2),
      v(Cs5, A2, 2),
      v(D5, D3, 8, A4),
    ],
  },
  {
    id: 'stacked-brass',
    name: 'Stacked Brass',
    blurb: 'The current theme — busy three-voice fanfare',
    beatMs: 240,
    hold: 0.92,
    loop: [
      v(D5, D3, 2, A4),
      v(A4, D3, 1, Fs4),
      v(D5, A3, 1, A4),
      v(Fs5, D3, 4, D5),
      v(A5, D3, 2, Fs5),
      v(Fs5, D3, 1, D5),
      v(E5, A3, 1, Cs5),
      v(D5, D3, 4, A4),
      v(B4, G3, 2, G4),
      v(Cs5, G3, 2, A4),
      v(D5, D3, 2, B4),
      v(Fs5, G3, 2, D5),
      v(E5, A3, 4, Cs5),
      v(A4, A3, 4, E4),
      v(G5, G3, 2, D5),
      v(Fs5, G3, 2, D5),
      v(E5, E3, 2, B4),
      v(D5, D3, 2, A4),
      v(Cs5, A3, 2, A4),
      v(D5, A3, 2, A4),
      v(E5, E3, 2, Cs5),
      v(Fs5, A3, 2, D5),
      v(G5, G3, 2, E5),
      v(E5, E3, 2, Cs5),
      v(Cs5, A3, 2, A4),
      v(A4, A3, 2, E4),
      v(D5, D3, 6, A4),
      v(0, D3, 2),
      v(Fs4, B3, 2, D4),
      v(G4, B3, 2, D4),
      v(A4, D3, 2, Fs4),
      v(B4, G3, 2, G4),
      v(A4, D3, 3, Fs4),
      v(Fs4, D3, 1, D4),
      v(D4, D3, 4, A3),
    ],
  },
  {
    id: 'green-lcd',
    name: 'Green LCD',
    blurb: 'Nokia-ish snake jingle — catchy and tiny',
    beatMs: 155,
    hold: 0.82,
    loop: [
      v(E5, C3, 1),
      v(D5, C3, 1),
      v(C5, G2, 1),
      v(D5, G2, 1),
      v(E5, C3, 1),
      v(E5, C3, 1),
      v(E5, C3, 2),
      v(D5, G2, 1),
      v(D5, G2, 1),
      v(D5, G2, 2),
      v(E5, C3, 1),
      v(G5, E3, 1),
      v(G5, G3, 2),
      v(E5, C3, 1),
      v(D5, G2, 1),
      v(C5, C3, 1),
      v(D5, G2, 1),
      v(E5, C3, 1),
      v(E5, C3, 1),
      v(E5, C3, 1),
      v(E5, C3, 1),
      v(D5, G2, 1),
      v(D5, G2, 1),
      v(E5, C3, 1),
      v(D5, G2, 1),
      v(C5, C3, 4),
    ],
  },
  {
    id: 'stone-hall',
    name: 'Stone Hall',
    blurb: 'Dungeon — hollow fifths, slow and a bit ominous',
    beatMs: 310,
    hold: 0.98,
    loop: [
      v(D4, D2, 4, A4),
      v(A4, D3, 4, D4),
      v(C5, F3, 2, F4),
      v(Bb4, F3, 2, F4),
      v(A4, D3, 4, D4),
      v(G4, C3, 4, C4),
      v(A4, D3, 8, D4),
      v(F4, Bb3, 4, Bb3),
      v(G4, C3, 4, C4),
      v(A4, D3, 2, D4),
      v(C5, F3, 2, F4),
      v(D5, D3, 8, A4),
      v(0, D2, 4),
    ],
  },
  {
    id: 'moon-well',
    name: 'Moon Well',
    blurb: 'Lullaby waltz — pentatonic, gentle 3/4',
    beatMs: 210,
    hold: 0.97,
    loop: [
      v(E5, G3, 2),
      v(G5, G3, 2),
      v(E5, G3, 2),
      v(D5, E3, 4),
      v(B4, E3, 2),
      v(A4, C3, 6),
      v(G4, G2, 6),
      v(E5, C3, 2),
      v(D5, C3, 2),
      v(B4, G2, 2),
      v(A4, A2, 4),
      v(G4, A2, 2),
      v(E4, E2, 6),
      v(G4, G2, 6),
    ],
  },
  {
    id: 'circuit-run',
    name: 'Circuit Run',
    blurb: 'Arcade chase — fast minor arpeggios',
    beatMs: 125,
    hold: 0.52,
    loop: [
      v(A4, A2, 1),
      v(C5, A2, 1),
      v(E5, E3, 1),
      v(A5, A2, 1),
      v(G5, G2, 1),
      v(E5, G2, 1),
      v(C5, C3, 1),
      v(A4, A2, 1),
      v(B4, E3, 1),
      v(D5, E3, 1),
      v(F5, F3, 1),
      v(E5, E3, 1),
      v(D5, D3, 1),
      v(C5, C3, 1),
      v(B4, E3, 1),
      v(A4, A2, 1),
      v(C5, A2, 1),
      v(E5, A2, 1),
      v(A5, A3, 1),
      v(C6, A2, 1),
      v(B5, G2, 1),
      v(G5, G2, 1),
      v(E5, E3, 1),
      v(C5, C3, 1),
      v(A4, A2, 2),
      v(E4, E2, 2),
      v(A4, A2, 4),
    ],
  },
  {
    id: 'reed-jig',
    name: 'Reed Jig',
    blurb: 'Forest 6/8 — bouncing pipe tune',
    beatMs: 145,
    hold: 0.78,
    loop: [
      v(D5, D3, 1),
      v(A4, D3, 1),
      v(D5, D3, 1),
      v(E5, A2, 1),
      v(A4, A2, 1),
      v(E5, A2, 1),
      v(Fs5, D3, 1),
      v(D5, D3, 1),
      v(A4, A2, 1),
      v(D5, D3, 3),
      v(G5, G3, 1),
      v(Fs5, G3, 1),
      v(E5, G3, 1),
      v(Fs5, D3, 1),
      v(E5, D3, 1),
      v(D5, D3, 1),
      v(Cs5, A2, 1),
      v(A4, A2, 1),
      v(Cs5, A2, 1),
      v(D5, D3, 3),
      v(A4, D3, 1),
      v(Fs4, D3, 1),
      v(A4, D3, 1),
      v(D5, D3, 6),
    ],
  },
  {
    id: 'apple-march',
    name: 'Apple March',
    blurb: 'Dotted parade — staccato and proud',
    beatMs: 175,
    hold: 0.62,
    loop: [
      v(D5, D3, 3),
      v(D5, D3, 1),
      v(D5, D3, 2),
      v(A4, A2, 2),
      v(Fs5, D3, 3),
      v(E5, A2, 1),
      v(D5, D3, 4),
      v(G5, G3, 3),
      v(Fs5, G3, 1),
      v(E5, C3, 2),
      v(D5, G2, 2),
      v(Cs5, A2, 2),
      v(E5, A2, 2),
      v(A4, A2, 4),
      v(D5, D3, 3),
      v(Fs5, D3, 1),
      v(A5, D3, 2),
      v(Fs5, A2, 2),
      v(D5, D3, 8),
    ],
  },
  {
    id: 'night-crawl',
    name: 'Night Crawl',
    blurb: 'Sneaky snake — chromatic, low, a little weird',
    beatMs: 200,
    hold: 0.88,
    loop: [
      v(E4, E2, 2),
      v(F4, E2, 1),
      v(E4, E2, 1),
      v(Eb4, B2, 2),
      v(E4, E2, 2),
      v(A4, A2, 2),
      v(G4, E2, 2),
      v(E4, E2, 4),
      v(F4, F3, 2),
      v(Ab4, F3, 2),
      v(G4, E3, 2),
      v(E4, E2, 2),
      v(B3, B2, 4),
      v(E4, E2, 4),
      v(C5, A2, 2),
      v(B4, E3, 2),
      v(A4, A2, 2),
      v(G4, E2, 2),
      v(F4, B2, 2),
      v(E4, E2, 6),
      v(0, E2, 2),
    ],
  },
  {
    id: 'crystal-title',
    name: 'Crystal Title',
    blurb: 'RPG title screen — rising shine, then resolve',
    beatMs: 250,
    hold: 0.94,
    loop: [
      v(C5, C3, 2),
      v(E5, C3, 2),
      v(G5, G3, 2),
      v(C6, C3, 6, G5),
      v(B5, G3, 2),
      v(A5, F3, 2),
      v(G5, C3, 2),
      v(E5, C3, 2),
      v(F5, F3, 2),
      v(A5, F3, 2),
      v(G5, G3, 2),
      v(E5, C3, 2),
      v(C5, C3, 8, G4),
      v(D5, G2, 2),
      v(E5, G2, 2),
      v(F5, F3, 2),
      v(G5, G3, 2),
      v(E5, C3, 4),
      v(C5, C3, 8, G4),
    ],
  },
];

export function getTheme(id: string | null | undefined): GameTheme {
  return (
    GAME_THEMES.find((theme) => theme.id === id) ??
    GAME_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) ??
    GAME_THEMES[0]
  );
}
