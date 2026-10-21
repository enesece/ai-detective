/** Placeholder shown for a moment while a page's URL-dependent content streams in. */
export function PageFallback() {
  return (
    <div className="animate-pulse space-y-4 pt-10" aria-hidden>
      <div className="bg-rule h-4 w-40 rounded" />
      <div className="bg-rule h-10 w-3/4 rounded" />
      <div className="bg-rule h-24 rounded" />
    </div>
  );
}
