import {styled} from 'styled-components';

import {gameLevel} from '../game/engine';
import type {GameState, Point} from '../game/types';
import type {
  LeaderboardBoard,
  SubmitRunResponse,
} from '../snakeClient/leaderboard';
import {Leaderboard} from './Leaderboard';

const LCD = {
  bg: '#b7c86a',
  pixel: '#2a3816',
  pixelSoft: 'rgba(42, 56, 22, 0.14)',
  border: '#243214',
};

const Shell = styled.div`
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0) 55%,
      rgba(40, 50, 20, 0.12) 100%
    ),
    ${LCD.bg};
  user-select: none;
  touch-action: none;
  font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
  color: ${LCD.pixel};
`;

const LevelBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  background: rgba(183, 200, 106, 0.9);
  border-bottom: 2px solid ${LCD.border};
  text-transform: uppercase;
`;

const LevelLabel = styled.span`
  font-size: 8px;
  letter-spacing: 0.08em;
`;

const MuteButton = styled.button`
  flex: 0 0 auto;
  border: 2px solid ${LCD.border};
  background: transparent;
  color: ${LCD.pixel};
  font-family: inherit;
  font-size: 8px;
  padding: 6px 8px;
  line-height: 1;
  text-transform: uppercase;

  &:active {
    background: ${LCD.pixelSoft};
  }
`;

const BoardFrame = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
`;

const Board = styled.div<{
  $cols: number;
  $rows: number;
}>`
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  background: ${LCD.bg};
  overflow: hidden;
`;

const Dock = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2;
  background: rgba(183, 200, 106, 0.9);
  border-top: 2px solid ${LCD.border};
`;

const Hud = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 8px 8px 0;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.3;
`;

const Cell = styled.div<{
  $x: number;
  $y: number;
  $cols: number;
  $rows: number;
}>`
  position: absolute;
  left: ${(p) => (p.$x / p.$cols) * 100}%;
  top: ${(p) => (p.$y / p.$rows) * 100}%;
  width: ${(p) => 100 / p.$cols}%;
  height: ${(p) => 100 / p.$rows}%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SnakeBlock = styled.div`
  width: 84%;
  height: 84%;
  background: ${LCD.pixel};
  border-radius: 22%;
`;

const FoodGlyph = styled.div`
  width: 70%;
  height: 70%;
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    background: ${LCD.pixel};
    border-radius: 1px;
  }

  /* vertical petal */
  &::before {
    left: 38%;
    top: 8%;
    width: 24%;
    height: 84%;
  }

  /* horizontal petal */
  &::after {
    left: 8%;
    top: 38%;
    width: 84%;
    height: 24%;
  }
`;

const FoodCenter = styled.div`
  position: absolute;
  inset: 34%;
  background: ${LCD.bg};
  border-radius: 1px;
  z-index: 1;
`;

const HudName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 8px;
  letter-spacing: 0.04em;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(183, 200, 106, 0.82);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
  padding: 16px;
`;

const OverlayHint = styled.span`
  font-size: 7px;
  letter-spacing: 0.04em;
  opacity: 0.85;
  line-height: 1.5;
`;

interface SnakeBoardProps {
  state: GameState;
  playerLabel: string;
  muted: boolean;
  ranked: boolean;
  board: LeaderboardBoard;
  lastSubmit: SubmitRunResponse | null;
  busy: 'start' | 'submit' | null;
  onToggleMute: () => void;
  onPause: () => void;
}

function segmentKey(point: Point, index: number): string {
  return `${point.x}-${point.y}-${index}`;
}

export function SnakeBoard({
  state,
  playerLabel,
  muted,
  ranked,
  board,
  lastSubmit,
  busy,
  onToggleMute,
  onPause,
}: SnakeBoardProps) {
  const {snake, foods, gridWidth, gridHeight, score, status} = state;

  return (
    <Shell>
      <BoardFrame>
        <Board $cols={gridWidth} $rows={gridHeight}>
          {snake.map((segment, index) => (
            <Cell
              key={segmentKey(segment, index)}
              $x={segment.x}
              $y={segment.y}
              $cols={gridWidth}
              $rows={gridHeight}
            >
              <SnakeBlock />
            </Cell>
          ))}
          {foods.map((food, index) => (
            <Cell
              key={`food-${food.x}-${food.y}-${index}`}
              $x={food.x}
              $y={food.y}
              $cols={gridWidth}
              $rows={gridHeight}
            >
              <FoodGlyph>
                <FoodCenter />
              </FoodGlyph>
            </Cell>
          ))}

          {busy ? (
            <Overlay>
              Loading
              <OverlayHint>
                {busy === 'start' ? 'Starting run…' : 'Saving score…'}
              </OverlayHint>
            </Overlay>
          ) : null}
          {!busy && status === 'ready' ? (
            <Overlay>
              Snake
              <OverlayHint>Arrows / WASD to play</OverlayHint>
            </Overlay>
          ) : null}
          {!busy && status === 'paused' ? (
            <Overlay>
              Paused
              <OverlayHint>Space resume · M mute</OverlayHint>
            </Overlay>
          ) : null}
          {!busy && status === 'gameover' ? (
            <Overlay>
              Game over
              <OverlayHint>Score {score}</OverlayHint>
              {lastSubmit ? (
                <OverlayHint>
                  Ranked {lastSubmit.score} · #{lastSubmit.rank}
                </OverlayHint>
              ) : null}
              <OverlayHint>Arrow or Enter to retry</OverlayHint>
            </Overlay>
          ) : null}
        </Board>
      </BoardFrame>

      <LevelBar>
        <LevelLabel>Level {gameLevel(score)}</LevelLabel>
        <MuteButton
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? 'Muted' : 'Sound'}
        </MuteButton>
      </LevelBar>

      <Dock>
        <Hud>
          <span>{score}</span>
          <HudName>{playerLabel}</HudName>
        </Hud>
        <Leaderboard
          board={board}
          ranked={ranked}
          playing={status === 'playing'}
          onPause={onPause}
        />
      </Dock>
    </Shell>
  );
}
