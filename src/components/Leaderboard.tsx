import {useEffect, useRef, useState} from 'react';
import {styled} from 'styled-components';

import {snakeAudio} from '../audio/snakeAudio';
import type {LeaderboardBoard, LeaderboardEntry} from '../snakeClient/leaderboard';

const LCD = {
  bg: '#b7c86a',
  pixel: '#2a3816',
  pixelSoft: 'rgba(42, 56, 22, 0.14)',
  border: '#243214',
};

const MEDAL = {
  gold: '#b88914',
  silver: '#7d846c',
  bronze: '#8a4e1f',
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
  padding: 0;
`;

const TitleCopy = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TitleMeta = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const RankHint = styled.span`
  font-size: 6px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
      rgba(0, 0, 0, 0) 48%,
      rgba(40, 50, 20, 0.16) 100%
    ),
    ${LCD.bg};
  color: ${LCD.pixel};
  font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
  padding: 18px 14px 16px;
`;

const ScreenHead = styled.div`
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 2px solid ${LCD.border};
  text-transform: uppercase;
`;

const ScreenTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`;

const ScreenLabel = styled.span`
  font-size: 7px;
  letter-spacing: 0.14em;
  opacity: 0.65;
`;

const ScreenDomain = styled.span`
  font-size: 10px;
  letter-spacing: 0.04em;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Podium = styled.ol`
  flex: 0 0 auto;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PodiumRow = styled.li<{
  $place: 1 | 2 | 3;
}>`
  display: grid;
  grid-template-columns: 22px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border: 2px solid ${LCD.border};
  background: ${(p) =>
    p.$place === 1
      ? 'rgba(184, 137, 20, 0.16)'
      : p.$place === 2
        ? 'rgba(125, 132, 108, 0.16)'
        : 'rgba(138, 78, 31, 0.14)'};
`;

const Rest = styled.ol`
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  border: 2px solid ${LCD.border};
`;

const HeadRow = styled.li`
  display: grid;
  grid-template-columns: 28px 1fr 52px;
  gap: 8px;
  padding: 8px 10px;
  font-size: 6px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.55;
  border-bottom: 2px solid ${LCD.border};
`;

const Row = styled.li<{
  $you?: boolean;
  $podium?: boolean;
}>`
  display: grid;
  grid-template-columns: 28px 1fr 52px;
  gap: 8px;
  align-items: center;
  padding: 9px 10px;
  font-size: 8px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.45;
  opacity: ${(p) => (p.$you ? 1 : 0.88)};
  background: ${(p) => (p.$you && !p.$podium ? 'rgba(42, 56, 22, 0.08)' : 'transparent')};
  border-bottom: 1px solid rgba(36, 50, 20, 0.28);

  &:last-child {
    border-bottom: 0;
  }
`;

const Name = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Score = styled.span`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const Medal = styled.span<{
  $place: 1 | 2 | 3;
}>`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid ${LCD.border};
  background: ${(p) =>
    p.$place === 1 ? MEDAL.gold : p.$place === 2 ? MEDAL.silver : MEDAL.bronze};
  box-shadow: inset 0 0 0 1px rgba(183, 200, 106, 0.35);
  justify-self: center;
`;

const Rank = styled.span`
  text-align: center;
  font-size: 7px;
  opacity: 0.75;
`;

const Empty = styled.p`
  margin: 20px 4px;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.6;
  opacity: 0.7;
  text-align: center;
`;

const YouRow = styled.div`
  flex: 0 0 auto;
  margin-top: 14px;
  padding: 10px;
  border: 2px solid ${LCD.border};
  background: rgba(42, 56, 22, 0.08);
`;

function medalPlace(index: number): 1 | 2 | 3 | null {
  if (index === 0) {
    return 1;
  }
  if (index === 1) {
    return 2;
  }
  if (index === 2) {
    return 3;
  }
  return null;
}

function PodiumCard({
  entry,
  place,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
}) {
  return (
    <PodiumRow $place={place}>
      <Medal $place={place} aria-label={place === 1 ? 'Gold' : place === 2 ? 'Silver' : 'Bronze'} />
      <Name>{entry.display_name}</Name>
      <Score>{entry.best_score}</Score>
    </PodiumRow>
  );
}

export function Leaderboard({
  board,
  playing,
  onPause,
}: {
  board: LeaderboardBoard;
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
    void snakeAudio.unlock().then(() => {
      snakeAudio.playFanfare();
    });
    setFull(true);
  };

  const close = () => {
    snakeAudio.stopFanfare();
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
      snakeAudio.stopFanfare();
    };
  }, [full]);

  const podium = board.entries.slice(0, 3);
  const rest = board.entries.slice(3);

  return (
    <>
      <Wrap>
        <Title>
          <TitleMeta>
            <TitleCopy>{board.domain ?? 'Company'}</TitleCopy>
            <RankHint>
              {board.you ? `You are #${board.you.rank}` : 'Unranked'}
            </RankHint>
          </TitleMeta>
          <GhostButton type="button" onClick={open}>
            Scoreboard
          </GhostButton>
        </Title>
      </Wrap>

      {full ? (
        <Screen>
          <ScreenHead>
            <ScreenTitle>
              <ScreenLabel>Hall of fame</ScreenLabel>
              <ScreenDomain>{board.domain ?? 'Company'}</ScreenDomain>
            </ScreenTitle>
            <GhostButton type="button" onClick={close}>
              Close
            </GhostButton>
          </ScreenHead>

          {board.entries.length === 0 ? (
            <Empty>No scores yet. Eat to win a medal.</Empty>
          ) : (
            <>
              <Podium>
                {podium.map((entry, index) => {
                  const place = medalPlace(index);
                  if (!place) {
                    return null;
                  }
                  return (
                    <PodiumCard
                      key={entry.teammate_email}
                      entry={entry}
                      place={place}
                    />
                  );
                })}
              </Podium>
              {rest.length > 0 ? (
                <Rest>
                  <HeadRow>
                    <span>#</span>
                    <span>Name</span>
                    <Score>Pts</Score>
                  </HeadRow>
                  {rest.map((entry, index) => (
                    <Row
                      key={entry.teammate_email}
                      $you={board.you?.rank === index + 4}
                    >
                      <Rank>{index + 4}</Rank>
                      <Name>{entry.display_name}</Name>
                      <Score>{entry.best_score}</Score>
                    </Row>
                  ))}
                </Rest>
              ) : null}
            </>
          )}

          {board.you ? (
            <YouRow>
              <Row $you $podium>
                <Rank>{board.you.rank}</Rank>
                <Name>You · {board.you.displayName}</Name>
                <Score>{board.you.bestScore}</Score>
              </Row>
            </YouRow>
          ) : null}
        </Screen>
      ) : null}
    </>
  );
}
