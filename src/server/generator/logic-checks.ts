import "server-only";

import { VICTIM_ACTOR_ID, type CaseDraft } from "@/lib/case/schema";

/*
 * Story logic checks for a generated case, in plain code (no AI).
 *
 * Zod already guarantees the shape and that every id points at something
 * real. These checks ask whether the *story* holds together and is fair:
 * the killer could have done it, the innocents couldn't, and the clues lead
 * to the killer and not equally to someone else.
 *
 * "error" rejects the case; "warning" is shown to the admin only.
 */

export type CheckSeverity = "error" | "warning";

export type CheckResult = {
  id: string;
  severity: CheckSeverity;
  ok: boolean;
  message: string;
};

type Interval = { start: number; end: number; locationId: string };

/** "22:05" -> minutes since midnight. */
function toMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function intervalsOf(c: CaseDraft, actorId: string): Interval[] {
  return c.secret.timeline
    .filter((t) => t.actorId === actorId)
    .map((t) => ({
      start: toMinutes(t.at),
      end: toMinutes(t.until ?? t.at),
      locationId: t.locationId,
    }));
}

function covers(interval: Interval, minute: number): boolean {
  return interval.start <= minute && minute <= interval.end;
}

/** Two stays overlap if they share more than a boundary minute; two instants overlap if equal. */
function overlaps(a: Interval, b: Interval): boolean {
  if (a.start === a.end && b.start === b.end) return a.start === b.start;
  return a.start < b.end && b.start < a.end;
}

export function runLogicChecks(c: CaseDraft): CheckResult[] {
  const { public: pub, secret } = c;
  const killerId = secret.solution.killerId;
  const death = toMinutes(secret.exactTimeOfDeath);
  const scene = pub.crimeSceneId;
  const suspectIds = pub.suspects.map((s) => s.id);
  const innocents = suspectIds.filter((id) => id !== killerId);
  const nameOf = (id: string) => pub.suspects.find((s) => s.id === id)?.name ?? id;
  const evidenceLocation = new Map(pub.evidence.map((e) => [e.id, e.foundAt]));
  const evidenceKind = new Map(pub.evidence.map((e) => [e.id, e.kind]));

  const results: CheckResult[] = [];
  const check = (id: string, severity: CheckSeverity, ok: boolean, message: string) =>
    results.push({ id, severity, ok, message });

  // 1. The killer was at the scene at the time of death.
  const killerStays = intervalsOf(c, killerId);
  check(
    "killer_at_scene",
    "error",
    killerStays.some((i) => i.locationId === scene && covers(i, death)),
    `${nameOf(killerId)} must be at the crime scene at ${secret.exactTimeOfDeath} in the timeline.`,
  );

  // 2. No innocent was at the scene at the time of death.
  const innocentsAtScene = innocents.filter((id) =>
    intervalsOf(c, id).some((i) => i.locationId === scene && covers(i, death)),
  );
  check(
    "innocents_away_from_scene",
    "error",
    innocentsAtScene.length === 0,
    innocentsAtScene.length === 0
      ? "No innocent suspect is at the scene at the time of death."
      : `At the scene at the time of death: ${innocentsAtScene.map(nameOf).join(", ")}.`,
  );

  // 3. Every innocent is placed somewhere at the time of death (a checkable alibi).
  const unplaced = innocents.filter((id) => !intervalsOf(c, id).some((i) => covers(i, death)));
  check(
    "innocents_have_alibis",
    "warning",
    unplaced.length === 0,
    unplaced.length === 0
      ? "Every innocent suspect is somewhere specific at the time of death."
      : `Not placed anywhere at the time of death: ${unplaced.map(nameOf).join(", ")}.`,
  );

  // 4. Nobody is in two places at once.
  const clashes: string[] = [];
  for (const actorId of [...suspectIds, VICTIM_ACTOR_ID]) {
    const stays = intervalsOf(c, actorId);
    stays.forEach((a, i) =>
      stays.slice(i + 1).forEach((b) => {
        if (a.locationId !== b.locationId && overlaps(a, b)) {
          clashes.push(
            `${actorId === VICTIM_ACTOR_ID ? "victim" : nameOf(actorId)} (${a.locationId} / ${b.locationId})`,
          );
        }
      }),
    );
  }
  check(
    "no_double_presence",
    "error",
    clashes.length === 0,
    clashes.length === 0
      ? "Nobody is in two places at once."
      : `In two places at once: ${clashes.join("; ")}.`,
  );

  // 5. At least two independent clues point to the killer: different items,
  //    found in different places or of different kinds.
  const killerClues = secret.evidence.filter((e) => e.pointsTo.includes(killerId));
  const independent =
    killerClues.length >= 2 &&
    (new Set(killerClues.map((e) => evidenceLocation.get(e.evidenceId))).size >= 2 ||
      new Set(killerClues.map((e) => evidenceKind.get(e.evidenceId))).size >= 2);
  check(
    "two_independent_clues",
    "error",
    independent,
    `${killerClues.length} clue(s) point to the killer; at least 2 from different places or of different kinds are needed.`,
  );

  // 6. The killer is the most implicated suspect: strictly, except in hard cases, where
  // another suspect may look just as guilty on paper and only the interrogations
  // (an innocent's testimony, unlocked by evidence) tell them apart.
  const implicated = (id: string) => secret.evidence.filter((e) => e.pointsTo.includes(id)).length;
  const allowTie = c.difficulty === "hard";
  const rivals = innocents.filter((id) =>
    allowTie ? implicated(id) > implicated(killerId) : implicated(id) >= implicated(killerId),
  );
  check(
    "killer_most_implicated",
    "error",
    rivals.length === 0,
    rivals.length === 0
      ? `The killer is implicated by ${implicated(killerId)} clue(s), ${allowTie ? "no fewer than" : "more than"} anyone else.`
      : `${allowTie ? "More" : "As"} implicated ${allowTie ? "than" : "as"} the killer: ${rivals.map(nameOf).join(", ")}.`,
  );

  // 7. Every key evidence item points to the killer.
  const badKeys = secret.solution.keyEvidenceIds.filter(
    (id) => !secret.evidence.find((e) => e.evidenceId === id)?.pointsTo.includes(killerId),
  );
  check(
    "key_evidence_points_to_killer",
    "error",
    badKeys.length === 0,
    badKeys.length === 0
      ? "All key evidence points to the killer."
      : `Key evidence not pointing to the killer: ${badKeys.join(", ")}.`,
  );

  // 8. The killer's story has a hole: a false alibi and at least one lie.
  const killerSecret = secret.suspects.find((s) => s.suspectId === killerId);
  check(
    "killer_lies",
    "error",
    !!killerSecret &&
      killerSecret.lies.length > 0 &&
      killerSecret.alibi.claimed.trim() !== killerSecret.alibi.truth.trim(),
    "The killer must claim a false alibi and tell at least one lie.",
  );

  // 9. Clues match the timeline: at least one clue against the killer was
  //    found somewhere the killer actually went.
  const killerPlaces = new Set(killerStays.map((i) => i.locationId));
  check(
    "clue_matches_timeline",
    "error",
    killerClues.some((e) => killerPlaces.has(evidenceLocation.get(e.evidenceId) ?? "")),
    "At least one clue against the killer must be found at a place the killer visits in the timeline.",
  );

  // 10. The victim is alive before the death and nothing they do comes after it.
  const victimAfter = intervalsOf(c, VICTIM_ACTOR_ID).filter((i) => i.start > death);
  check(
    "victim_not_active_after_death",
    "error",
    victimAfter.length === 0,
    "The victim must not appear in the timeline after the time of death.",
  );

  // 11. A red herring: some evidence points to an innocent.
  check(
    "has_red_herring",
    "warning",
    secret.evidence.some((e) => e.pointsTo.some((id) => id !== killerId)),
    "At least one clue should point to an innocent suspect.",
  );

  // 12. Every innocent hides something, so each interrogation is worth it.
  const noSecrets = secret.suspects
    .filter((s) => s.suspectId !== killerId && s.hides.length === 0)
    .map((s) => nameOf(s.suspectId));
  check(
    "innocents_have_secrets",
    "warning",
    noSecrets.length === 0,
    noSecrets.length === 0
      ? "Every innocent suspect hides something."
      : `Hides nothing: ${noSecrets.join(", ")}.`,
  );

  // 13. Three graded hints.
  check(
    "three_hints",
    "warning",
    secret.hints.length === 3,
    `${secret.hints.length} hint(s); 3 are expected (nudge → where to look → nearly the answer).`,
  );

  // 14. Turkish text is really translated, not a copy of the English.
  const untranslated = collectLocalized(c).filter(
    (t) => t.en.length > 20 && t.en.trim() === t.tr.trim(),
  );
  // One short identical text is usually a proper name (a place, a ship); more is a missed translation.
  const onlyAName = untranslated.length === 1 && (untranslated[0]?.en.length ?? 0) <= 60;
  check(
    "turkish_translated",
    onlyAName ? "warning" : "error",
    untranslated.length === 0,
    untranslated.length === 0
      ? "All player-facing text has a Turkish version."
      : `${untranslated.length} text(s) are identical in English and Turkish.`,
  );

  // Confrontation: some secrets must be unlocked by showing a named piece of evidence
  // ("Show evidence" in the game). Required from medium up; a nudge for easy cases.
  const confrontations = secret.suspects.flatMap((s) =>
    s.hides.filter((h) => pub.evidence.some((e) => mentionsEvidence(h.revealWhen, e))),
  );
  check(
    "confrontation_reveals",
    c.difficulty === "easy" ? "warning" : "error",
    confrontations.length >= MIN_CONFRONTATIONS,
    `${confrontations.length} secret(s) open when a named piece of evidence is shown; at least ${MIN_CONFRONTATIONS} must ("Reveal when shown the <evidence title>").`,
  );

  return results;
}

const MIN_CONFRONTATIONS = 2;
const STOP_WORDS = new Set(["with", "from", "that", "this", "their", "the", "into", "about"]);

/** The evidence's meaningful title words (e.g. "half", "burned", "letter"). */
function titleWords(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

/**
 * Whether a reveal condition names this evidence: its id, or enough of its
 * title words ("shown the burned letter" names "Half-burned letter").
 */
export function mentionsEvidence(
  text: string,
  evidence: { id: string; title: { en: string } },
): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(evidence.id)) return true;
  const words = titleWords(evidence.title.en);
  if (words.length === 0) return false;
  const found = words.filter((w) => new RegExp(`\\b${w}`).test(lower)).length;
  return found >= Math.min(2, words.length);
}

/** Every { en, tr } pair in the case. */
function collectLocalized(value: unknown): { en: string; tr: string }[] {
  if (Array.isArray(value)) return value.flatMap(collectLocalized);
  if (value === null || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (typeof record.en === "string" && typeof record.tr === "string") {
    return [{ en: record.en, tr: record.tr }];
  }
  return Object.values(record).flatMap(collectLocalized);
}

export function failedErrors(results: CheckResult[]): CheckResult[] {
  return results.filter((r) => !r.ok && r.severity === "error");
}
