import { type RefObject, useEffect, useRef } from "react";
import { styled } from "styled-components";

import {
  describeDeaths,
  hasSlowMoClip,
  MP_BLAST_TICKS,
  MP_BOMB_FUSE_TICKS,
  MP_GRID_HEIGHT,
  MP_GRID_WIDTH,
  MP_POWER_COST,
  MP_ROUNDS,
  type MpBlast,
  type MpBomb,
  type MpDeath,
  type MpPlayer,
  type MpShot,
  type MpSnake,
  type MpState,
  mpTickMs,
  roundStandings,
} from "../game/multiplayerEngine";
import {
  bindCanvas,
  clearBoard,
  createCanvasPaintCache,
  LCD,
  lerpAmount,
  paintGrid,
  setCanvasCssSize,
  shouldLerpMp,
} from "../game/paintBoard";
import { snakeSwatch } from "../game/snakeColors";
import type { Point } from "../game/types";
import type { RoomLink } from "../snakeClient/multiplayer";
import { formatMbps } from "../snakeClient/throughput";
import { BuildMark } from "./BuildMark";
import { ColorPicker } from "./ColorPicker";

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
  font-family: "Press Start 2P", "Courier New", Courier, monospace;
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

const LevelCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const NetSpeed = styled.span`
  font-size: 8px;
  letter-spacing: 0.08em;
`;

const BarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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
    linear-gradient(to right, rgba(42, 56, 22, 0.12) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(42, 56, 22, 0.12) 1px, transparent 1px);
  background-size: ${(p) => 100 / p.$cols}% ${(p) => 100 / p.$rows}%;
  background-position: 0 0;
  overflow: hidden;
`;

const BoardCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
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
  background: ${(p) => snakeSwatch(p.$color)};
  flex: 0 0 auto;
  margin-top: 1px;
`;

const Name = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RosterMeta = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
`;

const PowerBar = styled.span`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const PowerCount = styled.span`
  font-size: 6px;
  letter-spacing: 0.04em;
  min-width: 1.6ch;
`;

const PowerTick = styled.span<{
  $on: boolean;
  $color: string;
}>`
  width: 5px;
  height: 8px;
  border: 1px solid ${LCD.border};
  background: ${(p) => (p.$on ? p.$color : "transparent")};
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

const CountNum = styled.span`
  font-size: 42px;
  letter-spacing: 0.04em;
  line-height: 1;
`;

const Standings = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: min(100%, 22ch);
`;

const StandingRow = styled.li`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 7px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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

const SpectateBar = styled.div`
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 8px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.5;
  background: rgba(183, 200, 106, 0.92);
  border: 2px solid ${LCD.border};
  color: ${LCD.pixel};
  padding: 10px 8px;
`;

const DeathHint = styled.span<{
  $replay?: boolean;
}>`
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: ${(p) => (p.$replay ? "10px" : "8px")};
  z-index: 1;
  font-size: ${(p) => (p.$replay ? "8px" : "7px")};
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
      : ""}
`;

const RoomCode = styled.input`
  font-size: 12px;
  letter-spacing: 0.18em;
  font-family: inherit;
  color: inherit;
  text-align: center;
  border: none;
  background: transparent;
  width: 12ch;
  padding: 4px 0;
  user-select: text;
  -webkit-user-select: text;
  touch-action: manipulation;
  caret-color: transparent;

  &:focus {
    outline: 2px solid ${LCD.border};
  }
`;

function winnerName(state: MpState): string {
  if (!state.winnerId) {
    return "Draw";
  }
  return (
    state.snakes.find((snake) => snake.id === state.winnerId)?.name ?? "Win"
  );
}

export function VersusBoard({
  state,
  liveRef,
  prevLiveRef,
  lastTickAtRef,
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
  ai = false,
  youOut = false,
  onToggleMute,
  onCopyId,
  onReady,
  onReplay,
  onSolo,
  onChangeColor,
  getNetBps,
}: {
  state: MpState | null;
  liveRef: RefObject<MpState | null>;
  prevLiveRef: RefObject<MpState | null>;
  lastTickAtRef: RefObject<number>;
  players: MpPlayer[];
  youId: string;
  isHost: boolean;
  ready: boolean;
  muted: boolean;
  error: string | null;
  link: RoomLink;
  copied: boolean;
  roomId: string;
  personalView: {
    snakes: MpSnake[];
    foods: Point[];
    shots: MpShot[];
    bombs: MpBomb[];
    blasts: MpBlast[];
    deaths: MpDeath[];
  } | null;
  ai?: boolean;
  youOut?: boolean;
  getNetBps?: () => number;
  onToggleMute: () => void;
  onCopyId: () => void;
  onReady: () => void;
  onReplay?: () => void;
  onSolo: () => void;
  onChangeColor: (color: string) => void;
}) {
  const cols = state?.gridWidth ?? MP_GRID_WIDTH;
  const rows = state?.gridHeight ?? MP_GRID_HEIGHT;
  const liveSnakes: MpSnake[] = state?.snakes ?? [];
  const viewingPersonal =
    Boolean(personalView) && (state?.status ?? "lobby") === "playing";
  const snakes =
    viewingPersonal && personalView ? personalView.snakes : liveSnakes;
  const status = state?.status ?? "lobby";
  const slowMo = status === "replay" || viewingPersonal;
  const seated =
    players.length > 0
      ? players
      : snakes.map((snake, index) => ({
          id: snake.id,
          name: snake.name,
          color: snake.color,
          host: index === 0,
          ready: false,
          joinedAt: index,
        }));
  const readyCount = seated.filter((player) => player.ready).length;
  const waitingOnReady = status === "lobby" || status === "over";
  const connected = link === "connected";
  const canReady = connected && !error && waitingOnReady;
  const you = seated.find((player) => player.id === youId);
  const watchingOut = youOut && (status === "playing" || status === "replay");
  const lastRoundWinner = state?.roundWinnerId
    ? (liveSnakes.find((snake) => snake.id === state.roundWinnerId)?.name ??
      null)
    : null;
  const takenColors = new Set(
    seated
      .filter((player) => player.id !== youId)
      .map((player) => player.color),
  );
  const deathLine =
    viewingPersonal && personalView
      ? describeDeaths(personalView.deaths, snakes)
      : state && state.lastDeaths.length > 0
        ? describeDeaths(state.lastDeaths, liveSnakes)
        : "";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef(createCanvasPaintCache());
  const personalRef = useRef(personalView);
  personalRef.current = personalView;
  const hudRef = useRef(state);
  hudRef.current = state;
  const netRef = useRef<HTMLSpanElement>(null);
  const getNetBpsRef = useRef(getNetBps);
  getNetBpsRef.current = getNetBps;

  useEffect(() => {
    const canvas = canvasRef.current;
    const cache = cacheRef.current;
    if (!canvas) {
      return;
    }
    bindCanvas(cache, canvas);
    const observer = new ResizeObserver((entries) => {
      const box = entries[0].contentRect;
      setCanvasCssSize(cache, box.width, box.height);
    });
    observer.observe(canvas);
    let frame = 0;
    const loop = (now: number) => {
      const hud = hudRef.current;
      const live = liveRef.current ?? hud;
      const statusNow = live?.status ?? hud?.status ?? "lobby";
      if (statusNow === "lobby" || !live) {
        clearBoard(canvas, cache);
        frame = window.requestAnimationFrame(loop);
        return;
      }
      const personal = personalRef.current;
      const viewing = Boolean(personal) && live.status === "playing";
      const currSnakes = viewing
        ? (personal?.snakes ?? live.snakes)
        : live.snakes;
      const currFoods = viewing ? (personal?.foods ?? live.foods) : live.foods;
      const currShots = viewing ? (personal?.shots ?? live.shots) : live.shots;
      const currBombs = viewing ? (personal?.bombs ?? live.bombs) : live.bombs;
      const currBlasts = viewing
        ? (personal?.blasts ?? live.blasts)
        : live.blasts;
      const prev = viewing ? null : prevLiveRef.current;
      const lerp = !viewing && prev ? shouldLerpMp(prev, live) : false;
      const t = lerpAmount(lastTickAtRef.current, mpTickMs(live), now, !lerp);
      paintGrid(
        canvas,
        cache,
        live.gridWidth,
        live.gridHeight,
        currSnakes,
        currFoods,
        currShots,
        lerp && prev
          ? { snakes: prev.snakes, foods: prev.foods, shots: prev.shots }
          : null,
        t,
        {
          tick: live.tick,
          bombs: currBombs,
          blasts: currBlasts,
          now,
          lastTickAt: lastTickAtRef.current,
          tickMs: mpTickMs(live),
          fuseTicks: MP_BOMB_FUSE_TICKS,
          blastTicks: MP_BLAST_TICKS,
        },
      );
      const netEl = netRef.current;
      const readNet = getNetBpsRef.current;
      if (netEl && readNet) {
        const label = formatMbps(readNet());
        if (netEl.textContent !== label) {
          netEl.textContent = label;
        }
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [lastTickAtRef, liveRef, prevLiveRef]);

  return (
    <Shell>
      <LevelBar>
        <LevelCluster>
          <LevelLabel>
            {slowMo
              ? "Slow-mo"
              : status === "lobby"
                ? `Versus ${seated.length}/4`
                : `Round ${state?.matchRound ?? 1}/${MP_ROUNDS}`}
          </LevelLabel>
          {ai || !getNetBps ? null : <NetSpeed ref={netRef}>0 Mb/s</NetSpeed>}
        </LevelCluster>
        <BarRight>
          <BuildMark />
          <MuteButton
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? "Muted" : "Sound"}
          </MuteButton>
        </BarRight>
      </LevelBar>

      <BoardFrame>
        <Board $cols={cols} $rows={rows}>
          <BoardCanvas ref={canvasRef} />

          {!error && slowMo ? (
            <>
              <ReplayScrim />
              <ReplayBanner>Slow-mo</ReplayBanner>
            </>
          ) : null}
          {!error && watchingOut ? (
            <SpectateBar>
              You&apos;re out
              <OverlayHint>
                {ai ? "Fast-forward" : "Enter play again"}
              </OverlayHint>
              <Action type="button" onClick={onReady}>
                Play again
              </Action>
            </SpectateBar>
          ) : null}
          {!error &&
          !watchingOut &&
          deathLine &&
          (status === "playing" || status === "replay") ? (
            <DeathHint $replay={slowMo}>{deathLine}</DeathHint>
          ) : null}

          {!error && status === "countdown" && state ? (
            <Overlay>
              <CountNum>{state.countdown}</CountNum>
              <OverlayHint>
                Round {state.matchRound}/{MP_ROUNDS}
              </OverlayHint>
              {lastRoundWinner ? (
                <OverlayHint>{lastRoundWinner} took the last round</OverlayHint>
              ) : null}
            </Overlay>
          ) : null}
          {error ? (
            <Overlay>
              Offline
              <OverlayHint>{error}</OverlayHint>
            </Overlay>
          ) : null}
          {!error && link === "connecting" && !state ? (
            <Overlay>
              Linking
              <OverlayHint>Joining room…</OverlayHint>
            </Overlay>
          ) : null}
          {!error &&
          link === "reconnecting" &&
          (status === "playing" ||
            status === "replay" ||
            status === "countdown") ? (
            <LinkHint>Reconnecting…</LinkHint>
          ) : null}
          {!error &&
          !ai &&
          status === "lobby" &&
          (connected || link === "reconnecting") ? (
            <Overlay>
              Room
              <RoomCode
                readOnly
                value={roomId}
                aria-label="Room id"
                onFocus={(event) => {
                  event.currentTarget.select();
                }}
                onClick={(event) => {
                  event.currentTarget.select();
                }}
              />
              <OverlayHint>
                {seated.length}/4 · {readyCount} ready ·{" "}
                {isHost ? "Host" : "Guest"}
              </OverlayHint>
              {you ? (
                <ColorPicker
                  value={you.color}
                  taken={takenColors}
                  disabled={!canReady}
                  onChange={onChangeColor}
                />
              ) : null}
              {link === "reconnecting" ? (
                <OverlayHint>Reconnecting…</OverlayHint>
              ) : null}
              <Action type="button" onClick={onCopyId}>
                {copied ? "Copied" : "Copy room id"}
              </Action>
              {canReady ? (
                <Action type="button" onClick={onReady}>
                  {ready ? "Unready" : "Ready"}
                </Action>
              ) : null}
              <OverlayHint>
                {seated.length < 2
                  ? "Need 2 players"
                  : readyCount < seated.length
                    ? "Everyone must ready"
                    : "Starting…"}
              </OverlayHint>
            </Overlay>
          ) : null}
          {!error && status === "over" ? (
            <Overlay>
              {state?.hostLeft && !ai
                ? "Host left"
                : state
                  ? winnerName(state)
                  : "Over"}
              {state ? (
                <Standings>
                  {roundStandings(state.snakes).map((snake, index) => (
                    <StandingRow key={snake.id}>
                      <span>
                        {index + 1}. {snake.name}
                        {snake.id === youId ? " · you" : ""}
                        {state.winnerId === snake.id ? " · win" : ""}
                      </span>
                      <span>
                        {snake.roundWins}
                        {snake.score > 0 ? ` · ${snake.score}` : ""}
                      </span>
                    </StandingRow>
                  ))}
                </Standings>
              ) : null}
              {deathLine ? <OverlayHint>{deathLine}</OverlayHint> : null}
              {state && hasSlowMoClip(state) && onReplay ? (
                <Action type="button" onClick={onReplay}>
                  Replay slow-mo
                </Action>
              ) : null}
              {ai ? (
                <>
                  <OverlayHint>Enter play again</OverlayHint>
                  <Action type="button" onClick={onReady}>
                    Play again
                  </Action>
                </>
              ) : state?.hostLeft ? null : (
                <>
                  <OverlayHint>
                    {seated.length < 2
                      ? "Need 2 players"
                      : `${readyCount}/${seated.length} ready`}
                  </OverlayHint>
                  {you && canReady ? (
                    <ColorPicker
                      value={you.color}
                      taken={takenColors}
                      onChange={onChangeColor}
                    />
                  ) : null}
                  {canReady ? (
                    <Action type="button" onClick={onReady}>
                      {ready ? "Unready" : "Ready"}
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
                    {player.id === youId ? " · you" : ""}
                    {!ai && player.host ? " · host" : ""}
                    {status === "playing" ||
                    status === "replay" ||
                    status === "countdown" ||
                    status === "over"
                      ? snake?.alive
                        ? ""
                        : " · blocks"
                      : player.ready
                        ? " · ready"
                        : ""}
                  </Name>
                </RosterName>
                <RosterMeta>
                  {status === "playing" ||
                  status === "replay" ||
                  status === "countdown" ||
                  status === "over" ? (
                    <PowerBar
                      aria-label={`${player.name} power ${snake?.power ?? 0}`}
                    >
                      {Math.floor((snake?.power ?? 0) / MP_POWER_COST) > 0 ? (
                        <PowerCount>
                          ×{Math.floor((snake?.power ?? 0) / MP_POWER_COST)}
                        </PowerCount>
                      ) : null}
                      {Array.from({ length: MP_POWER_COST }, (_, index) => (
                        <PowerTick
                          key={index}
                          $color={snakeSwatch(player.color)}
                          $on={(snake?.power ?? 0) % MP_POWER_COST > index}
                        />
                      ))}
                    </PowerBar>
                  ) : null}
                  <span>
                    {status === "lobby"
                      ? player.ready
                        ? "Ready"
                        : "Wait"
                      : `${snake?.roundWins ?? 0}`}
                  </span>
                </RosterMeta>
              </RosterRow>
            );
          })}
        </Roster>
        {status === "playing" || status === "countdown" ? (
          <OverlayHint>Space rocket · Shift turbo · B bomb</OverlayHint>
        ) : null}
        <Ghost type="button" onClick={onSolo}>
          Back to solo
        </Ghost>
      </Dock>
    </Shell>
  );
}
