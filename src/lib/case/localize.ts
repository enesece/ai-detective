import type { Locale, LocalizedText } from "./schema";

/** Picks the player's language from a bilingual text field. */
export function localize(text: LocalizedText, locale: Locale): string {
  return text[locale];
}
