"use client";

import { PinButton } from "./PinButton";
import { useNotebook } from "./useNotebook";

type Props = { caseNumber: number; evidenceId: string };

/** Lets the evidence page (a Server Component) offer pinning. */
export function EvidencePinButton({ caseNumber, evidenceId }: Props) {
  const { isPinned, togglePin } = useNotebook(caseNumber);
  const target = { kind: "evidence", evidenceId } as const;

  return <PinButton pinned={isPinned(target)} onToggle={() => togglePin(target)} />;
}
