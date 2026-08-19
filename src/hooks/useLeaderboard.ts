import {useCallback, useEffect, useState} from 'react';

import {useErrorBanner} from '../context/ErrorBannerContext';
import {useFrontContext} from '../context/FrontContext';
import type {Direction} from '../game/types';
import {
  isLeaderboardConfigured,
  type LeaderboardBoard,
  type RankedSession,
  type SubmitRunResponse,
} from '../snakeClient/leaderboard';

const EMPTY_BOARD: LeaderboardBoard = {entries: [], you: null};

export function useLeaderboard() {
  const {context, snakeClient} = useFrontContext();
  const {showError} = useErrorBanner();
  const [board, setBoard] = useState<LeaderboardBoard>(EMPTY_BOARD);
  const [lastSubmit, setLastSubmit] = useState<SubmitRunResponse | null>(null);

  const refreshBoard = useCallback(async () => {
    if (!isLeaderboardConfigured()) {
      return;
    }
    try {
      setBoard(await snakeClient.leaderboard.board());
    } catch {
      // board is optional
    }
  }, [snakeClient]);

  useEffect(() => {
    void refreshBoard();
  }, [refreshBoard]);

  const start = useCallback(async (): Promise<RankedSession | null> => {
    if (!isLeaderboardConfigured()) {
      return null;
    }
    setLastSubmit(null);
    try {
      return await snakeClient.leaderboard.start({
        email: context.teammate.email,
        displayName: context.teammate.name?.trim() || context.teammate.email,
      });
    } catch {
      return null;
    }
  }, [context.teammate.email, context.teammate.name, snakeClient]);

  const submit = useCallback(
    (sessionId: string, directions: Direction[]) => {
      void (async () => {
        try {
          const result = await snakeClient.leaderboard.submit(
            sessionId,
            directions,
            context.teammate.name?.trim() || context.teammate.email,
          );
          setLastSubmit(result);
          setBoard(result.board);
        } catch (error) {
          showError(error, 'Score was not accepted.');
        }
      })();
    },
    [context.teammate.email, context.teammate.name, showError, snakeClient],
  );

  return {board, lastSubmit, start, submit};
}
