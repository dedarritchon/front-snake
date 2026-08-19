import {describe, expect, it} from 'vitest';

import {DEFAULT_THEME_ID, GAME_THEMES, getTheme} from './themes';

describe('themes', () => {
  it('defaults to Green LCD', () => {
    expect(DEFAULT_THEME_ID).toBe('green-lcd');
    expect(getTheme(null).id).toBe('green-lcd');
    expect(getTheme('missing').id).toBe('green-lcd');
    expect(getTheme('green-lcd').name).toMatch(/green/i);
  });

  it('has unique ids and a playable loop on every theme', () => {
    const ids = GAME_THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const theme of GAME_THEMES) {
      expect(theme.loop.length).toBeGreaterThan(0);
      expect(theme.beatMs).toBeGreaterThan(0);
      expect(theme.loop.every((note) => note.beats > 0)).toBe(true);
    }
  });
});
