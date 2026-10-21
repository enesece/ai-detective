import type { Appearance } from "@/lib/case/schema";

/** The only suspect data the interrogation UI receives: public, already translated. */
export type SuspectOption = {
  id: string;
  name: string;
  role: string;
  statement: string;
  /** For the drawn portrait; public visual traits only. */
  appearance?: Appearance;
};

/** Public evidence titles, so the notebook can show pinned evidence. */
export type EvidenceOption = { id: string; title: string };
