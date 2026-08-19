import {useState} from 'react';
import {styled} from 'styled-components';

import {SnakeBoard} from '../components/SnakeBoard';
import {useFrontContext} from '../context/FrontContext';
import {GRID_HEIGHT, GRID_WIDTH, type GridSize, LOBBY_LEVEL_ID} from '../game/snakeEngine';
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
  const base = (fromName && fromName.length > 0 ? fromName : fromEmail || 'PLAYER').toUpperCase();
  const cleaned = base.replace(/[^A-Z0-9]/g, '');
  return cleaned.slice(0, 8) || 'PLAYER';
}

function getConversationMeta(context: ReturnType<typeof useFrontContext>['context']): {
  levelId: string;
  levelTitle: string;
  levelSubtitle?: string;
} {
  if (context.type === 'singleConversation' || context.type === 'singleConversationPopover') {
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
  const [gridSize, setGridSize] = useState<GridSize>({gridWidth: GRID_WIDTH, gridHeight: GRID_HEIGHT});
  const {state, muted, toggleMute} = useSnakeGame(levelId, gridSize);
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
        onToggleMute={toggleMute}
        onGridSize={setGridSize}
      />
    </Page>
  );
}
