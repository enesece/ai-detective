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

/** Public evidence, translated, so the notebook can show a pinned item in a pop-up. */
export type EvidenceOption = {
  id: string;
  title: string;
  /** Translated kind, e.g. "Document". */
  kind: string;
  /** Translated place where it was found, if known. */
  place: string | null;
  description: string;
};
