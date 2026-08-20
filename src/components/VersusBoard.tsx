import type {CSSProperties} from 'react';
import {styled} from 'styled-components';

import {
  describeDeaths,
  MP_GRID_HEIGHT,
  MP_GRID_WIDTH,
  type MpDeath,
  type MpPlayer,
  type MpSnake,
  type MpState,
} from '../game/multiplayerEngine';
import type {Point} from '../game/types';
import type {RoomLink} from '../snakeClient/multiplayer';

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
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Roster = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const RosterRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 7px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.4;
`;

const RosterName = styled.span`
  display: flex;
  gap: 6px;
  min-width: 0;
  align-items: center;
`;

const Swatch = styled.span<{
  $color: string;
}>`
  width: 8px;
  height: 8px;
  background: ${(p) => p.$color};
  flex: 0 0 auto;
  margin-top: 1px;
`;

const Name = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Cell = styled.div`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SnakeBlock = styled.div<{
  $color: string;
  $dead?: boolean;
}>`
  width: ${(p) => (p.$dead ? '92%' : '84%')};
  height: ${(p) => (p.$dead ? '92%' : '84%')};
  background: ${(p) => p.$color};
  border-radius: ${(p) => (p.$dead ? '8%' : '22%')};
  position: relative;

  ${(p) =>
    p.$dead
      ? `
    &::before,
    &::after {
      content: '';
      position: absolute;
      left: 18%;
      top: 42%;
      width: 64%;
      height: 16%;
      background: ${LCD.bg};
    }
    &::before {
      transform: rotate(45deg);
    }
    &::after {
      transform: rotate(-45deg);
    }
  `
      : ''}
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

  &::before {
    left: 38%;
    top: 8%;
    width: 24%;
    height: 84%;
  }

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

const Action = styled.button`
  border: 2px solid ${LCD.border};
  background: ${LCD.pixel};
  color: ${LCD.bg};
  font-family: inherit;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 10px 8px;
`;

const Ghost = styled.button`
  border: 2px solid ${LCD.border};
  background: transparent;
  color: ${LCD.pixel};
  font-family: inherit;
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 8px;
`;

const LinkHint = styled.span`
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  font-size: 7px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
  opacity: 0.85;
`;

const ReplayScrim = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 3px dashed ${LCD.pixel};
  background: repeating-linear-gradient(
    -18deg,
    transparent,
    transparent 8px,
    rgba(42, 56, 22, 0.1) 8px,
    rgba(42, 56, 22, 0.1) 10px
  );
`;

const ReplayBanner = styled.div`
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  z-index: 1;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-align: center;
  background: ${LCD.pixel};
  color: ${LCD.bg};
  padding: 8px 6px;
  line-height: 1.4;
`;

const DeathHint = styled.span<{
  $replay?: boolean;
}>`
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: ${(p) => (p.$replay ? '10px' : '8px')};
  z-index: 1;
  font-size: ${(p) => (p.$replay ? '8px' : '7px')};
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.5;
  ${(p) =>
    p.$replay
      ? `
    background: ${LCD.pixel};
    color: ${LCD.bg};
    padding: 8px 6px;
  `
      : ''}
`;

const RoomCode = styled.span`
  font-size: 12px;
  letter-spacing: 0.18em;
`;

function segmentKey(snakeId: string, index: number): string {
  return `${snakeId}-${index}`;
}

function cellStyle(
  x: number,
  y: number,
  cols: number,
  rows: number,
): CSSProperties {
  return {
    left: `${(x / cols) * 100}%`,
    top: `${(y / rows) * 100}%`,
    width: `${100 / cols}%`,
    height: `${100 / rows}%`,
  };
}

function winnerName(state: MpState): string {
  if (!state.winnerId) {
    return 'Draw';
  }
  return state.snakes.find((snake) => snake.id === state.winnerId)?.name ?? 'Win';
}

export function VersusBoard({
  state,
  players,
  youId,
  isHost,
  ready,
  muted,
  error,
  link,
  copied,
  roomId,
  personalView,
  onToggleMute,
  onCopyId,
  onReady,
  onSolo,
}: {
  state: MpState | null;
  players: MpPlayer[];
  youId: string;
  isHost: boolean;
  ready: boolean;
  muted: boolean;
  error: string | null;
  link: RoomLink;
  copied: boolean;
  roomId: string;
  personalView: {snakes: MpSnake[]; foods: Point[]; deaths: MpDeath[]} | null;
  onToggleMute: () => void;
  onCopyId: () => void;
  onReady: () => void;
  onSolo: () => void;
}) {
  const cols = state?.gridWidth ?? MP_GRID_WIDTH;
  const rows = state?.gridHeight ?? MP_GRID_HEIGHT;
  const liveSnakes: MpSnake[] = state?.snakes ?? [];
  const viewingPersonal = Boolean(personalView) && (state?.status ?? 'lobby') === 'playing';
  const snakes = viewingPersonal && personalView ? personalView.snakes : liveSnakes;
  const foods =
    viewingPersonal && personalView ? personalView.foods : (state?.foods ?? []);
  const status = state?.status ?? 'lobby';
  const slowMo = status === 'replay' || viewingPersonal;
  const seated = players.length > 0 ? players : snakes.map((snake, index) => ({
    id: snake.id,
    name: snake.name,
    color: snake.color,
    host: index === 0,
    ready: false,
    joinedAt: index,
  }));
  const readyCount = seated.filter((player) => player.ready).length;
  const waitingOnReady = status !== 'playing' && status !== 'replay';
  const connected = link === 'connected';
  const canReady = connected && !error && waitingOnReady;
  const deathLine =
    viewingPersonal && personalView
      ? describeDeaths(personalView.deaths, snakes)
      : state && state.lastDeaths.length > 0
        ? describeDeaths(state.lastDeaths, liveSnakes)
        : '';

  return (
    <Shell>
      <LevelBar>
        <LevelLabel>
          {slowMo ? 'Slow-mo' : `Versus ${seated.length}/4`}
        </LevelLabel>
        <MuteButton
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? 'Muted' : 'Sound'}
        </MuteButton>
      </LevelBar>

      <BoardFrame>
        <Board $cols={cols} $rows={rows}>
          {status !== 'lobby'
            ? snakes.flatMap((snake) =>
                snake.body.map((segment, index) => (
                  <Cell
                    key={segmentKey(snake.id, index)}
                    style={cellStyle(segment.x, segment.y, cols, rows)}
                  >
                    <SnakeBlock $color={snake.color} $dead={!snake.alive} />
                  </Cell>
                )),
              )
            : null}
          {status !== 'lobby'
            ? foods.map((food, index) => (
                <Cell
                  key={`food-${food.x}-${food.y}-${index}`}
                  style={cellStyle(food.x, food.y, cols, rows)}
                >
                  <FoodGlyph>
                    <FoodCenter />
                  </FoodGlyph>
                </Cell>
              ))
            : null}

          {!error && slowMo ? (
            <>
              <ReplayScrim />
              <ReplayBanner>Slow-mo</ReplayBanner>
            </>
          ) : null}
          {!error && deathLine && (status === 'playing' || status === 'replay') ? (
            <DeathHint $replay={slowMo}>{deathLine}</DeathHint>
          ) : null}

          {error ? (
            <Overlay>
              Offline
              <OverlayHint>{error}</OverlayHint>
            </Overlay>
          ) : null}
          {!error && link === 'connecting' && !state ? (
            <Overlay>
              Linking
              <OverlayHint>Joining room…</OverlayHint>
            </Overlay>
          ) : null}
          {!error && link === 'reconnecting' && (status === 'playing' || status === 'replay') ? (
            <LinkHint>Reconnecting…</LinkHint>
          ) : null}
          {!error && status === 'lobby' && (connected || link === 'reconnecting') ? (
            <Overlay>
              Room
              <RoomCode>{roomId}</RoomCode>
              <OverlayHint>
                {seated.length}/4 · {readyCount} ready · {isHost ? 'Host' : 'Guest'}
              </OverlayHint>
              {link === 'reconnecting' ? (
                <OverlayHint>Reconnecting…</OverlayHint>
              ) : null}
              <Action type="button" onClick={onCopyId}>
                {copied ? 'Copied' : 'Copy room id'}
              </Action>
              {canReady ? (
                <Action type="button" onClick={onReady}>
                  {ready ? 'Unready' : 'Ready'}
                </Action>
              ) : null}
              <OverlayHint>
                {seated.length < 2
                  ? 'Need 2 players'
                  : readyCount < seated.length
                    ? 'Everyone must ready'
                    : 'Starting…'}
              </OverlayHint>
            </Overlay>
          ) : null}
          {!error && status === 'over' ? (
            <Overlay>
              {state?.hostLeft ? 'Host left' : state ? winnerName(state) : 'Over'}
              {deathLine ? <OverlayHint>{deathLine}</OverlayHint> : null}
              {state?.hostLeft ? null : (
                <>
                  <OverlayHint>
                    {seated.length < 2
                      ? 'Need 2 players'
                      : `${readyCount}/${seated.length} ready`}
                  </OverlayHint>
                  {canReady ? (
                    <Action type="button" onClick={onReady}>
                      {ready ? 'Unready' : 'Ready'}
                    </Action>
                  ) : null}
                </>
              )}
            </Overlay>
          ) : null}
        </Board>
      </BoardFrame>

      <Dock>
        <Roster>
          {seated.map((player) => {
            const snake = liveSnakes.find((row) => row.id === player.id);
            return (
              <RosterRow key={player.id}>
                <RosterName>
                  <Swatch $color={player.color} />
                  <Name>
                    {player.name}
                    {player.id === youId ? ' · you' : ''}
                    {player.host ? ' · host' : ''}
                    {status === 'playing' || status === 'replay' || status === 'over'
                      ? snake?.alive
                        ? ''
                        : ' · blocks'
                      : player.ready
                        ? ' · ready'
                        : ''}
                  </Name>
                </RosterName>
                <span>
                  {status === 'lobby'
                    ? player.ready
                      ? 'Ready'
                      : 'Wait'
                    : (snake?.score ?? '')}
                </span>
              </RosterRow>
            );
          })}
        </Roster>
        <Ghost type="button" onClick={onSolo}>
          Back to solo
        </Ghost>
      </Dock>
    </Shell>
  );
}
