import type { LocalizedText } from "@/lib/case/schema";

/** Shows a player-facing text in both languages, so the admin can check the translation. */
export function Bilingual({ text }: { text: LocalizedText }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <p>
        <span className="text-muted mr-1 text-xs font-semibold">EN</span>
        {text.en}
      </p>
      <p>
        <span className="text-muted mr-1 text-xs font-semibold">TR</span>
        {text.tr}
      </p>
    </div>
  );
}
