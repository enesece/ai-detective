type Props = { label: string; value: string; sub: string };

/** One headline number, newspaper style: small caps label, big figure, a line of context. */
export function StatTile({ label, value, sub }: Props) {
  return (
    <div className="border-ink border-t-[3px] pt-3">
      <p className="font-sans text-xs font-bold tracking-[0.2em] uppercase">{label}</p>
      <p className="font-display mt-1 text-5xl leading-none tabular-nums">{value}</p>
      <p className="text-muted mt-2 text-sm">{sub}</p>
    </div>
  );
}
