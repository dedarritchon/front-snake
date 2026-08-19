import {styled} from 'styled-components';

import type {LeaderboardBoard} from '../snakeClient/leaderboard';

const LCD = {
  pixel: '#2a3816',
  border: '#243214',
};

const Wrap = styled.div`
  flex: 0 0 auto;
  padding: 0 8px 8px;
  border-top: 2px solid ${LCD.border};
`;

const Title = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
  padding: 8px 0 6px;
`;

const List = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 64px;
  overflow: auto;
`;

const Row = styled.li<{
  $you?: boolean;
}>`
  display: grid;
  grid-template-columns: 18px 1fr 36px;
  gap: 6px;
  font-size: 7px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: ${(p) => (p.$you ? 1 : 0.85)};
`;

function tag(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8)
      .toUpperCase() || 'PLAYER'
  );
}

export function Leaderboard({
  board,
  ranked,
}: {
  board: LeaderboardBoard;
  ranked: boolean;
}) {
  return (
    <Wrap>
      <Title>
        <span>{board.domain ?? 'Company'}</span>
        <span>{ranked ? 'Ranked' : 'Local'}</span>
      </Title>
      <List>
        {board.entries.length === 0 ? <Row>No scores yet</Row> : null}
        {board.entries.map((entry, index) => (
          <Row key={entry.teammate_email}>
            <span>{index + 1}</span>
            <span>{tag(entry.display_name)}</span>
            <span>{entry.best_score}</span>
          </Row>
        ))}
      </List>
      {board.you ? (
        <Row $you>
          <span>{board.you.rank}</span>
          <span>You</span>
          <span>{board.you.bestScore}</span>
        </Row>
      ) : null}
    </Wrap>
  );
}
