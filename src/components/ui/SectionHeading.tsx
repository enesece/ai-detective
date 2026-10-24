import type { ReactNode } from "react";

type Props = { children: ReactNode; aside?: ReactNode; id?: string };

/** A newspaper section head: Didone title over an ink rule, optional note on the right. */
export function SectionHeading({ children, id }: Props) {
  return (
    <div className="border-ink mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b pb-2">
      <h2 id={id} className="font-display text-3xl font-normal">
        {children}
      </h2>
    </div>
  );
}
