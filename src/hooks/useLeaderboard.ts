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

const EMPTY_BOARD: LeaderboardBoard = {domain: null, entries: [], you: null};

export function useLeaderboard() {
  const {context, guest, snakeClient} = useFrontContext();
  const {showError} = useErrorBanner();
  const [board, setBoard] = useState<LeaderboardBoard>(EMPTY_BOARD);
  const [lastSubmit, setLastSubmit] = useState<SubmitRunResponse | null>(null);

  const [busy, setBusy] = useState<'start' | 'submit' | null>(null);
  const email = guest ? '' : (context?.teammate.email ?? '');
  const displayName =
    context?.teammate.name?.trim() || email;

  const refreshBoard = useCallback(async () => {
    if (!isLeaderboardConfigured() || email === '') {
      return;
    }
    try {
      setBoard(await snakeClient.leaderboard.board(email));
    } catch {
      // board is optional
    }
  }, [email, snakeClient]);

  useEffect(() => {
    void refreshBoard();
  }, [refreshBoard]);

  const start = useCallback(async (): Promise<RankedSession | null> => {
    if (!isLeaderboardConfigured() || email === '') {
      return null;
    }
    setLastSubmit(null);
    setBusy('start');
    try {
      return await snakeClient.leaderboard.start({
        email,
        displayName,
      });
    } catch {
      return null;
    } finally {
      setBusy(null);
    }
  }, [displayName, email, snakeClient]);

  const submit = useCallback(
    (sessionId: string, directions: Direction[]) => {
      void (async () => {
        setBusy('submit');
        try {
          const result = await snakeClient.leaderboard.submit(
            sessionId,
            directions,
            displayName,
          );
          setLastSubmit(result);
          setBoard(result.board);
        } catch (error) {
          showError(error, 'Score was not accepted.');
        } finally {
          setBusy(null);
        }
      })();
    },
    [displayName, email, showError, snakeClient],
  );

  return {board, lastSubmit, start, submit, busy};
}
