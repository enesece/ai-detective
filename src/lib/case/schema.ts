import { z } from "zod";

/*
 * Case file format.
 *
 * A case has two halves that map 1:1 to the `cases.public_briefing` and
 * `cases.secret` database columns:
 *   - `public`: safe to send to the browser (briefing, suspect cards, evidence).
 *   - `secret`: server only (who did it, real timeline, every suspect's secrets).
 *
 * This file only describes the *shape*; it holds no secret data, so it can be
 * imported anywhere. Secret *values* live under src/server/.
 */

export const LOCALES = ["en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

/** Player-visible text, always in both languages. */
export const LocalizedTextSchema = z.strictObject({
  en: z.string().trim().min(1),
  tr: z.string().trim().min(1),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a kebab-case slug");

/** Clock time on the night of the crime, "HH:MM" (24h). Cases stay within one day. */
const ClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM");

const TimeWindowSchema = z.strictObject({ from: ClockTime, to: ClockTime });

/** Reserved actor id for the victim in the timeline. */
export const VICTIM_ACTOR_ID = "victim";

/* ------------------------------------------------------------------ */
/* PUBLIC: safe to send to the browser                                 */
/* ------------------------------------------------------------------ */

export const PublicSuspectSchema = z.strictObject({
  id: Slug,
  /** Proper names are not translated. */
  name: z.string().trim().min(1),
  role: LocalizedTextSchema,
  /** Short bio shown on the suspect card. */
  profile: LocalizedTextSchema,
  /** Written once per case, so reading it costs no AI call. */
  initialStatement: LocalizedTextSchema,
});

export const EVIDENCE_KINDS = [
  "document",
  "object",
  "receipt",
  "phone",
  "photo",
  "testimony",
] as const;

export const PublicEvidenceSchema = z.strictObject({
  id: Slug,
  kind: z.enum(EVIDENCE_KINDS),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema,
  /** -> locations[].id */
  foundAt: Slug,
});

export const PublicBriefingSchema = z.strictObject({
  title: LocalizedTextSchema,
  setting: z.strictObject({
    place: LocalizedTextSchema,
    date: z.iso.date(),
    summary: LocalizedTextSchema,
  }),
  victim: z.strictObject({
    name: z.string().trim().min(1),
    description: LocalizedTextSchema,
  }),
  /** -> locations[].id */
  crimeSceneId: Slug,
  /** The coroner's window. The exact minute is secret. */
  estimatedTimeOfDeath: TimeWindowSchema,
  locations: z.array(z.strictObject({ id: Slug, name: LocalizedTextSchema })).min(2),
  suspects: z.array(PublicSuspectSchema).length(4),
  evidence: z.array(PublicEvidenceSchema).min(3).max(5),
  /** Choices on the accusation screen; the true motive is one of them. */
  motiveOptions: z
    .array(z.strictObject({ id: Slug, label: LocalizedTextSchema }))
    .min(3)
    .max(6),
});

/* ------------------------------------------------------------------ */
/* SECRET: server only, never sent to the client                       */
/* ------------------------------------------------------------------ */

/*
 * Suspect secrets are English only: they are never shown to the player, only
 * fed into that suspect's AI prompt, and the model answers in the player's language.
 */
export const SuspectSecretSchema = z.strictObject({
  suspectId: Slug,
  /** Voice and temperament for the AI prompt. */
  personality: z.string().trim().min(1),
  alibi: z.strictObject({
    claimed: z.string().trim().min(1),
    truth: z.string().trim().min(1),
  }),
  knows: z.array(z.string().trim().min(1)).min(1),
  hides: z.array(
    z.strictObject({
      secret: z.string().trim().min(1),
      /** When the suspect gives this up, e.g. "if shown the pawn ticket". */
      revealWhen: z.string().trim().min(1),
    }),
  ),
  lies: z.array(
    z.strictObject({
      topic: z.string().trim().min(1),
      lie: z.string().trim().min(1),
      truth: z.string().trim().min(1),
    }),
  ),
});

export const TimelineEventSchema = z.strictObject({
  at: ClockTime,
  until: ClockTime.optional(),
  /** A suspect id, VICTIM_ACTOR_ID, or null for events with no single actor. */
  actorId: Slug.nullable(),
  /** -> locations[].id */
  locationId: Slug,
  /** Shown in the "true story" reveal. */
  event: LocalizedTextSchema,
});

export const EvidenceSecretSchema = z.strictObject({
  evidenceId: Slug,
  /** Suspects this clue implicates (may be empty for a red herring). */
  pointsTo: z.array(Slug),
  /** Shown on the result screen. */
  explanation: LocalizedTextSchema,
});

export const CaseSecretSchema = z.strictObject({
  exactTimeOfDeath: ClockTime,
  suspects: z.array(SuspectSecretSchema).length(4),
  evidence: z.array(EvidenceSecretSchema).min(3).max(5),
  timeline: z.array(TimelineEventSchema).min(5),
  /**
   * Hints, from a gentle nudge to nearly the answer. Unlocked one at a time
   * (each costs points), so they live in the secret half.
   */
  hints: z.array(LocalizedTextSchema).min(1).max(3),
  solution: z.strictObject({
    killerId: Slug,
    /** -> motiveOptions[].id */
    motiveId: Slug,
    method: LocalizedTextSchema,
    /** Picking any of these on the accusation screen counts as correct. */
    keyEvidenceIds: z.array(Slug).min(1),
    trueStory: LocalizedTextSchema,
  }),
});

/* ------------------------------------------------------------------ */
/* FULL CASE + cross-reference checks                                  */
/* ------------------------------------------------------------------ */

const CaseShapeSchema = z.strictObject({
  caseNumber: z.number().int().positive(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  public: PublicBriefingSchema,
  secret: CaseSecretSchema,
});

/** A generated case before approval: no case number yet (given on approval). */
const CaseDraftShapeSchema = CaseShapeSchema.omit({ caseNumber: true });

type CaseContent = z.infer<typeof CaseDraftShapeSchema>;

/**
 * Referential integrity only: every id points at something that exists.
 * Story logic (is the killer at the scene at the time of death? are there two
 * independent clues?) is a separate check, added in phase 4.
 */
function checkReferences(c: CaseContent, ctx: z.RefinementCtx): void {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });

  const { public: pub, secret } = c;
  const locationIds = new Set(pub.locations.map((l) => l.id));
  const suspectIds = new Set(pub.suspects.map((s) => s.id));
  const evidenceIds = new Set(pub.evidence.map((e) => e.id));
  const motiveIds = new Set(pub.motiveOptions.map((m) => m.id));

  const reportDuplicates = (ids: string[], path: string[]) => {
    if (new Set(ids).size !== ids.length) issue(path, "ids must be unique");
  };
  reportDuplicates(
    pub.locations.map((l) => l.id),
    ["public", "locations"],
  );
  reportDuplicates(
    pub.suspects.map((s) => s.id),
    ["public", "suspects"],
  );
  reportDuplicates(
    pub.evidence.map((e) => e.id),
    ["public", "evidence"],
  );
  reportDuplicates(
    pub.motiveOptions.map((m) => m.id),
    ["public", "motiveOptions"],
  );

  if (suspectIds.has(VICTIM_ACTOR_ID)) {
    issue(["public", "suspects"], `"${VICTIM_ACTOR_ID}" is a reserved id`);
  }
  if (!locationIds.has(pub.crimeSceneId)) {
    issue(["public", "crimeSceneId"], "unknown location");
  }
  pub.evidence.forEach((e, i) => {
    if (!locationIds.has(e.foundAt))
      issue(["public", "evidence", i, "foundAt"], "unknown location");
  });

  // Secret suspects/evidence must mirror the public ones exactly.
  const secretSuspectIds = secret.suspects.map((s) => s.suspectId);
  if (!sameSet(secretSuspectIds, suspectIds)) {
    issue(["secret", "suspects"], "must cover exactly the public suspects");
  }
  const secretEvidenceIds = secret.evidence.map((e) => e.evidenceId);
  if (!sameSet(secretEvidenceIds, evidenceIds)) {
    issue(["secret", "evidence"], "must cover exactly the public evidence");
  }
  secret.evidence.forEach((e, i) => {
    e.pointsTo.forEach((id, j) => {
      if (!suspectIds.has(id)) issue(["secret", "evidence", i, "pointsTo", j], "unknown suspect");
    });
  });

  // Timeline: known actors and places, sorted by time.
  secret.timeline.forEach((t, i) => {
    if (t.actorId !== null && t.actorId !== VICTIM_ACTOR_ID && !suspectIds.has(t.actorId)) {
      issue(["secret", "timeline", i, "actorId"], "unknown actor");
    }
    if (!locationIds.has(t.locationId)) {
      issue(["secret", "timeline", i, "locationId"], "unknown location");
    }
    if (t.until !== undefined && t.until < t.at) {
      issue(["secret", "timeline", i, "until"], "must not be before `at`");
    }
    const prev = secret.timeline[i - 1];
    if (prev && t.at < prev.at) issue(["secret", "timeline", i, "at"], "timeline must be sorted");
  });

  // Time of death must sit inside the public window.
  const window = pub.estimatedTimeOfDeath;
  if (window.to < window.from) {
    issue(["public", "estimatedTimeOfDeath"], "`to` must not be before `from`");
  }
  if (secret.exactTimeOfDeath < window.from || secret.exactTimeOfDeath > window.to) {
    issue(["secret", "exactTimeOfDeath"], "must fall inside estimatedTimeOfDeath");
  }

  // Solution.
  const { solution } = secret;
  if (!suspectIds.has(solution.killerId)) {
    issue(["secret", "solution", "killerId"], "unknown suspect");
  }
  if (!motiveIds.has(solution.motiveId)) {
    issue(["secret", "solution", "motiveId"], "unknown motive option");
  }
  solution.keyEvidenceIds.forEach((id, i) => {
    if (!evidenceIds.has(id))
      issue(["secret", "solution", "keyEvidenceIds", i], "unknown evidence");
  });
}

function sameSet(ids: string[], expected: Set<string>): boolean {
  return (
    ids.length === expected.size &&
    new Set(ids).size === ids.length &&
    ids.every((id) => expected.has(id))
  );
}

export const CaseSchema = CaseShapeSchema.superRefine(checkReferences);
export const CaseDraftSchema = CaseDraftShapeSchema.superRefine(checkReferences);
/** The draft's shape without the cross-reference checks, e.g. for a JSON Schema. */
export { CaseDraftShapeSchema };

export type CaseFile = z.infer<typeof CaseSchema>;
export type CaseDraft = z.infer<typeof CaseDraftSchema>;
export type PublicBriefing = z.infer<typeof PublicBriefingSchema>;
export type PublicSuspect = z.infer<typeof PublicSuspectSchema>;
export type PublicEvidence = z.infer<typeof PublicEvidenceSchema>;
export type CaseSecret = z.infer<typeof CaseSecretSchema>;
export type SuspectSecret = z.infer<typeof SuspectSecretSchema>;

/** What the browser is allowed to receive. */
export type PublicCase = Pick<CaseFile, "caseNumber" | "difficulty"> & {
  briefing: PublicBriefing;
};
