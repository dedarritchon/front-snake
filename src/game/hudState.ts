import type { MpState } from "./multiplayerEngine";
import type { GameState } from "./types";

export function mpHudKey(state: MpState | null): string {
  if (!state) {
    return "";
  }
  let deaths = "";
  for (const death of state.lastDeaths) {
    deaths += `${death.playerId}:${death.cause}:${death.otherId ?? ""},`;
  }
  let snakes = "";
  for (const snake of state.snakes) {
    snakes += `${snake.id}:${snake.name}:${snake.color}:${snake.alive ? 1 : 0}:${snake.body.length}:${snake.score}:${snake.power}:${snake.roundWins}|`;
  }
  let walls = "";
  for (const corpse of state.corpses) {
    walls += `${corpse.ownerId}:${corpse.life},`;
  }
  let shame = "";
  for (const row of state.humiliations) {
    shame += `${row.victimId}:${row.attackerId}:${row.life},`;
  }
  return `${state.status}:${state.matchRound}:${state.roundSeq}:${state.replayIndex}:${state.countdown}:${state.winnerId ?? ""}:${state.roundWinnerId ?? ""}:${state.hostLeft ? 1 : 0}:${state.replay.length}:${deaths}:${snakes}:${walls}:${shame}`;
}

export function soloHudKey(state: GameState): string {
  return `${state.status}:${state.score}:${state.highScore}`;
}
