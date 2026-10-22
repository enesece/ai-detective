/*
 * A list of horizontal bars, one per check: label, a single-hue bar on a 0-100%
 * track, and the value written next to it (so nothing depends on colour alone,
 * and the list doubles as a table). Each row has a title for a hover tooltip.
 */

export type RateRow = { key: string; label: string; rate: number; detail?: string };

type Props = { title: string; rows: RateRow[] };

const percent = (rate: number) => `${(Math.round(rate * 1000) / 10).toString()}%`;

export function RateBars({ title, rows }: Props) {
  return (
    <figure>
      <figcaption className="font-sans text-xs font-bold tracking-[0.2em] uppercase">
        {title}
      </figcaption>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li
            key={row.key}
            title={`${row.label}: ${percent(row.rate)}${row.detail ? ` (${row.detail})` : ""}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 sm:grid-cols-[minmax(0,16rem)_1fr_7.5rem]"
          >
            <span className="leading-snug">{row.label}</span>
            <span
              aria-hidden
              className="bg-rule/60 relative order-last col-span-2 mt-1 h-2 sm:order-none sm:col-span-1 sm:mt-0"
            >
              <span
                className="bg-accent absolute inset-y-0 left-0 rounded-r-[4px]"
                style={{ width: `${Math.max(0, Math.min(1, row.rate)) * 100}%` }}
              />
            </span>
            <span className="text-right font-sans text-sm font-bold tabular-nums">
              {percent(row.rate)}
              {row.detail && <span className="text-muted ml-2 font-normal">{row.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
