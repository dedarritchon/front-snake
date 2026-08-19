import {useCallback, useEffect, useState} from 'react';
import {useLocation, useNavigate, useParams} from 'react-router';
import {styled} from 'styled-components';

import {snakeAudio} from '../audio/snakeAudio';
import {VersusBoard} from '../components/VersusBoard';
import {PATHS} from '../constants/paths';
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

function roomHref(roomId: string): string {
  const url = new URL(window.location.href);
  url.hash = `#/room/${roomId}`;
  return url.toString();
}

export function Room() {
  const {roomId = ''} = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {context, guest} = useFrontContext();
  const claimHost = (location.state as {host?: boolean} | null)?.host === true;
  const name = playerName(
    guest,
    context?.teammate.email ?? '',
    context?.teammate.name,
  );
  const {
    playerId,
    state,
    isHost,
    error,
    connected,
    sendDirection,
    startMatch,
  } = useMultiplayerRoom(roomId, name, claimHost);
  const [muted, setMuted] = useState(() => snakeAudio.isMuted());
  const [copied, setCopied] = useState(false);

  const toggleMute = useCallback(() => {
    const next = snakeAudio.toggleMute();
    setMuted(next);
  }, []);

  const copyLink = useCallback(() => {
    const href = roomHref(roomId);
    void navigator.clipboard.writeText(href).then(
      () => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1600);
      },
      () => {
        window.prompt('Copy room link', href);
      },
    );
  }, [roomId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
        startMatch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sendDirection, startMatch, toggleMute]);

  return (
    <Page>
      <VersusBoard
        state={state}
        youId={playerId}
        isHost={isHost}
        muted={muted}
        error={error}
        connected={connected}
        copied={copied}
        roomUrl={roomHref(roomId)}
        onToggleMute={toggleMute}
        onCopyLink={copyLink}
        onStart={startMatch}
        onSolo={() => {
          void navigate(PATHS.home);
        }}
      />
    </Page>
  );
}
