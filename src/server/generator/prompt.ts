import "server-only";

import type { CaseDraft } from "@/lib/case/schema";
import type { CheckResult } from "./logic-checks";

export type Difficulty = CaseDraft["difficulty"];

/*
 * Prompt for writing a new case. The model gets the rules, one finished case
 * as an example of format and quality, and a theme so cases don't all look
 * alike. Its answer is forced into the case's JSON Schema (structured output),
 * then checked by Zod, the logic checks and the blind solver.
 */

/** Rotated so consecutive cases differ in place, era and mood. */
export const THEMES = [
  "a 1920s Orient-style sleeper train stuck in snow in eastern Anatolia",
  "a 1950s Bosphorus waterfront mansion (yalı) during a family engagement dinner",
  "a 1970s ski lodge in the Alps cut off by an avalanche",
  "a modern tech start-up's weekend retreat in a converted Cappadocia cave hotel",
  "a Victorian theatre on opening night in London",
  "a 1960s film set at a Roman villa",
  "a remote Scottish lighthouse during a storm, 1930s",
  "a vineyard harvest festival in 1980s Bordeaux",
  "a research station in Antarctica, present day",
  "a jazz club in 1940s Chicago after closing time",
  "an Aegean island hotel off-season, 1990s",
  "a museum gala in present-day Istanbul",
  "a transatlantic ocean liner, 1912",
  "a monastery library in the Italian Alps, 1890s",
  "a chess tournament in 1970s Reykjavik",
  "a country auction house in 1950s England",
] as const;

export function pickTheme(seed: number = Date.now()): string {
  return THEMES[Math.abs(seed) % THEMES.length] ?? THEMES[0];
}

const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  easy: "EASY: the key clues are fairly direct, one red herring, the killer's lie breaks with one good question.",
  medium:
    "MEDIUM: the player must combine a clue with an interrogation answer; one or two red herrings.",
  hard: "HARD: the decisive contradiction only appears when two suspects' testimonies and a clue are put side by side; two red herrings and a second suspect with a believable motive.",
};

export const GENERATOR_SYSTEM = `You write fair-play murder mysteries for a daily browser game.
The player reads a public case file, studies 3-5 pieces of evidence, interrogates 4 suspects (played by an AI from each suspect's private notes, 20 questions in total), then names the killer, the motive and the key evidence.

HARD RULES (a program checks them; a case that breaks one is thrown away)
- Exactly 4 suspects, exactly one killer. The victim is not a suspect.
- The timeline is the hidden truth: sorted by time, minute-precise, every movement of every suspect and the victim from before the murder until the body is found.
- At exactTimeOfDeath the killer has a timeline entry AT the crime scene (at <= time <= until). No innocent suspect is at the crime scene then, and each innocent has a timeline entry somewhere else that covers that minute.
- Nobody is in two places at once. The victim has no entries after the time of death.
- exactTimeOfDeath lies inside estimatedTimeOfDeath (a 20-40 minute window).
- At least two independent clues point to the killer (different places, or different kinds), and at least one of them is found somewhere the killer goes in the timeline.
- The killer is implicated by more clues than any other suspect. Every keyEvidenceId points to the killer. At least one clue is a red herring pointing to an innocent.
- The killer's claimed alibi is false and the killer tells at least one lie.
- Exactly 3 hints, from a gentle nudge, to where to look, to nearly the answer (without naming the killer outright).

FAIR PLAY (a separate solver checks this without seeing the solution)
- The public case file alone must NOT be enough to be sure. The decisive contradiction must need the interrogations.
- No single piece of evidence identifies the killer on its own: no names, initials, signatures, sizes or belongings that fit only one suspect. Each clue alone fits at least two suspects; it becomes decisive only next to something a suspect says.
- The killer's public initial statement must not be disprovable by public evidence alone. What breaks it is an innocent suspect's testimony (seen, heard, a time) that the player has to ask for.
- Evidence descriptions state observations, never what they prove or who they belong to.
- Innocent suspects hold the testimony that breaks the killer's alibi (something they saw or heard). Their "hides" are given up under a condition a player can actually meet: being asked about a topic, or confronted with a named piece of evidence or another suspect's words. Use "Never" only for the killer's confession.
- Every fact needed for the solution is discoverable; nothing depends on information the player can't get.
- Each innocent has a secret of their own and a reason to look suspicious, so every interrogation matters.

WRITING
- Player-visible text is in both English (en) and natural, idiomatic Turkish (tr): not word-for-word. Proper names stay the same in both. Write clock times as digits (22:05) in both languages.
- Suspects' private notes (personality, alibi, knows, hides, lies) are English only; the AI actor reads them.
- "knows" and "hides" are written as the suspect's own facts with exact times. The killer's "knows" includes how and why they did it.
- Initial statements: 2-4 sentences, in the suspect's voice, consistent with their claimed alibi and lies, giving nothing decisive away.
- Evidence descriptions are what the detective observes, not conclusions. Never name the killer in public text.
- trueStory: 1-2 short paragraphs. method: one or two sentences.
- ids are short kebab-case slugs (e.g. "burned-letter"). Location ids are reused everywhere.
- Original characters and plot; do not copy the example's story, names, method or clues.`;

export function buildGeneratorPrompt(options: {
  difficulty: Difficulty;
  theme: string;
  example: CaseDraft;
  avoidTitles: string[];
}): string {
  return [
    `Write a new ${options.difficulty} case.`,
    `Theme: ${options.theme}.`,
    DIFFICULTY_GUIDE[options.difficulty],
    options.avoidTitles.length > 0
      ? `Existing cases (do not repeat their titles or premises): ${options.avoidTitles.join("; ")}.`
      : "",
    "",
    "EXAMPLE of a finished case (format and level of detail only; write a completely different story):",
    JSON.stringify(options.example),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Second chance: the same case with the problems listed, to be fixed. */
export function buildRepairPrompt(previousJson: string, problems: string[]): string {
  return [
    "Your case below has these problems. Return the whole corrected case as JSON. Change only what is needed to fix them, keeping the story consistent everywhere (timeline, private notes, evidence, solution, hints and both languages).",
    "",
    "PROBLEMS",
    ...problems.map((p) => `- ${p}`),
    "",
    "CASE",
    previousJson,
  ].join("\n");
}

export function describeProblems(failed: CheckResult[]): string[] {
  return failed.map((r) => `${r.id}: ${r.message}`);
}
