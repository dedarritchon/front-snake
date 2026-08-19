import {styled} from 'styled-components';

import {SnakeBoard} from '../components/SnakeBoard';
import {useFrontContext} from '../context/FrontContext';
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

function getConversationMeta(
  context: ReturnType<typeof useFrontContext>['context'],
): {
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
  const {context} = useFrontContext();
  const {levelId} = getConversationMeta(context);
  const {board, lastSubmit, start, submit} = useLeaderboard();
  const {state, muted, toggleMute, pause, rankedActive} = useSnakeGame(levelId, {
    start,
    submit,
  });
  const teammate = context.teammate;
  const label = playerName(teammate.email, teammate.name);

  return (
    <Page>
      <SnakeBoard
        state={state}
        playerLabel={label}
        muted={muted}
        ranked={rankedActive}
        board={board}
        lastSubmit={lastSubmit}
        onToggleMute={toggleMute}
        onPause={pause}
      />
    </Page>
  );
}
