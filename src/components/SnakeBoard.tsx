import {styled} from 'styled-components';

import {gameLevel} from '../game/engine';
import {frontLogoBait, frontLogoCells} from '../game/logo';
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
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
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
  display: grid;
  place-items: center;
  padding: 6px;
  container-type: size;
`;

const Board = styled.div<{
  $cols: number;
  $rows: number;
}>`
  position: relative;
  box-sizing: border-box;
  aspect-ratio: ${(p) => p.$cols} / ${(p) => p.$rows};
  width: min(100cqw, calc(100cqh * ${(p) => p.$cols} / ${(p) => p.$rows}));
  height: min(100cqh, calc(100cqw * ${(p) => p.$rows} / ${(p) => p.$cols}));
  border: 2px solid ${LCD.border};
  background-color: ${LCD.bg};
  background-image:
    linear-gradient(
      to right,
      rgba(42, 56, 22, 0.12) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      rgba(42, 56, 22, 0.12) 1px,
      transparent 1px
    );
  background-size: ${(p) => 100 / p.$cols}% ${(p) => 100 / p.$rows}%;
  background-position: 0 0;
  overflow: hidden;
`;

const Dock = styled.div`
  flex: 0 0 auto;
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

const SnakeBlock = styled.div<{
  $logo?: boolean;
}>`
  width: ${(p) => (p.$logo ? '78%' : '84%')};
  height: ${(p) => (p.$logo ? '78%' : '84%')};
  background: ${LCD.pixel};
  border-radius: 22%;
  opacity: ${(p) => (p.$logo ? 0.92 : 1)};
`;

const ReadyHint = styled.div`
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 12%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.5;
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

const VersusButton = styled.button`
  margin-top: 4px;
  border: 2px solid ${LCD.border};
  background: ${LCD.pixel};
  color: ${LCD.bg};
  font-family: inherit;
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 8px 10px;
`;

const GhostButton = styled.button`
  margin-top: 4px;
  border: 2px solid ${LCD.border};
  background: transparent;
  color: ${LCD.pixel};
  font-family: inherit;
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 8px 10px;
`;

const RoomInput = styled.input`
  width: min(100%, 180px);
  border: 2px solid ${LCD.border};
  background: transparent;
  color: ${LCD.pixel};
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
  padding: 8px 6px;
  outline: none;

  &::placeholder {
    color: ${LCD.pixel};
    opacity: 0.45;
    text-transform: uppercase;
  }
`;

const JoinForm = styled.form`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
`;

interface SnakeBoardProps {
  state: GameState;
  playerLabel: string;
  guest?: boolean;
  muted: boolean;
  board: LeaderboardBoard;
  lastSubmit: SubmitRunResponse | null;
  busy: 'start' | 'submit' | null;
  onToggleMute: () => void;
  onPause: () => void;
  onVersus?: () => void;
  versusSetup?: boolean;
  joinError?: string | null;
  onCreateRoom?: () => void;
  onJoinRoom?: (roomId: string) => void;
  onCancelVersus?: () => void;
}

function segmentKey(point: Point, index: number): string {
  return `${point.x}-${point.y}-${index}`;
}

export function SnakeBoard({
  state,
  playerLabel,
  guest,
  muted,
  board,
  lastSubmit,
  busy,
  onToggleMute,
  onPause,
  onVersus,
  versusSetup,
  joinError,
  onCreateRoom,
  onJoinRoom,
  onCancelVersus,
}: SnakeBoardProps) {
  const {snake, foods, gridWidth, gridHeight, score, status} = state;
  const showTitle = !busy && status === 'ready';
  const logo = showTitle ? frontLogoCells(gridWidth, gridHeight) : [];
  const bait = showTitle ? frontLogoBait(gridWidth, gridHeight) : null;

  return (
    <Shell>
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

      <BoardFrame>
        <Board $cols={gridWidth} $rows={gridHeight}>
          {!showTitle
            ? snake.map((segment, index) => (
                <Cell
                  key={segmentKey(segment, index)}
                  $x={segment.x}
                  $y={segment.y}
                  $cols={gridWidth}
                  $rows={gridHeight}
                >
                  <SnakeBlock />
                </Cell>
              ))
            : null}
          {!showTitle
            ? foods.map((food, index) => (
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
              ))
            : null}
          {bait ? (
            <Cell
              key={`logo-bait-${bait.x}-${bait.y}`}
              $x={bait.x}
              $y={bait.y}
              $cols={gridWidth}
              $rows={gridHeight}
            >
              <FoodGlyph>
                <FoodCenter />
              </FoodGlyph>
            </Cell>
          ) : null}
          {logo.map((cell) => (
            <Cell
              key={`logo-${cell.x}-${cell.y}`}
              $x={cell.x}
              $y={cell.y}
              $cols={gridWidth}
              $rows={gridHeight}
            >
              <SnakeBlock $logo />
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
          {!busy && versusSetup ? (
            <Overlay>
              Multiplayer
              <OverlayHint>Create a room or enter a room id</OverlayHint>
              <VersusButton type="button" onClick={onCreateRoom}>
                Create room
              </VersusButton>
              <JoinForm
                onSubmit={(event) => {
                  event.preventDefault();
                  const field = event.currentTarget.elements.namedItem('roomId');
                  const value =
                    field instanceof HTMLInputElement ? field.value : '';
                  onJoinRoom?.(value);
                }}
              >
                <RoomInput
                  name="roomId"
                  aria-label="Room id"
                  placeholder="Room id"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <VersusButton type="submit">Enter</VersusButton>
              </JoinForm>
              {joinError ? <OverlayHint>{joinError}</OverlayHint> : null}
              <GhostButton type="button" onClick={onCancelVersus}>
                Back
              </GhostButton>
            </Overlay>
          ) : null}
          {!busy && !versusSetup && status === 'ready' ? (
            <ReadyHint>
              Snake
              <OverlayHint>Arrows / WASD to play</OverlayHint>
              {guest ? (
                <OverlayHint>Guest · ranks only in Front</OverlayHint>
              ) : null}
              {onVersus ? (
                <VersusButton type="button" onClick={onVersus}>
                  Multiplayer
                </VersusButton>
              ) : null}
            </ReadyHint>
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

      <Dock>
        <Hud>
          <span>{score}</span>
          <HudName>{playerLabel}</HudName>
        </Hud>
        <Leaderboard
          board={board}
          playing={status === 'playing'}
          onPause={onPause}
        />
      </Dock>
    </Shell>
  );
}
