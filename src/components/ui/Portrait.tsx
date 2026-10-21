/** Placeholder portrait: the suspect's initials on a tinted plate, like an engraving slot. */
export function Portrait({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .replace(/^(Dr|Mr|Mrs|Ms|Lady|Sir|Lord)\.?\s+/i, "")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      aria-hidden
      className={`bg-tint border-ink text-muted font-display flex items-end justify-center border pb-3 ${className}`}
    >
      <span className="text-4xl">{initials}</span>
    </div>
  );
}
