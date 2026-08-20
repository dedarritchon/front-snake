import {useCallback, useEffect, useState} from 'react';
import {styled} from 'styled-components';

import {snakeAudio} from '../audio/snakeAudio';
import {VersusBoard} from '../components/VersusBoard';
import {useFrontContext} from '../context/FrontContext';
import type {Direction} from '../game/types';
import {useMultiplayerRoom} from '../hooks/useMultiplayerRoom';

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

export function VersusSession({
  roomId,
  claimHost,
  onSolo,
}: {
  roomId: string;
  claimHost: boolean;
  onSolo: () => void;
}) {
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
    isHost,
    ready,
    error,
    link,
    personalView,
    sendDirection,
    toggleReady,
  } = useMultiplayerRoom(roomId, name, claimHost);
  const [muted, setMuted] = useState(() => snakeAudio.isMuted());
  const [copied, setCopied] = useState(false);

  const toggleMute = useCallback(() => {
    const next = snakeAudio.toggleMute();
    setMuted(next);
  }, []);

  const copyId = useCallback(() => {
    void navigator.clipboard.writeText(roomId).then(
      () => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1600);
      },
      () => {
        window.prompt('Copy room id', roomId);
      },
    );
  }, [roomId]);

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
      if (key === 'm') {
        event.preventDefault();
        toggleMute();
        return;
      }
      if (key === 'enter') {
        event.preventDefault();
        toggleReady();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sendDirection, toggleMute, toggleReady]);

  return (
    <Page>
      <VersusBoard
        state={state}
        players={players}
        youId={playerId}
        isHost={isHost}
        ready={ready}
        muted={muted}
        error={error}
        link={link}
        copied={copied}
        roomId={roomId}
        personalView={personalView}
        onToggleMute={toggleMute}
        onCopyId={copyId}
        onReady={toggleReady}
        onSolo={onSolo}
      />
    </Page>
  );
}
