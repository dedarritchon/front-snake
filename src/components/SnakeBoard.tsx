import { type RefObject, useEffect, useMemo, useRef } from "react";
import { styled } from "styled-components";

import { BASE_TICK_MS, gameLevel, tickMsForScore } from "../game/engine";
import { frontLogoBait, frontLogoCells } from "../game/logo";
import {
  bindCanvas,
  createCanvasPaintCache,
  LCD,
  lerpAmount,
  paintGrid,
  setCanvasCssSize,
} from "../game/paintBoard";
import {
  blockedCells,
  createTitleSnakes,
  tickTitleSnakes,
  type TitleSnake,
} from "../game/titleSnakes";
import type { GameState } from "../game/types";
import type {
  LeaderboardBoard,
  SubmitRunResponse,
} from "../snakeClient/leaderboard";
import { BuildMark } from "./BuildMark";
import { ColorPicker } from "./ColorPicker";
import { Leaderboard } from "./Leaderboard";

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

const HudName = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 8px;
  letter-spacing: 0.04em;
`;

const ColorDock = styled.div`
  display: flex;
  justify-content: center;
  padding: 6px 8px 0;
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

const VersusRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 4px;

  button {
    margin-top: 0;
  }
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
  liveRef: RefObject<GameState>;
  prevLiveRef: RefObject<GameState | null>;
  lastTickAtRef: RefObject<number>;
  playerLabel: string;
  guest?: boolean;
  muted: boolean;
  board: LeaderboardBoard;
  lastSubmit: SubmitRunResponse | null;
  busy: "start" | "submit" | null;
  onToggleMute: () => void;
  onPause: () => void;
  onVersus?: () => void;
  onVsAi?: () => void;
  versusSetup?: boolean;
  joinError?: string | null;
  onCreateRoom?: () => void;
  onJoinRoom?: (roomId: string) => void;
  onCancelVersus?: () => void;
  snakeColor: string;
  onChangeColor: (color: string) => void;
}

function useTitleSnakes(
  active: boolean,
  cols: number,
  rows: number,
  blocked: Set<string>,
): RefObject<TitleSnake[]> {
  const snakesRef = useRef<TitleSnake[]>([]);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  useEffect(() => {
    if (!active) {
      snakesRef.current = [];
      return;
    }
    snakesRef.current = createTitleSnakes(cols, rows);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      return;
    }
    const id = window.setInterval(() => {
      snakesRef.current = tickTitleSnakes(
        snakesRef.current,
        cols,
        rows,
        blockedRef.current,
      );
    }, BASE_TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [active, cols, rows]);

  return snakesRef;
}

export function SnakeBoard({
  state,
  liveRef,
  prevLiveRef,
  lastTickAtRef,
  playerLabel,
  guest,
  muted,
  board,
  lastSubmit,
  busy,
  onToggleMute,
  onPause,
  onVersus,
  onVsAi,
  versusSetup,
  joinError,
  onCreateRoom,
  onJoinRoom,
  onCancelVersus,
  snakeColor,
  onChangeColor,
}: SnakeBoardProps) {
  const { gridWidth, gridHeight, score, status } = state;
  const showTitle = !busy && status === "ready";
  const blocked = useMemo(() => {
    if (!showTitle) {
      return new Set<string>();
    }
    const cells = frontLogoCells(gridWidth, gridHeight);
    return blockedCells([...cells, frontLogoBait(gridWidth, gridHeight)]);
  }, [showTitle, gridWidth, gridHeight]);
  const titleSnakesRef = useTitleSnakes(
    showTitle,
    gridWidth,
    gridHeight,
    blocked,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef(createCanvasPaintCache());
  const colorRef = useRef(snakeColor);
  colorRef.current = snakeColor;
  const titleModeRef = useRef(showTitle);
  titleModeRef.current = showTitle;
  const busyRef = useRef(busy);
  busyRef.current = busy;

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
      const live = liveRef.current;
      const cols = live.gridWidth;
      const rows = live.gridHeight;
      if (busyRef.current) {
        paintGrid(canvas, cache, cols, rows, [], []);
        frame = window.requestAnimationFrame(loop);
        return;
      }
      if (titleModeRef.current) {
        const logo = frontLogoCells(cols, rows);
        const bait = frontLogoBait(cols, rows);
        const ambients = titleSnakesRef.current.map((ambient) => ({
          id: `title-${ambient.id}`,
          color: LCD.pixel,
          body: ambient.body,
          alive: true,
          style: "ambient" as const,
        }));
        const logoSnake = {
          id: "logo",
          color: LCD.pixel,
          body: logo,
          alive: true,
          style: "logo" as const,
        };
        paintGrid(canvas, cache, cols, rows, [...ambients, logoSnake], [bait]);
        frame = window.requestAnimationFrame(loop);
        return;
      }
      const prev = prevLiveRef.current;
      const prevFrame =
        live.status === "playing" && prev?.status === "playing" ? prev : null;
      const t = lerpAmount(
        lastTickAtRef.current,
        tickMsForScore(live.score, live.snake.length),
        now,
        prevFrame === null,
      );
      paintGrid(
        canvas,
        cache,
        cols,
        rows,
        [
          {
            id: "you",
            color: colorRef.current,
            body: live.snake,
            alive: true,
          },
        ],
        live.foods,
        [],
        prevFrame
          ? {
              snakes: [
                {
                  id: "you",
                  color: colorRef.current,
                  body: prevFrame.snake,
                  alive: true,
                },
              ],
              foods: prevFrame.foods,
            }
          : null,
        t,
        { tick: Math.floor(now / BASE_TICK_MS) },
      );
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [lastTickAtRef, liveRef, prevLiveRef, titleSnakesRef]);

  return (
    <Shell>
      <LevelBar>
        <LevelLabel>Level {gameLevel(score)}</LevelLabel>
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
        <Board $cols={gridWidth} $rows={gridHeight}>
          <BoardCanvas ref={canvasRef} />

          {busy ? (
            <Overlay>
              Loading
              <OverlayHint>
                {busy === "start" ? "Starting run…" : "Saving score…"}
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
                  const field =
                    event.currentTarget.elements.namedItem("roomId");
                  const value =
                    field instanceof HTMLInputElement ? field.value : "";
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
          {!busy && !versusSetup && status === "ready" ? (
            <ReadyHint>
              Snake
              <OverlayHint>Arrows / WASD to play</OverlayHint>
              {guest ? (
                <OverlayHint>Guest · ranks only in Front</OverlayHint>
              ) : null}
              {onVersus || onVsAi ? (
                <VersusRow>
                  {onVersus ? (
                    <VersusButton type="button" onClick={onVersus}>
                      Multiplayer
                    </VersusButton>
                  ) : null}
                  {onVsAi ? (
                    <VersusButton type="button" onClick={onVsAi}>
                      VS AI
                    </VersusButton>
                  ) : null}
                </VersusRow>
              ) : null}
              <ColorPicker value={snakeColor} onChange={onChangeColor} />
            </ReadyHint>
          ) : null}
          {!busy && status === "paused" ? (
            <Overlay>
              Paused
              <OverlayHint>Space resume · M mute</OverlayHint>
            </Overlay>
          ) : null}
          {!busy && status === "gameover" ? (
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
        <ColorDock>
          <ColorPicker value={snakeColor} onChange={onChangeColor} />
        </ColorDock>
        <Leaderboard
          board={board}
          playing={status === "playing"}
          onPause={onPause}
        />
      </Dock>
    </Shell>
  );
}
