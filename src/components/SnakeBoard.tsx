import {useEffect, useRef} from 'react';
import {styled} from 'styled-components';

import {computeGridSize, type GridSize} from '../game/snakeEngine';
import type {GameState, Point} from '../game/types';

const LCD = {
  bg: '#b7c86a',
  pixel: '#2a3816',
  pixelSoft: 'rgba(42, 56, 22, 0.14)',
  border: '#243214',
};

const Shell = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 55%, rgba(40, 50, 20, 0.12) 100%), ${LCD.bg};
  user-select: none;
  touch-action: none;
  font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
  color: ${LCD.pixel};
`;

const LevelBar = styled.div`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 12px 10px;
  border-bottom: 2px solid ${LCD.border};
  text-transform: uppercase;
`;

const LevelTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;

const LevelCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

const LevelLabel = styled.span`
  font-size: 8px;
  letter-spacing: 0.08em;
  opacity: 0.7;
`;

const LevelId = styled.span`
  font-size: 9px;
  letter-spacing: 0.02em;
  word-break: break-all;
  line-height: 1.45;
`;

const LevelMeta = styled.span`
  font-size: 7px;
  letter-spacing: 0.02em;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  display: flex;
  padding: 10px 12px 0;
`;

const Board = styled.div<{
  $cols: number;
  $rows: number;
}>`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  border: 2px solid ${LCD.border};
  background: ${LCD.bg};
  overflow: hidden;
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
  width: 72%;
  height: 72%;
  background: ${LCD.pixel};
  border-radius: 28%;
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

const Hud = styled.div`
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 12px;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.3;
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
  levelTitle: string;
  levelSubtitle?: string;
  playerLabel: string;
  muted: boolean;
  onToggleMute: () => void;
  onGridSize: (size: GridSize) => void;
}

function segmentKey(point: Point, index: number): string {
  return `${point.x}-${point.y}-${index}`;
}

export function SnakeBoard({
  state,
  levelTitle,
  levelSubtitle,
  playerLabel,
  muted,
  onToggleMute,
  onGridSize,
}: SnakeBoardProps) {
  const {snake, foods, gridWidth, gridHeight, score, highScore, status} = state;
  const boardRef = useRef<HTMLDivElement>(null);
  const onGridSizeRef = useRef(onGridSize);
  onGridSizeRef.current = onGridSize;

  useEffect(() => {
    const node = boardRef.current;
    if (!node) {
      return;
    }

    const publish = (width: number, height: number) => {
      onGridSizeRef.current(computeGridSize(width, height));
    };

    publish(node.clientWidth, node.clientHeight);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const {width, height} = entry.contentRect;
        publish(width, height);
        break;
      }
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <Shell>
      <LevelBar>
        <LevelTop>
          <LevelCopy>
            <LevelLabel>Level</LevelLabel>
            <LevelId>{levelTitle}</LevelId>
            {levelSubtitle ? <LevelMeta>{levelSubtitle}</LevelMeta> : null}
          </LevelCopy>
          <MuteButton type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? 'Muted' : 'Sound'}
          </MuteButton>
        </LevelTop>
      </LevelBar>

      <BoardFrame>
        <Board ref={boardRef} $cols={gridWidth} $rows={gridHeight}>
          {snake.map((segment, index) => (
            <Cell key={segmentKey(segment, index)} $x={segment.x} $y={segment.y} $cols={gridWidth} $rows={gridHeight}>
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

          {status === 'ready' ? (
            <Overlay>
              Snake
              <OverlayHint>Arrows / WASD to play</OverlayHint>
            </Overlay>
          ) : null}
          {status === 'paused' ? (
            <Overlay>
              Paused
              <OverlayHint>Space resume · M mute</OverlayHint>
            </Overlay>
          ) : null}
          {status === 'gameover' ? (
            <Overlay>
              Game over
              <OverlayHint>Score {score}</OverlayHint>
              <OverlayHint>Arrow or Enter to retry</OverlayHint>
            </Overlay>
          ) : null}
        </Board>
      </BoardFrame>

      <Hud>
        <span>{score}</span>
        <span>
          {playerLabel} {highScore}
        </span>
      </Hud>
    </Shell>
  );
}
