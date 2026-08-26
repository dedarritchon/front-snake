import {useCallback, useEffect, useState} from 'react';
import {styled} from 'styled-components';

import {snakeAudio} from '../audio/snakeAudio';
import {VersusBoard} from '../components/VersusBoard';
import {useFrontContext} from '../context/FrontContext';
import type {Direction} from '../game/types';
import {useAiMatch} from '../hooks/useAiMatch';

const Page = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #b7c86a;
  overflow: hidden;
`;

function playerName(
  guest: boolean,
  email: string,
  name?: string | null,
): string {
  if (guest) {
    return 'Guest';
  }
  const fromName = name?.trim();
  if (fromName) {
    return fromName;
  }
  return email.split('@')[0] || 'Player';
}

export function VersusAiSession({onSolo}: {onSolo: () => void}) {
  const {context, guest} = useFrontContext();
  const name = playerName(
    guest,
    context?.teammate.email ?? '',
    context?.teammate.name,
  );
  const {
    playerId,
    state,
    players,
    personalView,
    sendDirection,
    sendFire,
    rematch,
  } = useAiMatch(name);
  const [muted, setMuted] = useState(() => snakeAudio.isMuted());

  const toggleMute = useCallback(() => {
    setMuted(snakeAudio.toggleMute());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      let direction: Direction | null = null;
      if (key === 'arrowup' || key === 'w') {
        direction = 'up';
      } else if (key === 'arrowdown' || key === 's') {
        direction = 'down';
      } else if (key === 'arrowleft' || key === 'a') {
        direction = 'left';
      } else if (key === 'arrowright' || key === 'd') {
        direction = 'right';
      }
      if (direction) {
        event.preventDefault();
        sendDirection(direction);
        return;
      }
      if (event.code === 'Space' || key === ' ') {
        event.preventDefault();
        sendFire();
        return;
      }
      if (key === 'm') {
        event.preventDefault();
        toggleMute();
        return;
      }
      if (key === 'enter') {
        event.preventDefault();
        rematch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [rematch, sendDirection, sendFire, toggleMute]);

  return (
    <Page>
      <VersusBoard
        ai
        state={state}
        players={players}
        youId={playerId}
        isHost
        ready={false}
        muted={muted}
        error={null}
        link="connected"
        copied={false}
        roomId=""
        personalView={personalView}
        onToggleMute={toggleMute}
        onCopyId={() => undefined}
        onReady={rematch}
        onSolo={onSolo}
        onChangeColor={() => undefined}
      />
    </Page>
  );
}
