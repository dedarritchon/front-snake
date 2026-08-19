import {useCallback, useEffect, useState} from 'react';
import {styled} from 'styled-components';

import {snakeAudio} from '../audio/snakeAudio';
import {GAME_THEMES} from '../audio/themes';

const LCD = {
  bg: '#b7c86a',
  pixel: '#2a3816',
  border: '#243214',
};

const Shell = styled.div`
  height: 100%;
  width: 100%;
  overflow: auto;
  display: flex;
  justify-content: center;
  background:
    radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0) 55%,
      rgba(40, 50, 20, 0.12) 100%
    ),
    ${LCD.bg};
  font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
  color: ${LCD.pixel};
`;

const Frame = styled.div`
  width: min(520px, 100%);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 14px 24px;
`;

const Header = styled.header`
  border-bottom: 2px solid ${LCD.border};
  padding-bottom: 12px;
  margin-bottom: 12px;
`;

const Title = styled.h1`
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-bottom: 8px;
`;

const Hint = styled.p`
  font-size: 7px;
  line-height: 1.7;
  letter-spacing: 0.04em;
  opacity: 0.75;
  text-transform: uppercase;
`;

const List = styled.ol`
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
`;

const Row = styled.button<{
  $active: boolean;
  $saved: boolean;
  $cursor: boolean;
}>`
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 8px;
  align-items: start;
  text-align: left;
  border: 2px solid ${LCD.border};
  outline: ${(p) => (p.$cursor && !p.$active ? `2px dashed ${LCD.border}` : 'none')};
  outline-offset: -6px;
  background: ${(p) => (p.$active ? LCD.pixel : 'transparent')};
  color: ${(p) => (p.$active ? LCD.bg : LCD.pixel)};
  padding: 10px 8px;
  box-shadow: ${(p) => (p.$saved && !p.$active ? `inset 2px 0 0 ${LCD.pixel}` : 'none')};
`;

const Index = styled.span`
  font-size: 8px;
  opacity: 0.7;
  padding-top: 1px;
`;

const Copy = styled.span`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

const Name = styled.span`
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.4;
`;

const Blurb = styled.span`
  font-size: 7px;
  line-height: 1.55;
  letter-spacing: 0.02em;
  opacity: 0.8;
  text-transform: uppercase;
`;

const Badge = styled.span`
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  padding-top: 2px;
`;

const Footer = styled.footer`
  margin-top: 14px;
  border-top: 2px solid ${LCD.border};
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const UseButton = styled.button`
  border: 2px solid ${LCD.border};
  background: ${LCD.pixel};
  color: ${LCD.bg};
  padding: 12px 10px;
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
`;

const Keys = styled.p`
  font-size: 7px;
  line-height: 1.7;
  letter-spacing: 0.04em;
  opacity: 0.7;
  text-transform: uppercase;
`;

function pad(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function MusicSelector() {
  const [cursor, setCursor] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState(() => snakeAudio.committedId());

  useEffect(() => {
    snakeAudio.enterSelector();
    return () => {
      snakeAudio.leaveSelector();
    };
  }, []);

  const playIndex = useCallback(
    (index: number) => {
      const theme = GAME_THEMES[index];
      setCursor(index);
      if (playingId === theme.id) {
        snakeAudio.stopPreview();
        setPlayingId(null);
        return;
      }
      snakeAudio.previewTheme(theme.id);
      setPlayingId(theme.id);
    },
    [playingId],
  );

  const saveCursor = useCallback(() => {
    const theme = GAME_THEMES[cursor];
    snakeAudio.commitTheme(theme.id);
    setSavedId(theme.id);
    if (playingId !== theme.id) {
      snakeAudio.previewTheme(theme.id);
      setPlayingId(theme.id);
    }
  }, [cursor, playingId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'arrowdown' || key === 's') {
        event.preventDefault();
        setCursor((prev) => (prev + 1) % GAME_THEMES.length);
        return;
      }
      if (key === 'arrowup' || key === 'w') {
        event.preventDefault();
        setCursor((prev) => (prev - 1 + GAME_THEMES.length) % GAME_THEMES.length);
        return;
      }
      if (key === ' ' || key === 'p') {
        event.preventDefault();
        playIndex(cursor);
        return;
      }
      if (key === 'enter') {
        event.preventDefault();
        saveCursor();
        return;
      }
      if (key >= '1' && key <= '9') {
        event.preventDefault();
        playIndex(Number(key) - 1);
        return;
      }
      if (key === '0') {
        event.preventDefault();
        playIndex(9);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [cursor, playIndex, saveCursor]);

  const selected = GAME_THEMES[cursor];

  return (
    <Shell>
      <Frame>
        <Header>
          <Title>Sound Test</Title>
          <Hint>Ten original chiptune themes. Play one, then save it for Snake.</Hint>
        </Header>
        <List>
          {GAME_THEMES.map((theme, index) => {
            const active = playingId === theme.id;
            const saved = savedId === theme.id;
            return (
              <Row
                key={theme.id}
                type="button"
                $active={active}
                $saved={saved}
                $cursor={cursor === index}
                onClick={() => { playIndex(index); }}
              >
                <Index>{cursor === index ? '>' : pad(index)}</Index>
                <Copy>
                  <Name>{theme.name}</Name>
                  <Blurb>{theme.blurb}</Blurb>
                </Copy>
                <Badge>{active ? 'Play' : saved ? 'In use' : ''}</Badge>
              </Row>
            );
          })}
        </List>
        <Footer>
          <UseButton type="button" onClick={saveCursor}>
            Use {selected.name} in game
          </UseButton>
          <Keys>
            Arrows move · Space play/stop · Enter save · 1–9 and 0 jump
          </Keys>
        </Footer>
      </Frame>
    </Shell>
  );
}
