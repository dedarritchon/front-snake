import type {WebViewContext} from '@frontapp/plugin-sdk/dist/webViewSdkTypes';
import {useNavigate} from 'react-router';
import {styled} from 'styled-components';

import {SnakeBoard} from '../components/SnakeBoard';
import {useFrontContext} from '../context/FrontContext';
import {createRoomId} from '../game/multiplayerEngine';
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

export function Home() {
  const navigate = useNavigate();
  const {context, guest} = useFrontContext();
  const {levelId} = context
    ? getConversationMeta(context)
    : {levelId: LOBBY_LEVEL_ID};
  const {board, lastSubmit, start, submit, busy} = useLeaderboard();
  const {state, muted, toggleMute, pause} = useSnakeGame(levelId, {
    start,
    submit,
    locked: busy !== null,
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
        onToggleMute={toggleMute}
        onPause={pause}
        onVersus={() => {
          void navigate(`/room/${createRoomId()}`, {state: {host: true}});
        }}
      />
    </Page>
  );
}
