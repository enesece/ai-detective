/** The only suspect data the interrogation UI receives: public, already translated. */
export type SuspectOption = { id: string; name: string; role: string; statement: string };

/** Public evidence titles, so the notebook can show pinned evidence. */
export type EvidenceOption = { id: string; title: string };
