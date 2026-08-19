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

function playerTag(email: string, name?: string | null): string {
  const fromName = name?.trim();
  const fromEmail = email.split('@')[0];
  const base = (
    fromName && fromName.length > 0 ? fromName : fromEmail || 'PLAYER'
  ).toUpperCase();
  const cleaned = base.replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, 8) || 'PLAYER';
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
  const {levelId, levelTitle, levelSubtitle} = getConversationMeta(context);
  const {board, lastSubmit, start, submit} = useLeaderboard();
  const {state, muted, toggleMute, rankedActive} = useSnakeGame(levelId, {
    start,
    submit,
  });
  const teammate = context.teammate;
  const label = playerTag(teammate.email, teammate.name);

  return (
    <Page>
      <SnakeBoard
        state={state}
        levelTitle={levelTitle}
        levelSubtitle={levelSubtitle}
        playerLabel={label}
        muted={muted}
        ranked={rankedActive}
        board={board}
        lastSubmit={lastSubmit}
        onToggleMute={toggleMute}
      />
    </Page>
  );
}
