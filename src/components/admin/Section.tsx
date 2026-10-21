import type { ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-rule bg-card space-y-3 rounded-lg border p-4">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}
