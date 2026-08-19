import {useState} from 'react';
import {styled} from 'styled-components';

const LCD = {
  bg: '#b7c86a',
  pixel: '#2a3816',
  pixelSoft: 'rgba(42, 56, 22, 0.14)',
  border: '#243214',
};

const SNAKE: Array<{x: number; y: number}> = [
  {x: 4, y: 8},
  {x: 5, y: 8},
  {x: 6, y: 8},
  {x: 7, y: 8},
  {x: 8, y: 8},
  {x: 8, y: 9},
];
const FOOD = {x: 12, y: 8};
const COLS = 17;
const ROWS = 17;

const Shell = styled.div`
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

const LevelLabel = styled.span`
  font-size: 8px;
  letter-spacing: 0.08em;
  opacity: 0.7;
`;

const LevelId = styled.span`
  font-size: 9px;
  letter-spacing: 0.02em;
  line-height: 1.45;
`;

const LevelMeta = styled.span`
  font-size: 7px;
  letter-spacing: 0.02em;
  opacity: 0.75;
  line-height: 1.5;
`;

const BoardFrame = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  padding: 10px 12px 0;
`;

const Board = styled.div`
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
}>`
  position: absolute;
  left: ${(p) => (p.$x / COLS) * 100}%;
  top: ${(p) => (p.$y / ROWS) * 100}%;
  width: ${100 / COLS}%;
  height: ${100 / ROWS}%;
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
  background: rgba(183, 200, 106, 0.86);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: center;
  padding: 16px;
  overflow: auto;
`;

const OverlayHint = styled.span`
  font-size: 7px;
  letter-spacing: 0.04em;
  opacity: 0.85;
  line-height: 1.7;
  max-width: 28em;
`;

const CopyButton = styled.button`
  border: 2px solid ${LCD.border};
  background: transparent;
  color: ${LCD.pixel};
  font-family: inherit;
  font-size: 7px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 8px 10px;
  margin-top: 4px;

  &:active {
    background: ${LCD.pixelSoft};
  }
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

function pluginUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function OutsideFront({loading}: {loading?: boolean}) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(pluginUrl());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Shell>
      <LevelBar>
        <LevelLabel>Level</LevelLabel>
        <LevelId>Front plugin</LevelId>
        <LevelMeta>
          {loading ? 'Inserting cartridge' : 'No Front window'}
        </LevelMeta>
      </LevelBar>

      <BoardFrame>
        <Board>
          {SNAKE.map((segment, index) => (
            <Cell key={`${segment.x}-${segment.y}-${index}`} $x={segment.x} $y={segment.y}>
              <SnakeBlock />
            </Cell>
          ))}
          <Cell $x={FOOD.x} $y={FOOD.y}>
            <FoodGlyph>
              <FoodCenter />
            </FoodGlyph>
          </Cell>

          <Overlay>
            {loading ? (
              <>
                Snake
                <OverlayHint>Waiting for Front…</OverlayHint>
              </>
            ) : (
              <>
                Outside Front
                <OverlayHint>
                  This handheld only powers on as a Front sidebar plugin. Opening
                  the URL in a normal browser tab will not start a game.
                </OverlayHint>
                <OverlayHint>
                  In Front: add a plugin, paste this page URL, then open a
                  conversation.
                </OverlayHint>
                <CopyButton type="button" onClick={() => void copyUrl()}>
                  {copied ? 'Copied URL' : 'Copy plugin URL'}
                </CopyButton>
              </>
            )}
          </Overlay>
        </Board>
      </BoardFrame>

      <Hud>
        <span>00</span>
        <span>HIGH 00</span>
      </Hud>
    </Shell>
  );
}
