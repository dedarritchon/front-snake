import type {WebViewContext} from '@frontapp/plugin-sdk/dist/webViewSdkTypes';
import {useState} from 'react';
import {styled} from 'styled-components';

import {SnakeBoard} from '../components/SnakeBoard';
import {VersusSession} from '../components/VersusSession';
import {useFrontContext} from '../context/FrontContext';
import {
  createRoomId,
  isRoomId,
  normalizeRoomId,
} from '../game/multiplayerEngine';
import {LOBBY_LEVEL_ID} from '../game/snakeEngine';
import {useLeaderboard} from '../hooks/useLeaderboard';
import {useSnakeGame} from '../hooks/useSnakeGame';

const Page = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #b7c86a;
  overflow: hidden;
`;

function playerName(email: string, name?: string | null): string {
  const fromName = name?.trim();
  if (fromName) {
    return fromName;
  }
  return email.split('@')[0] || 'Player';
}

function getConversationMeta(context: WebViewContext): {
  levelId: string;
  levelTitle: string;
  levelSubtitle?: string;
} {
  if (
    context.type === 'singleConversation' ||
    context.type === 'singleConversationPopover'
  ) {
    const {conversation} = context;
    const subject = conversation.subject?.trim();
    return {
      levelId: conversation.id,
      levelTitle: conversation.id,
      levelSubtitle: subject
        ? `${conversation.status} · ${subject}`
        : `${conversation.status} · ${conversation.type}`,
    };
  }

  return {
    levelId: LOBBY_LEVEL_ID,
    levelTitle: 'NO CONVERSATION',
    levelSubtitle: 'Open a conversation to start a level',
  };
}

type VersusFlow =
  | {kind: 'setup'}
  | {kind: 'room'; roomId: string; host: boolean};

function RankedHome({
  versusSetup,
  joinError,
  onVersus,
  onCreateRoom,
  onJoinRoom,
  onCancelVersus,
}: {
  versusSetup: boolean;
  joinError: string | null;
  onVersus: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onCancelVersus: () => void;
}) {
  const {context, guest} = useFrontContext();
  const {levelId} = context
    ? getConversationMeta(context)
    : {levelId: LOBBY_LEVEL_ID};
  const {board, lastSubmit, start, submit, busy} = useLeaderboard();
  const {state, muted, toggleMute, pause} = useSnakeGame(levelId, {
    start,
    submit,
    locked: busy !== null || versusSetup,
  });
  const label = guest
    ? 'Guest'
    : playerName(context?.teammate.email ?? '', context?.teammate.name);

  return (
    <Page>
      <SnakeBoard
        state={state}
        playerLabel={label}
        guest={guest}
        muted={muted}
        board={board}
        lastSubmit={lastSubmit}
        busy={busy}
        versusSetup={versusSetup}
        joinError={joinError}
        onToggleMute={toggleMute}
        onPause={pause}
        onVersus={onVersus}
        onCreateRoom={onCreateRoom}
        onJoinRoom={onJoinRoom}
        onCancelVersus={onCancelVersus}
      />
    </Page>
  );
}

export function Home() {
  const [versus, setVersus] = useState<VersusFlow | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  if (versus?.kind === 'room') {
    return (
      <VersusSession
        roomId={versus.roomId}
        claimHost={versus.host}
        onSolo={() => {
          setVersus(null);
          setJoinError(null);
        }}
      />
    );
  }

  return (
    <RankedHome
      versusSetup={versus?.kind === 'setup'}
      joinError={joinError}
      onVersus={() => {
        setJoinError(null);
        setVersus({kind: 'setup'});
      }}
      onCreateRoom={() => {
        setJoinError(null);
        setVersus({kind: 'room', roomId: createRoomId(), host: true});
      }}
      onJoinRoom={(raw) => {
        const roomId = normalizeRoomId(raw);
        if (!isRoomId(roomId)) {
          setJoinError('Enter a room id');
          return;
        }
        setJoinError(null);
        setVersus({kind: 'room', roomId, host: false});
      }}
      onCancelVersus={() => {
        setVersus(null);
        setJoinError(null);
      }}
    />
  );
}
