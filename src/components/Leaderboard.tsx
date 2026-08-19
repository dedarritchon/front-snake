import {useEffect, useRef, useState} from 'react';
import {styled} from 'styled-components';

import type {LeaderboardBoard} from '../snakeClient/leaderboard';

const LCD = {
  bg: '#b7c86a',
  pixel: '#2a3816',
  pixelSoft: 'rgba(42, 56, 22, 0.14)',
  border: '#243214',
};

const Wrap = styled.div`
  flex: 0 0 auto;
  padding: 6px 8px 8px;
`;

const Title = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 1;
  padding: 0;
`;

const TitleCopy = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const List = styled.ol<{
  $full?: boolean;
}>`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${(p) => (p.$full ? '8px' : '4px')};
  max-height: ${(p) => (p.$full ? 'none' : '48px')};
  overflow: auto;
  flex: ${(p) => (p.$full ? '1 1 auto' : '0 0 auto')};
  min-height: 0;
`;

const Row = styled.li<{
  $you?: boolean;
  $full?: boolean;
}>`
  display: grid;
  grid-template-columns: ${(p) => (p.$full ? '28px 1fr 48px' : '18px 1fr 36px')};
  gap: 6px;
  font-size: ${(p) => (p.$full ? '9px' : '7px')};
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.4;
  opacity: ${(p) => (p.$you ? 1 : 0.85)};
`;

const Name = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const GhostButton = styled.button`
  flex: 0 0 auto;
  border: 2px solid ${LCD.border};
  background: transparent;
  color: ${LCD.pixel};
  font-family: inherit;
  font-size: 7px;
  padding: 6px 8px;
  line-height: 1;
  text-transform: uppercase;

  &:active {
    background: ${LCD.pixelSoft};
  }
`;

const Screen = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0) 55%,
      rgba(40, 50, 20, 0.12) 100%
    ),
    ${LCD.bg};
  color: ${LCD.pixel};
  font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
  padding: 12px;
`;

const ScreenHead = styled.div`
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 2px solid ${LCD.border};
  text-transform: uppercase;
`;

const ScreenTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

const ScreenLabel = styled.span`
  font-size: 8px;
  letter-spacing: 0.08em;
  opacity: 0.7;
`;

const ScreenDomain = styled.span`
  font-size: 9px;
  letter-spacing: 0.02em;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const YouRow = styled.div`
  flex: 0 0 auto;
  padding-top: 10px;
  border-top: 2px solid ${LCD.border};
`;

function BoardRows({
  board,
}: {
  board: LeaderboardBoard;
}) {
  return (
    <>
      {board.entries.length === 0 ? (
        <Row $full>No scores yet</Row>
      ) : null}
      {board.entries.map((entry, index) => (
        <Row key={entry.teammate_email} $full>
          <span>{index + 1}</span>
          <Name>{entry.display_name}</Name>
          <span>{entry.best_score}</span>
        </Row>
      ))}
    </>
  );
}

export function Leaderboard({
  board,
  ranked,
  playing,
  onPause,
}: {
  board: LeaderboardBoard;
  ranked: boolean;
  playing: boolean;
  onPause: () => void;
}) {
  const [full, setFull] = useState(false);
  const resumeOnClose = useRef(false);

  const open = () => {
    if (playing) {
      onPause();
      resumeOnClose.current = true;
    }
    setFull(true);
  };

  const close = () => {
    setFull(false);
    if (resumeOnClose.current) {
      onPause();
      resumeOnClose.current = false;
    }
  };

  useEffect(() => {
    if (!full) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
    };
  }, [full]);

  return (
    <>
      <Wrap>
        <Title>
          <TitleCopy>{board.domain ?? 'Company'}</TitleCopy>
          <GhostButton type="button" onClick={open}>
            Scoreboard
          </GhostButton>
        </Title>
      </Wrap>

      {full ? (
        <Screen>
          <ScreenHead>
            <ScreenTitle>
              <ScreenLabel>Scoreboard</ScreenLabel>
              <ScreenDomain>{board.domain ?? 'Company'}</ScreenDomain>
              <ScreenLabel>{ranked ? 'Ranked' : 'Local'}</ScreenLabel>
            </ScreenTitle>
            <GhostButton type="button" onClick={close}>
              Close
            </GhostButton>
          </ScreenHead>
          <List $full>
            <BoardRows board={board} />
          </List>
          {board.you ? (
            <YouRow>
              <Row $you $full>
                <span>{board.you.rank}</span>
                <Name>You · {board.you.displayName}</Name>
                <span>{board.you.bestScore}</span>
              </Row>
            </YouRow>
          ) : null}
        </Screen>
      ) : null}
    </>
  );
}
