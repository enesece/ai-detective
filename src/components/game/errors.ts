import { GAME_ERRORS, type GameError } from "@/lib/game/rules";

/** Reads `{ error }` from an API response body; anything unexpected counts as unavailable. */
export function toGameError(body: unknown): GameError {
  const code =
    typeof body === "object" && body !== null && "error" in body ? body.error : undefined;
  return GAME_ERRORS.find((e) => e === code) ?? "ai_unavailable";
}
