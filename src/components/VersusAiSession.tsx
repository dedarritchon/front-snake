import { useCallback, useEffect, useState } from "react";
import { styled } from "styled-components";

import { snakeAudio } from "../audio/snakeAudio";
import { VersusBoard } from "../components/VersusBoard";
import { useFrontContext } from "../context/FrontContext";
import type { Direction } from "../game/types";
import { useAiMatch } from "../hooks/useAiMatch";

const Page = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #b7c86a;
  overflow: hidden;
`;

function playerName(
  guest: boolean,
  email: string,
  name?: string | null,
): string {
  if (guest) {
    return "Guest";
  }
  const fromName = name?.trim();
  if (fromName) {
    return fromName;
  }
  return email.split("@")[0] || "Player";
}

export function VersusAiSession({ onSolo }: { onSolo: () => void }) {
  const { context, guest } = useFrontContext();
  const name = playerName(
    guest,
    context?.teammate.email ?? "",
    context?.teammate.name,
  );
  const {
    playerId,
    state,
    liveRef,
    prevLiveRef,
    lastTickAtRef,
    players,
    personalView,
    eliminated,
    sendDirection,
    sendFire,
    sendTurbo,
    sendBomb,
    rematch,
    replaySlowMo,
  } = useAiMatch(name);
  const [muted, setMuted] = useState(() => snakeAudio.isMuted());

  const toggleMute = useCallback(() => {
    setMuted(snakeAudio.toggleMute());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      let direction: Direction | null = null;
      if (key === "arrowup" || key === "w") {
        direction = "up";
      } else if (key === "arrowdown" || key === "s") {
        direction = "down";
      } else if (key === "arrowleft" || key === "a") {
        direction = "left";
      } else if (key === "arrowright" || key === "d") {
        direction = "right";
      }
      if (direction) {
        event.preventDefault();
        if (!event.repeat) {
          sendDirection(direction);
        }
        return;
      }
      if (event.key === "Shift") {
        event.preventDefault();
        if (!event.repeat) {
          sendTurbo();
        }
        return;
      }
      if (event.code === "Space" || key === " ") {
        event.preventDefault();
        if (!event.repeat) {
          sendFire();
        }
        return;
      }
      if (key === "b") {
        event.preventDefault();
        if (!event.repeat) {
          sendBomb();
        }
        return;
      }
      if (key === "m") {
        event.preventDefault();
        if (!event.repeat) {
          toggleMute();
        }
        return;
      }
      if (key === "enter") {
        event.preventDefault();
        if (!event.repeat) {
          rematch();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [rematch, sendBomb, sendDirection, sendFire, sendTurbo, toggleMute]);

  return (
    <Page>
      <VersusBoard
        ai
        state={state}
        liveRef={liveRef}
        prevLiveRef={prevLiveRef}
        lastTickAtRef={lastTickAtRef}
        players={players}
        youId={playerId}
        isHost
        ready={false}
        muted={muted}
        error={null}
        link="connected"
        copied={false}
        roomId=""
        personalView={personalView}
        youOut={eliminated}
        onToggleMute={toggleMute}
        onCopyId={() => undefined}
        onReady={rematch}
        onReplay={replaySlowMo}
        onSolo={onSolo}
        onChangeColor={() => undefined}
      />
    </Page>
  );
}
