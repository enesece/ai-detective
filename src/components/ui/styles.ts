/*
 * Shared Tailwind class strings for the "Evening Gazette" look, so buttons,
 * labels and headings stay consistent across pages.
 */

/** Small uppercase sans label, e.g. "TODAY'S CASE · NO. 1". */
export const kicker = "font-sans text-xs font-bold uppercase tracking-[0.2em]";

/** Quieter label for metadata and form fields. */
export const label = "font-sans text-[13px] font-medium uppercase tracking-[0.15em] text-muted";

const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 px-7 font-sans text-sm font-bold uppercase tracking-[0.15em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** The one main action on a page. */
export const buttonPrimary = `${buttonBase} bg-accent text-paper hover:bg-accent-dark`;
/** A strong secondary action (e.g. "Ask"). */
export const buttonInk = `${buttonBase} bg-ink text-paper hover:bg-accent-dark`;
/** Outlined, for alternatives next to a primary button. */
export const buttonOutline = `${buttonBase} border border-ink text-ink hover:bg-ink hover:text-paper`;

/** Text link in caps, e.g. "EXAMINE →". */
export const linkCaps =
  "font-sans text-[13px] font-bold uppercase tracking-[0.15em] text-accent hover:underline";

/** Card/clipping on the page: square, hairline border. */
export const panel = "border border-ink/80 bg-card";
