import {useCallback, useState} from 'react';

import {
  isSnakeColor,
  loadPreferredColor,
  savePreferredColor,
  type SnakeColor,
} from '../game/snakeColors';

export function usePreferredSnakeColor() {
  const [color, setColor] = useState<SnakeColor>(loadPreferredColor);

  const update = useCallback((next: string) => {
    if (!isSnakeColor(next)) {
      return;
    }
    savePreferredColor(next);
    setColor(next);
  }, []);

  return [color, update] as const;
}
